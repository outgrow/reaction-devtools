import Random from "@reactioncommerce/random";
import ReactionError from "@reactioncommerce/reaction-error";
import faker from "faker";
import { orderTemplate } from "../../sample-data/dataTemplates";

function generateOrder() {
  const order = { ...orderTemplate };
  order._id = Random.id().toString();
  order.referenceId = Random.id().toString();
  order.createdAt = new Date();
  order.email = faker.internet.email();

  const newName = `${faker.name.firstName()} ${faker.name.lastName()}`;

  order.shipping.forEach((shippingRecord, index) => {
    order.shipping[index].address.fullName = newName;
  });

  return order;
}

/**
 * @name devtools/loadOrders
 * @memberof Mutations/Devtools
 * @method
 * @summary Inserts dummy orders into the database
 * @param {Object} context - GraphQL execution context
 * @param {Object} input - Input arguments for the operation
 * @param {String} input.shopId - the shop to create the product for
 * @param {Number} input.desiredOrderCount - the desired count of orders to generate
 * @returns {Boolean} true if data was inserted
 */
export default async function loadOrders(context, input) {
  const { userHasPermission } = context;
  const { desiredOrderCount } = input;

  const shopId = await context.queries.primaryShopId(context.collections);

  if (userHasPermission(["admin"], shopId) === false) {
    throw new ReactionError("access-denied", "User does not have permissions to generate sitemaps");
  }

  const {
    collections: {
      Orders
    }
  } = context;

  const orders = [];

  for (let orderCount = 0; orderCount < desiredOrderCount; orderCount += 1) {
    const newOrder = generateOrder();
    orders.push(newOrder);
  }

  const writeOrderOperations = orders.map((order) => ({ insertOne: order }));

  try {
    await Orders.bulkWrite(writeOrderOperations);

    return {
      wasDataLoaded: true
    }
  } catch (error) {
    throw new ReactionError(error, "Error creating order records");
  }
}
