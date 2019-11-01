import { Buffer } from "buffer";
import randomPuppy from "random-puppy";
import fetch from "node-fetch";
import jpeg from "jpeg-js";
import bufferStreamReader from "buffer-stream-reader";
import { FileRecord } from "@reactioncommerce/file-collections";
import { Meteor } from "meteor/meteor";
import { Products, MediaRecords } from "/lib/collections";
import { Media } from "/imports/plugins/core/files/server";
import Logger from "@reactioncommerce/logger";
import collections from "/imports/collections/rawCollections";
import publishProductToCatalogById from "/imports/node-app/core-services/catalog/utils/publishProductToCatalogById.js";
import getGraphQLContextInMeteorMethod from "/imports/plugins/core/graphql/server/getGraphQLContextInMeteorMethod";

const methods = {};

  function getContext() {
  const context = {
    ...Promise.await(getGraphQLContextInMeteorMethod(Meteor.userId())),
    collections
  };

  return context;
}

/**
 * @method getTopVariant
 * @summary determine the top variant for a product to attach the image to
 * @param {string} productId - The id for a product
 * @returns {object} the variant object
 */
function getTopVariant(productId) {
  const topVariant = Products.findOne({
    "ancestors": { $in: [productId] },
    "ancestors.1": { $exists: false }
  });
  return topVariant;
}

/**
 * @method getPrimaryProduct
 * @summary determine the top-level product for assigning product images
 * @param {object} variant - the variant to find the parent for
 */
function getPrimaryProduct(variant) {
  const parent = Products.findOne({ _id: { $in: variant.ancestors  }, type: "simple" } );
  return parent;
}

/**
 * @method generateImage
 * @summary Generates an random colored image with specified width, height and quality
 * @param {number} width - width of the image
 * @param {number} height - height of the image
 * @param {number} quality - quality of the image
 * @param {function} callback - callback
 */
function generateImage(width, height, quality, callback) {
  const frameData = new Buffer(width * height * 4);
  // const hexColors = [0x5b, 0x40, 0x29, 0xff, 0x59, 0x3e, 0x29, 0x54, 0x3c];
  // // const color = Random.choice(hexColors);
  // const color = Math.floor(Math.random() * 256);
  let i = 0;
  while (i < frameData.length) {
    const color = Math.floor(Math.random() * 256);
    frameData[i += 1] = color;
  }
  const rawImageData = { data: frameData, width, height };
  const jpegImageData = jpeg.encode(rawImageData, quality);

  if (jpegImageData) {
    callback(null, jpegImageData);
  }
}

async function storeFromAttachedBuffer(fileRecord) {
  const { stores } = fileRecord.collection.options;
  const bufferData = fileRecord.data;

  // We do these in series to avoid issues with multiple streams reading
  // from the temp store at the same time.
  try {
    for (const store of stores) {
      if (fileRecord.hasStored(store.name)) {
        return Promise.resolve();
      }

      // Make a new read stream in each loop because you can only read once
      const readStream = new bufferStreamReader(bufferData);
      const writeStream = await store.createWriteStream(fileRecord);
      await new Promise((resolve, reject) => {
        fileRecord.once("error", reject);
        fileRecord.once("stored", resolve);
        readStream.pipe(writeStream);
      });
    }
  } catch (error) {
    throw new Error("Error in storeFromAttachedBuffer:", error);
  }
}

/**
 * @method createProductImage
 * @summary Generate a random image and attach it to each product
 * @param {object} product - the product to attach an image to
 * @returns {object} fileObj - the file object that's been created
 */
function createProductImage(product) {
  generateImage(600, 600, 80, (err, image) => {
    const fileName = `${product._id}.jpg`;
    const fileRecord = new FileRecord({
      original: {
        name: fileName,
        size: image.data.length,
        type: "image/jpeg",
        updatedAt: new Date()
      }
    });
    fileRecord.attachData(image.data);

    const { shopId } = product;
    if (product.type === "simple") {
      const topVariant = getTopVariant(product._id);
      fileRecord.metadata = {
        productId: product._id,
        variantId: topVariant._id,
        toGrid: 1,
        shopId,
        priority: 0,
        workflow: "published"
      };
    } else {
      const parent = getPrimaryProduct(product);
      fileRecord.metadata = {
        productId: parent._id,
        variantId: product._id,
        toGrid: 1,
        shopId,
        priority: 0,
        workflow: "published"
      };
    }

    Promise.await(Media.insert(fileRecord));
    Promise.await(storeFromAttachedBuffer(fileRecord));

    Logger.info(`Wrote image for ${product.title}`);
  });
}


