import { logger } from '../utils/logger.js';

export class GraphQLClient {
  constructor(shopifyApi) {
    this.shopify = shopifyApi;
  }

  async executeQuery(session, query, variables = {}) {
    try {
      const client = new this.shopify.clients.Graphql({ session });
      const response = await client.query({
        data: {
          query,
          variables
        }
      });

      if (response.body.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.body.errors)}`);
      }

      return response.body.data;
    } catch (error) {
      logger.error('GraphQL query failed:', {
        error: error.message,
        query: query.substring(0, 100) + '...',
        variables
      });
      throw error;
    }
  }

  async getProducts(session, { first = 10, after = null, query = null } = {}) {
    const graphqlQuery = `
      query getProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              title
              handle
              description
              vendor
              productType
              status
              createdAt
              updatedAt
              images(first: 10) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                    inventoryQuantity
                    availableForSale
                    weight
                    weightUnit
                    requiresShipping
                  }
                }
              }
              tags
              seo {
                title
                description
              }
              metafields(first: 20) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    return await this.executeQuery(session, graphqlQuery, { first, after, query });
  }

  async getOrders(session, { first = 10, after = null, query = null } = {}) {
    const graphqlQuery = `
      query getOrders($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              email
              phone
              createdAt
              updatedAt
              processedAt
              cancelledAt
              cancelReason
              financialStatus
              fulfillmentStatus
              totalPrice
              subtotalPrice
              totalTax
              totalShipping: totalShippingPrice
              currency: currencyCode
              customer {
                id
                email
                firstName
                lastName
                phone
              }
              shippingAddress {
                firstName
                lastName
                company
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              billingAddress {
                firstName
                lastName
                company
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              lineItems(first: 100) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                      sku
                      price
                      product {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
              metafields(first: 20) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    return await this.executeQuery(session, graphqlQuery, { first, after, query });
  }

  async getCustomers(session, { first = 10, after = null, query = null } = {}) {
    const graphqlQuery = `
      query getCustomers($first: Int!, $after: String, $query: String) {
        customers(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              acceptsMarketing
              state
              createdAt
              updatedAt
              defaultAddress {
                firstName
                lastName
                company
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              addresses(first: 10) {
                edges {
                  node {
                    id
                    firstName
                    lastName
                    company
                    address1
                    address2
                    city
                    province
                    country
                    zip
                    phone
                  }
                }
              }
              orders(first: 5) {
                edges {
                  node {
                    id
                    name
                    totalPrice
                    createdAt
                  }
                }
              }
              metafields(first: 20) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    return await this.executeQuery(session, graphqlQuery, { first, after, query });
  }

  async createProduct(session, productInput) {
    const mutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    return await this.executeQuery(session, mutation, { input: productInput });
  }

  async updateProduct(session, productId, productInput) {
    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const input = { id: productId, ...productInput };
    return await this.executeQuery(session, mutation, { input });
  }

  async bulkOperationQuery(session, query) {
    const mutation = `
      mutation bulkOperationRunQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    return await this.executeQuery(session, mutation, { query });
  }

  async getBulkOperationStatus(session, operationId) {
    const query = `
      query getBulkOperation($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            type
          }
        }
      }
    `;

    return await this.executeQuery(session, query, { id: operationId });
  }

  async createWebhook(session, webhookInput) {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            callbackUrl
            topic
            format
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    return await this.executeQuery(session, mutation, webhookInput);
  }

  async getWebhooks(session) {
    const query = `
      query getWebhooks {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              callbackUrl
              topic
              format
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    return await this.executeQuery(session, query);
  }
}