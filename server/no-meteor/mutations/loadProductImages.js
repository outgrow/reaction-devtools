import publishProductToCatalogById from "/imports/node-app/core-services/catalog/utils/publishProductToCatalogById.js";
import createProductImageFromUrl from "../utils/createProductImageFromUrl";

/**
 * @name devtools/loadProductImages
 * @memberof Mutations/Devtools
 * @method
 * @summary Inserts dummy product images into the database
 * @param {Object} context - GraphQL execution context
 * @param {Object} input - Input arguments for the operation
 * @param {String} input.shopId - the shop to create the product for
 * @param {Number} input.source - where to get the images from
 * @returns {Boolean} true if data was inserted
 */
export default async function loadOrders(context, input) {
  const { userHasPermission } = context;
  const { source } = input;

  const shopId = await context.queries.primaryShopId(context.collections);

  if (userHasPermission(["admin"], shopId) === false) {
    throw new ReactionError("access-denied", "User does not have permissions to generate sitemaps");
  }

  const {
    collections: {
      Products,
      MediaRecords
    }
  } = context;

  const products = await Products.find({}).toArray();
  const productIds = products.map((product) => product._id);
  const media = await MediaRecords.find({ "metadata.productId": { $in: productIds } }).toArray();
  const productIdsWithMedia = [...new Set(media.map((doc) => doc.metadata.productId))];

  for (const product of products) {
    if (!productIdsWithMedia.includes(product._id && product.ancestors.length > 1)) {
      if (source === "web") {
        createProductImageFromUrl(product, context);
      } else if (source === "local") {
        // swagShop
      } else if (source === "generate") {
        // generate
      }
    }

    if (product.type === "simple" && product.isVisible) {
      publishProductToCatalogById(product._id, context);
    }
  }

  return {
    wasDataLoaded: true
  }
}
