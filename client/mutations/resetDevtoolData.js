import gql from "graphql-tag";

export default gql`
  mutation resetDevtoolData($input: ResetDataInput) {
    resetDevtoolData(input: $input) {
      wasDataLoaded
    }
  }
`
