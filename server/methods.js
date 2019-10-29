import { Buffer } from "buffer";
import randomPuppy from "random-puppy";
import fetch from "node-fetch";
import jpeg from "jpeg-js";
import faker from "faker";
import { slugify } from "transliteration";
import bufferStreamReader from "buffer-stream-reader";
import { FileRecord } from "@reactioncommerce/file-collections";
import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";
import { Products, Tags, Packages, MediaRecords } from "/lib/collections";
import { Job, Jobs } from "/imports/utils/jobs"
import { Media } from "/imports/plugins/core/files/server";
import Logger from "@reactioncommerce/logger";
import { productTemplate, variantTemplate, optionTemplate } from "./sample-data/dataTemplates";
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
 * @method addProduct
 * @summary Generate a random product with variants and options
 * @returns {array} products - An array of the products created
 */
function addProduct() {
  const products = [];

  const product = { ...productTemplate };
  const productId = Random.id().toString();

  const variant = { ...variantTemplate };
  const variantId = Random.id().toString();

  product._id = productId;
  product.description = faker.lorem.paragraph();
  product.title = faker.commerce.productName();
  product.vendor = faker.company.companyName();
  product.handle = slugify(product.title);
  product.createdAt = new Date();
  product.updatedAt = new Date();

  // always one top level variant
  variant._id = variantId;
  variant.ancestors = [productId];
  variant.title = faker.commerce.productName();
  variant.createdAt = new Date();
  variant.updatedAt = new Date();

  products.push(variant);

  const numOptions = Random.choice([1, 2, 3, 4]);
  const optionPrices = [];

  for (let x = 0; x < numOptions; x += 1) {
    const option = { ...optionTemplate };
    const optionId = Random.id().toString();
    option._id = optionId;
    option.optionTitle = faker.commerce.productName();
    option.price = parseFloat(faker.commerce.price());
    optionPrices.push(option.price);
    option.ancestors = [productId, variantId];
    products.push(option);
  }

  // Math.(min|max).apply allows to pass arguments as array, as Math.(min|max) usually take an indefinite number of args
  // ex.: Math.min(1, 2, 3, 4)
  // See https://www.jstips.co/en/javascript/calculate-the-max-min-value-from-an-array/
  const priceMin = Math.min.apply(null, optionPrices);
  const priceMax = Math.max.apply(null, optionPrices);

  let priceRange = `${priceMin} - ${priceMax}`;
  // if we don't have a range
  if (priceMin === priceMax) {
    priceRange = priceMin.toString();
  }

  const priceObject = {
    range: priceRange,
    min: parseFloat(priceMin),
    max: parseFloat(priceMax)
  };

  product.price = priceObject;

  products.push(product);

  return products;
}

/**
 * @method loadDataset
 * @summary load products generated from a template
 * @param {number} [numProducts=1000] The number of products to load
 */
function loadDataset(numProducts = 1000) {
  methods.resetData();
  Logger.info("Loading Medium Dataset");
  const rawProducts = Products.rawCollection();
  const products = [];
  for (let x = 0; x < numProducts; x += 1) {
    const newProducts = addProduct();
    products.push(...newProducts);
  }
  const writeOperations = products.map((product) => ({ insertOne: product }));
  rawProducts.bulkWrite(writeOperations).then(() => {
    Logger.info(`Created ${numProducts} products`);
  }, (error) => {
    Logger.error(error, "Error creating product record");
  });
}

/**
 * @method loadMediumTags
 * @summary Load tags from a datafile for the "medium" dataset
 * @returns {array} tags - An array of tags loaded from the data file
 */
function loadMediumTags() {
  const tags = require("/imports/plugins/custom/reaction-devtools/sample-data/data/medium/Tags.json");
  tags.forEach((tag) => {
    tag.updatedAt = new Date();
    Tags.insert(tag);
  });
  Logger.info("Tags loaded");
  return tags;
}

/**
 * @method turnOffRevisions
 * @summary temporarily turn off revisions so we can just insert data willy-nilly
 * @returns {undefined}
 */
function turnOffRevisions() {
  Packages.update({
    name: "reaction-revisions"
  }, {
    $set: {
      "settings.general.enabled": false
    }
  });
}
/**
 * @method turnOnRevisions
 * @summary Turn revisions back on to the system functions normally
 * @returns {undefined}
 */
function turnOnRevisions() {
  Packages.update({
    name: "reaction-revisions"
  }, {
    $set: {
      "settings.general.enabled": true
    }
  });
}

/**
 * @method assignHashtagsToProducts
 * @summary Assign generated hashtags to products so every tags has at least 100 products
 * @param {array} tags - An array of tags to assign
 * @param {number} [productPerCategory=100] How many products per category
 */
function assignHashtagsToProducts(tags, productPerCategory = 100) {
  const products = Products.find({ type: "simple" }, { _id: 1 }).fetch();
  const tagIds = tags.reduce((tagArray, tag) => {
    if (!tag.isTopLevel) {
      tagArray.push(tag._id);
    }
    return tagArray;
  }, []);
  const rawProducts = Products.rawCollection();
  const writeOperations = [];
  tagIds.forEach((tagId) => {
    for (let x = 0; x < productPerCategory; x += 1) {
      const product = Random.choice(products);
      const filter = { _id: product._id };
      const update = { $addToSet: { hashtags: tagId } };
      writeOperations.push({ updateOne: { filter, update } });
    }
  });
  rawProducts.bulkWrite(writeOperations);
  Logger.info("Tags assigned");
}

/**
 * @method kickoffProductSearchRebuild
 * @summary Drop a job to rebuild the product search into the queue
 * @returns {undefined}
 */
function kickoffProductSearchRebuild() {
  new Job(Jobs, "product/buildSearchCollection", {})
    .priority("normal")
    .retry({
      retries: 5,
      wait: 60000,
      backoff: "exponential"
    })
    .save({
      cancelRepeats: true
    });
}

/**
 * @method kickoffOrderSearchRebuild
 * @summary Drop a job to rebuilt the order search into the queue
 * @returns {undefined}
 */
function kickoffOrderSearchRebuild() {
  new Job(Jobs, "order/buildSearchCollection", {})
    .priority("normal")
    .retry({
      retries: 5,
      wait: 60000,
      backoff: "exponential"
    })
    .save({
      cancelRepeats: true
    });
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

/**
 * @method loadMediumDataset
 * @summary Load the "medium" dataset of products and tags
 * @returns {undefined}
 */
methods.loadMediumDataset = function () {
  turnOffRevisions();
  methods.resetData();
  loadDataset(1000, 10000);
  const tags = loadMediumTags();
  assignHashtagsToProducts(tags);
  // importProductImages();
  // try to use this to make reactivity work
  // Products.update({}, { $set: { visible: true } }, { multi: true }, { selector: { type: "simple" }, publish: true });
  turnOnRevisions();
  kickoffProductSearchRebuild();
  kickoffOrderSearchRebuild();
  Logger.info("Loading Medium Dataset complete");
};

/**
 * @method loadLargeDataset
 * @summary Load the "large" dataset of products and tags
 * @returns {undefined}
 */
methods.loadLargeDataset = function () {
  turnOffRevisions();
  methods.resetData();
  loadDataset(50000);
  turnOnRevisions();
  kickoffProductSearchRebuild();
};

export default methods;

Meteor.methods({
  "devtools/loaddata/images": methods.loadImages,
  "devtools/loaddata/medium/products": methods.loadMediumDataset,
  "devtools/loaddata/large/products": methods.loadLargeDataset
});