/**
 * @method loadSwagShopProductImage
 * @summary Load swag shop product image
 * @param {object} product - the product to attach an image to
 * @returns {object} fileObj - the file object that's been created
 */
function loadSwagShopProductImage(product) {
  const filepath = `plugins/reaction-devtools/images/${product._id}.jpg`;
  try {
    const binary = Assets.getBinary(filepath);
    const buffer = new Buffer(binary);
    const fileName = `${product._id}.jpg`;
    const fileRecord = new FileRecord({
      original: {
        name: fileName,
        size: buffer.length,
        type: "image/jpeg",
        updatedAt: new Date()
      }
    });
    fileRecord.attachData(buffer);
    const { shopId } = product;
    if (product.type === "simple") {
      const topVariant = getTopVariant(product._id);
      fileRecord.metadata = {
        productId: product._id,
        variantId: topVariant._id,
        toGrid: 1,
        shopId,
        priority: 0,
        workflow: "published"
      };
    } else {
      const parent = getPrimaryProduct(product);
      fileRecord.metadata = {
        productId: parent._id,
        variantId: product._id,
        toGrid: 1,
        shopId,
        priority: 0,
        workflow: "published"
      };
    }

    Promise.await(Media.insert(fileRecord));
    Promise.await(storeFromAttachedBuffer(fileRecord));
  } catch (e) {
    return; // When image is not found, do nothing
  }
}

/**
 * @method createProductImageFromUrl
 * @summary Pull a puppy image from the internet and attach it to a product
 * @param {object} product - the product to attach an image to
 * @returns {object} fileObj - the file object that's been created
 */
async function createProductImageFromUrl(product) {
  console.log("adding image to ", product.title);

  // Get a random puppy image. They seem to occasionally be video files.
  let url;
  let isImage;
  do {
    url = await randomPuppy();
    isImage = url.endsWith(".jpg") || url.endsWith(".png");
    if (!isImage) console.log(`Got non-image file "${url}". Trying again.`);
  } while (!isImage);

  const fileRecord = await FileRecord.fromUrl(url, { fetch });

  const { shopId } = product;
  const topVariant = getTopVariant(product._id);
  if (product.type === "simple") {
    fileRecord.metadata = {
      productId: product._id,
      variantId: topVariant._id,
      toGrid: 1,
      shopId,
      priority: 0,
      workflow: "published"
    };
  } else {
    const parent = getPrimaryProduct(product);
    fileRecord.metadata = {
      productId: parent._id,
      variantId: product._id,
      toGrid: 1,
      shopId,
      priority: 0,
      workflow: "published"
    };
  }

  Media.insert(fileRecord);

}

/**
 * @method attachProductImages
 * @summary Generate an image and attach it to every product
 * @returns {undefined}
 */
function attachProductImages(from = "random") {
  Logger.info("Started loading product images");
  const products = Products.find({}).fetch();
  const productIds = products.map(({ _id }) => _id);
  const media = MediaRecords.find({ "metadata.productId": { $in: productIds } }).fetch();
  const productIdsWithMedia = [...new Set(media.map((doc) => doc.metadata.productId))];
  let imagesAdded = [];
  for (const product of products) {
    // include top level products and options but not top-level variants
    if (!productIdsWithMedia.includes(product._id && product.ancestors.length > 1)) {
      if (from === "web") {
        Promise.await(createProductImageFromUrl(product));
      } else if (from === "swagshop") {
        Promise.await(loadSwagShopProductImage(product));
      } else {
        Promise.await(createProductImage(product));
      }
      imagesAdded.push(product._id);
    }
    if (product.type === "simple" && product.isVisible) {
      publishProductToCatalogById(product._id, getContext());
    }
  }
  Logger.info("loaded product images");
}

/**
 * @method loadImages
 * @summary Generate random images and attach them to all products
 * @returns {undefined}
 */
methods.loadImages = function (from = "random") {
  check(from, String);
  attachProductImages(from);
};

export default methods;

Meteor.methods({
  "devtools/loaddata/images": methods.loadImages
});
