import getSlug from "@reactioncommerce/api-utils/getSlug.js";
import Random from "@reactioncommerce/random";
import ReactionError from "@reactioncommerce/reaction-error";
import faker from "faker";
import publishProductsToCatalog from "/imports/node-app/core-services/catalog/utils/publishProductsToCatalog.js";
import sampleData from "../../sample-data";
import { optionTemplate, productTemplate, variantTemplate } from "../../sample-data/dataTemplates";

/**
 * @method assignHashtagsToProducts
 * @summary Assign generated hashtags to products so every tags has at least 100 products
 * @param {object} productCollection - The Products MongoDB collection
 * @param {array} tags - An array of tags to assign
 */
async function assignHashtagsToProducts(productCollection, tags) {
  const products = await productCollection.find({ type: "simple" }).toArray();

  const tagIds = tags.reduce((tagArray, tag) => {
    if (!tag.isTopLevel) {
      tagArray.push(tag._id);
    }

    return tagArray;
  }, []);

  const writeOperations = [];

  tagIds.forEach((tagId) => {
    for (let tagCount = 0; tagCount < 100; tagCount += 1) {
      const product = Random.choice(products);
      const filter = { _id: product._id };
      const update = { $addToSet: { hashtags: tagId } };

      writeOperations.push({ updateOne: { filter, update } });
    }
  });

  await productCollection.bulkWrite(writeOperations);

  return;
}

/**
 * @method generateProduct
 * @summary Generate a random product with variants and options
 * @returns {array} products - An array of the products created
 */
function generateProduct() {
  const products = [];

  const product = { ...productTemplate };
  const productId = Random.id().toString();

  const variant = { ...variantTemplate };
  const variantId = Random.id().toString();

  product._id = productId;
  product.description = faker.lorem.paragraph();
  product.title = faker.commerce.productName();
  product.vendor = faker.company.companyName();
  product.handle = getSlug(product.title);
  product.createdAt = new Date();
  product.updatedAt = new Date();

  // always one top level variant
  variant._id = variantId;
  variant.ancestors = [productId];
  variant.title = faker.commerce.productName();
  variant.attributeLabel = "Variant";
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
    option.attributeLabel = "Option";
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

  let tags = [];

  if (size === "large") {
    tags = sampleData.medium.tags;
  } else {
    tags = sampleData[size].tags;

    for (let tag of tags) {
      tag.updatedAt = new Date();
      await Tags.insertOne(tag);
    }
  }

  let products = [];

  if (size === "small") {
    products = sampleData.small.products;
  } else {
    let desiredProductCount = size === "large" ? 50000 : 1000;

    for (let productCount = 0; productCount < desiredProductCount; productCount += 1) {
      const newProduct = generateProduct();
      products.push(...newProduct);
    }
  }

  const productIds = products
    .filter((product) => product.type === "simple" && product.isVisible === true)
    .map((product) => product._id);

  const writeOperations = products.map((product) => ({ insertOne: product }));

  try {
    await Products.bulkWrite(writeOperations);

    await assignHashtagsToProducts(Products, tags);

    await publishProductsToCatalog(productIds, context);

    return {
      wasDataLoaded: true
    };
  } catch (error) {
    throw new ReactionError("server-error", `Error creating product record: ${error}`);
  }
}
