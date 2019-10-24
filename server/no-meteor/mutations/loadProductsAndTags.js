import ReactionError from "@reactioncommerce/reaction-error";
import publishProductToCatalogById from "/imports/plugins/core/catalog/server/no-meteor/utils/publishProductToCatalogById";
import smallTags from "../../sample-data/data/small/Tags.js";
import smallProducts from "../../sample-data/data/small/Products.js";

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
  const { userHasPermission, userId } = context;
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

  for (let tag of smallTags) {
    tag.updatedAt = new Date();
    await Tags.insertOne(tag);
  }

  for (let product of smallProducts) {
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
