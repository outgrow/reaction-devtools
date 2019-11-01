import { FileRecord } from "@reactioncommerce/file-collections";
import randomPuppy from "random-puppy";
import fetch from "node-fetch";

/**
 * @method createProductImageFromUrl
 * @summary Pull a puppy image from the internet and attach it to a product
 * @param {object} product - the product to attach an image to
 * @param {object} context - the app context
 * @returns {object} fileRecord - the file object that's been created
 */
export default async function createProductImageFromUrl(product, context) {
  const {
    collections: {
      Media
    }
  } = context;

  let url;
  let isImage;

  do {
    url = await randomPuppy();
    isImage = url.endsWith(".jpg") || url.endsWith(".png");

    if (!isImage) {
      console.log(`Got non-image file "${url}". Trying again.`);
    }
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

  Media.insertOne(fileRecord);

  return fileRecord;
}
