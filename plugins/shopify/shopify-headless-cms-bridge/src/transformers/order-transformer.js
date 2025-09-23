export class OrderTransformer {
  shopifyToCMS(shopifyOrder) {
    try {
      // Extract line items
      const lineItems = shopifyOrder.lineItems?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        quantity: edge.node.quantity,
        price: parseFloat(edge.node.variant?.price || 0),
        variant_id: edge.node.variant?.id,
        variant_title: edge.node.variant?.title,
        sku: edge.node.variant?.sku || '',
        product_id: edge.node.variant?.product?.id,
        product_title: edge.node.variant?.product?.title,
        product_handle: edge.node.variant?.product?.handle,
        total_line_price: parseFloat(edge.node.variant?.price || 0) * edge.node.quantity
      })) || [];

      // Extract customer info
      const customer = shopifyOrder.customer ? {
        id: shopifyOrder.customer.id,
        email: shopifyOrder.customer.email,
        first_name: shopifyOrder.customer.firstName,
        last_name: shopifyOrder.customer.lastName,
        phone: shopifyOrder.customer.phone,
        full_name: `${shopifyOrder.customer.firstName || ''} ${shopifyOrder.customer.lastName || ''}`.trim()
      } : null;

      // Extract addresses
      const shippingAddress = shopifyOrder.shippingAddress ? {
        first_name: shopifyOrder.shippingAddress.firstName,
        last_name: shopifyOrder.shippingAddress.lastName,
        company: shopifyOrder.shippingAddress.company,
        address1: shopifyOrder.shippingAddress.address1,
        address2: shopifyOrder.shippingAddress.address2,
        city: shopifyOrder.shippingAddress.city,
        province: shopifyOrder.shippingAddress.province,
        country: shopifyOrder.shippingAddress.country,
        zip: shopifyOrder.shippingAddress.zip,
        phone: shopifyOrder.shippingAddress.phone,
        full_address: this.formatAddress(shopifyOrder.shippingAddress)
      } : null;

      const billingAddress = shopifyOrder.billingAddress ? {
        first_name: shopifyOrder.billingAddress.firstName,
        last_name: shopifyOrder.billingAddress.lastName,
        company: shopifyOrder.billingAddress.company,
        address1: shopifyOrder.billingAddress.address1,
        address2: shopifyOrder.billingAddress.address2,
        city: shopifyOrder.billingAddress.city,
        province: shopifyOrder.billingAddress.province,
        country: shopifyOrder.billingAddress.country,
        zip: shopifyOrder.billingAddress.zip,
        phone: shopifyOrder.billingAddress.phone,
        full_address: this.formatAddress(shopifyOrder.billingAddress)
      } : null;

      // Extract metafields
      const metafields = shopifyOrder.metafields?.edges?.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type
      })) || [];

      return {
        // Shopify identifiers
        shopify_id: shopifyOrder.id,
        shopify_order_number: shopifyOrder.name,
        
        // Order details
        order_name: shopifyOrder.name,
        order_number: this.extractOrderNumber(shopifyOrder.name),
        email: shopifyOrder.email,
        phone: shopifyOrder.phone,
        
        // Status
        financial_status: shopifyOrder.financialStatus || 'pending',
        fulfillment_status: shopifyOrder.fulfillmentStatus || 'unfulfilled',
        order_status: this.determineOrderStatus(shopifyOrder),
        cancel_reason: shopifyOrder.cancelReason,
        
        // Pricing
        subtotal_price: parseFloat(shopifyOrder.subtotalPrice || 0),
        total_tax: parseFloat(shopifyOrder.totalTax || 0),
        total_shipping: parseFloat(shopifyOrder.totalShipping || 0),
        total_price: parseFloat(shopifyOrder.totalPrice || 0),
        currency: shopifyOrder.currency || 'USD',
        
        // Calculated totals
        item_count: lineItems.reduce((sum, item) => sum + item.quantity, 0),
        line_item_total: lineItems.reduce((sum, item) => sum + item.total_line_price, 0),
        
        // Customer
        customer: customer,
        customer_id: customer?.id,
        customer_email: customer?.email,
        customer_name: customer?.full_name,
        
        // Addresses
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        
        // Line items
        line_items: lineItems,
        
        // Product summary
        products: lineItems.map(item => ({
          id: item.product_id,
          title: item.product_title,
          handle: item.product_handle,
          variant_id: item.variant_id,
          variant_title: item.variant_title,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price
        })),
        
        // Metadata
        metafields: metafields,
        custom_fields: this.transformMetafieldsToCustomFields(metafields),
        
        // Timestamps
        created_at: shopifyOrder.createdAt,
        updated_at: shopifyOrder.updatedAt,
        processed_at: shopifyOrder.processedAt,
        cancelled_at: shopifyOrder.cancelledAt,
        
        // Additional computed fields
        is_paid: this.isPaidStatus(shopifyOrder.financialStatus),
        is_fulfilled: this.isFulfilledStatus(shopifyOrder.fulfillmentStatus),
        is_cancelled: !!shopifyOrder.cancelledAt,
        has_shipping_address: !!shippingAddress,
        has_billing_address: !!billingAddress,
        
        // Analysis fields
        order_value_segment: this.categorizeOrderValue(parseFloat(shopifyOrder.totalPrice || 0)),
        customer_type: customer ? 'registered' : 'guest',
        
        // CMS specific fields
        content_type: 'order',
        source: 'shopify',
        sync_status: 'synced',
        last_synced: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to transform Shopify order: ${error.message}`);
    }
  }

  cmsToShopify(cmsOrder) {
    try {
      // Transform CMS order back to Shopify format for updates
      return {
        id: cmsOrder.shopify_id,
        name: cmsOrder.order_name,
        email: cmsOrder.email,
        phone: cmsOrder.phone,
        financialStatus: cmsOrder.financial_status,
        fulfillmentStatus: cmsOrder.fulfillment_status,
        cancelReason: cmsOrder.cancel_reason,
        
        // Note: Most order fields in Shopify are read-only after creation
        // This is mainly useful for status updates and metadata
        
        metafields: cmsOrder.metafields?.map(metafield => ({
          id: metafield.id,
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type
        })) || []
      };

    } catch (error) {
      throw new Error(`Failed to transform CMS order to Shopify: ${error.message}`);
    }
  }

  formatAddress(address) {
    if (!address) return '';
    
    const parts = [
      address.address1,
      address.address2,
      address.city,
      address.province,
      address.zip,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  extractOrderNumber(orderName) {
    // Extract numeric order number from Shopify order name (e.g., "#1001" -> "1001")
    const match = orderName?.match(/#?(\d+)/);
    return match ? match[1] : orderName;
  }

  determineOrderStatus(shopifyOrder) {
    if (shopifyOrder.cancelledAt) {
      return 'cancelled';
    }
    
    const financial = shopifyOrder.financialStatus;
    const fulfillment = shopifyOrder.fulfillmentStatus;
    
    if (financial === 'paid' && fulfillment === 'fulfilled') {
      return 'completed';
    } else if (financial === 'paid') {
      return 'processing';
    } else if (fulfillment === 'fulfilled') {
      return 'fulfilled';
    } else if (financial === 'pending') {
      return 'pending';
    }
    
    return 'pending';
  }

  isPaidStatus(financialStatus) {
    return ['paid', 'partially_paid'].includes(financialStatus);
  }

  isFulfilledStatus(fulfillmentStatus) {
    return ['fulfilled', 'partially_fulfilled'].includes(fulfillmentStatus);
  }

  categorizeOrderValue(totalPrice) {
    if (totalPrice >= 500) {
      return 'high_value';
    } else if (totalPrice >= 100) {
      return 'medium_value';
    } else if (totalPrice >= 25) {
      return 'low_value';
    } else {
      return 'minimal_value';
    }
  }

  transformMetafieldsToCustomFields(metafields) {
    const customFields = {};
    
    for (const metafield of metafields) {
      const key = `${metafield.namespace}_${metafield.key}`;
      customFields[key] = {
        value: metafield.value,
        type: metafield.type,
        namespace: metafield.namespace,
        key: metafield.key
      };
    }

    return customFields;
  }

  // Helper methods for order analysis
  getOrderAnalytics(cmsOrder) {
    return {
      revenue: cmsOrder.total_price,
      items_sold: cmsOrder.item_count,
      average_item_value: cmsOrder.total_price / (cmsOrder.item_count || 1),
      has_discount: cmsOrder.subtotal_price > cmsOrder.total_price - cmsOrder.total_tax - cmsOrder.total_shipping,
      shipping_percentage: (cmsOrder.total_shipping / cmsOrder.total_price) * 100,
      tax_percentage: (cmsOrder.total_tax / cmsOrder.total_price) * 100,
      days_to_fulfillment: cmsOrder.processed_at && cmsOrder.updated_at ? 
        Math.ceil((new Date(cmsOrder.updated_at) - new Date(cmsOrder.processed_at)) / (1000 * 60 * 60 * 24)) : null
    };
  }

  // Order comparison and merging
  areOrdersEqual(shopifyOrder, cmsOrder) {
    try {
      return (
        shopifyOrder.financialStatus === cmsOrder.financial_status &&
        shopifyOrder.fulfillmentStatus === cmsOrder.fulfillment_status &&
        new Date(shopifyOrder.updatedAt).getTime() <= new Date(cmsOrder.updated_at).getTime()
      );
    } catch (error) {
      return false;
    }
  }

  mergeOrderUpdates(existingCmsOrder, newShopifyOrder) {
    try {
      const transformedOrder = this.shopifyToCMS(newShopifyOrder);
      
      // Preserve CMS-specific fields that shouldn't be overwritten
      return {
        ...transformedOrder,
        id: existingCmsOrder.id, // Keep CMS ID
        cms_notes: existingCmsOrder.cms_notes || '',
        internal_status: existingCmsOrder.internal_status,
        assigned_to: existingCmsOrder.assigned_to,
        custom_cms_fields: existingCmsOrder.custom_cms_fields || {},
        
        // Update sync status
        sync_status: 'updated',
        last_synced: new Date().toISOString(),
        previous_sync: existingCmsOrder.last_synced,
        
        // Track status changes
        status_history: [
          ...(existingCmsOrder.status_history || []),
          {
            from_status: existingCmsOrder.order_status,
            to_status: transformedOrder.order_status,
            changed_at: new Date().toISOString(),
            financial_status: transformedOrder.financial_status,
            fulfillment_status: transformedOrder.fulfillment_status
          }
        ].filter(h => h.from_status !== h.to_status)
      };

    } catch (error) {
      throw new Error(`Failed to merge order updates: ${error.message}`);
    }
  }

  // Validation methods
  validateShopifyOrder(order) {
    const required = ['id', 'name'];
    const missing = required.filter(field => !order[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  validateCMSOrder(order) {
    const required = ['shopify_id', 'order_name'];
    const missing = required.filter(field => !order[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  // Status mapping helpers
  getShopifyFinancialStatuses() {
    return [
      'pending',
      'authorized',
      'partially_paid',
      'paid',
      'partially_refunded',
      'refunded',
      'voided'
    ];
  }

  getShopifyFulfillmentStatuses() {
    return [
      'fulfilled',
      'null', // unfulfilled
      'partial',
      'restocked'
    ];
  }

  getCMSOrderStatuses() {
    return [
      'pending',
      'processing',
      'fulfilled',
      'completed',
      'cancelled',
      'refunded'
    ];
  }
}