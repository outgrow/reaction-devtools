import gql from "graphql-tag";

export default gql`
  mutation loadProductsAndTags($input: LoadDataInput) {
    loadProductsAndTags(input: $input) {
      wasDataLoaded
    }
  }
`
