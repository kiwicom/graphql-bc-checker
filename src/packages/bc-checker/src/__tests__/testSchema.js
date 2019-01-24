// @flow

import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

function createGraphQLSchema(fields: Object) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQuery',
      fields,
    }),
  });
}

function createGraphQLObject(name: string = 'Test') {
  return {
    type: new GraphQLObjectType({
      name,
      fields: {
        id: {
          type: GraphQLString,
        },
      },
    }),
  };
}

module.exports = {
  validSchema: createGraphQLSchema({
    test: createGraphQLObject(),
  }),
  compatibleSchema: createGraphQLSchema({
    test: createGraphQLObject(),
    test2: createGraphQLObject('Test2'), // just adding a new field (backward compatible)
  }),
  breakingSchema: createGraphQLSchema({
    thisFieldIsDifferent: createGraphQLObject(),
  }),
};