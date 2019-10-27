import i18n from "./i18n";
import mutations from "./mutations"
import resolvers from "./resolvers"
import schemas from "./schemas"

/**
 * @summary Import and call this function to add this plugin to your API.
 * @param {ReactionNodeApp} app The ReactionNodeApp instance
 * @returns {undefined}
 */
export default async function register(app) {
  await app.registerPlugin({
    label: "Developer Tools",
    name: "reaction-devtools",
    i18n,
    functionsByType: {
      // startup: [startup]
    },
    graphQL: {
      resolvers,
      schemas
    },
    mutations
  });
}
