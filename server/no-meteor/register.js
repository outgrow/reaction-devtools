import resolvers from "./resolvers"
import schemas from "./schemas"
import mutations from "./mutations"

/**
 * @summary Import and call this function to add this plugin to your API.
 * @param {ReactionNodeApp} app The ReactionNodeApp instance
 * @returns {undefined}
 */
export default async function register(app) {
  await app.registerPlugin({
    label: "Developer Tools",
    name: "reaction-devtools",
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
