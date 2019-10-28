import ReactionError from "@reactioncommerce/reaction-error";

/**
 * @name devtools/resetDevtoolData
 * @memberof Mutations/Devtools
 * @method
 * @summary Inserts dummy products and tags into the database
 * @param {Object} context - GraphQL execution context
 * @param {Object} input - Input arguments for the operation
 * @returns {Boolean} true if data was inserted
 */
export default async function resetDevtoolData(context, input) {
  const { userHasPermission } = context;

  const shopId = await context.queries.primaryShopId(context.collections);

  if (userHasPermission(["admin"], shopId) === false) {
    throw new ReactionError("access-denied", "User does not have permissions to generate sitemaps");
  }

  const {
    collections: {
      Catalog,
      Orders,
      Products,
      Tags
    }
  } = context;

  await Catalog.remove({});
  await Orders.remove({});
  await Products.remove({});
  await Tags.remove({});

  return {
    wasDataLoaded: true
  };
}
