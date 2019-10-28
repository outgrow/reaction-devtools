import ReactionError from "@reactioncommerce/reaction-error";
import publishProductToCatalogById from "/imports/node-app/core-services/catalog/utils/publishProductToCatalogById.js";
import sampleData from "../../sample-data";

/**
 * @name devtools/loadProductsAndTags
 * @memberof Mutations/Devtools
 * @method
 * @summary Inserts dummy products and tags into the database
 * @param {Object} context - GraphQL execution context
 * @param {Object} input - Input arguments for the operation
 * @param {String} input.shopId - the shop to create the product for
 * @returns {Boolean} true if data was inserted
 */
export default async function loadProductsAndTags(context, input) {
  const { userHasPermission } = context;
  const { size } = input;

  const shopId = await context.queries.primaryShopId(context.collections);

  if (userHasPermission(["admin"], shopId) === false) {
    throw new ReactionError("access-denied", "User does not have permissions to generate sitemaps");
  }

  const {
    collections: {
      Products,
      Tags
    }
  } = context;

  const tags = sampleData[size].tags;

  for (let tag of tags) {
    tag.updatedAt = new Date();
    await Tags.insertOne(tag);
  }

  const products = sampleData[size].products;

  for (let product of products) {
    product.createdAt = new Date();
    product.updatedAt = new Date();
    await Products.insertOne(product);

    if (product.type === "simple" && product.isVisible) {
      publishProductToCatalogById(product._id, context);
    }
  }

  return {
    wasDataLoaded: true
  };
}
