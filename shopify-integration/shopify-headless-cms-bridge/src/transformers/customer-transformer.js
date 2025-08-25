export class CustomerTransformer {
  shopifyToCMS(shopifyCustomer) {
    try {
      // Extract addresses
      const addresses = shopifyCustomer.addresses?.edges?.map(edge => ({
        id: edge.node.id,
        first_name: edge.node.firstName,
        last_name: edge.node.lastName,
        company: edge.node.company,
        address1: edge.node.address1,
        address2: edge.node.address2,
        city: edge.node.city,
        province: edge.node.province,
        country: edge.node.country,
        zip: edge.node.zip,
        phone: edge.node.phone,
        full_address: this.formatAddress(edge.node),
        is_default: false // Will be set below
      })) || [];

      // Extract default address
      const defaultAddress = shopifyCustomer.defaultAddress ? {
        first_name: shopifyCustomer.defaultAddress.firstName,
        last_name: shopifyCustomer.defaultAddress.lastName,
        company: shopifyCustomer.defaultAddress.company,
        address1: shopifyCustomer.defaultAddress.address1,
        address2: shopifyCustomer.defaultAddress.address2,
        city: shopifyCustomer.defaultAddress.city,
        province: shopifyCustomer.defaultAddress.province,
        country: shopifyCustomer.defaultAddress.country,
        zip: shopifyCustomer.defaultAddress.zip,
        phone: shopifyCustomer.defaultAddress.phone,
        full_address: this.formatAddress(shopifyCustomer.defaultAddress),
        is_default: true
      } : null;

      // Mark default address in addresses list
      if (defaultAddress) {
        const defaultIndex = addresses.findIndex(addr => 
          addr.address1 === defaultAddress.address1 && 
          addr.city === defaultAddress.city
        );
        if (defaultIndex >= 0) {
          addresses[defaultIndex].is_default = true;
        }
      }

      // Extract recent orders summary
      const recentOrders = shopifyCustomer.orders?.edges?.map(edge => ({
        id: edge.node.id,
        name: edge.node.name,
        total_price: parseFloat(edge.node.totalPrice || 0),
        created_at: edge.node.createdAt,
        currency: edge.node.currencyCode || 'USD'
      })) || [];

      // Extract metafields
      const metafields = shopifyCustomer.metafields?.edges?.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type
      })) || [];

      return {
        // Shopify identifiers
        shopify_id: shopifyCustomer.id,
        
        // Basic customer info
        email: shopifyCustomer.email || '',
        first_name: shopifyCustomer.firstName || '',
        last_name: shopifyCustomer.lastName || '',
        phone: shopifyCustomer.phone || '',
        
        // Computed name fields
        full_name: `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim(),
        display_name: this.generateDisplayName(shopifyCustomer),
        initials: this.generateInitials(shopifyCustomer),
        
        // Account status
        state: shopifyCustomer.state || 'enabled',
        status: this.mapShopifyStateToStatus(shopifyCustomer.state),
        accepts_marketing: shopifyCustomer.acceptsMarketing || false,
        
        // Contact preferences
        marketing_opt_in: shopifyCustomer.acceptsMarketing || false,
        email_verified: shopifyCustomer.emailMarketingConsent?.marketingState === 'subscribed',
        sms_opt_in: shopifyCustomer.smsMarketingConsent?.marketingState === 'subscribed',
        
        // Addresses
        addresses: addresses,
        default_address: defaultAddress,
        address_count: addresses.length,
        
        // Location data (from default address)
        country: defaultAddress?.country || '',
        province: defaultAddress?.province || '',
        city: defaultAddress?.city || '',
        
        // Order history summary
        recent_orders: recentOrders,
        order_count: recentOrders.length,
        total_spent: recentOrders.reduce((sum, order) => sum + order.total_price, 0),
        average_order_value: recentOrders.length > 0 ? 
          recentOrders.reduce((sum, order) => sum + order.total_price, 0) / recentOrders.length : 0,
        last_order_date: recentOrders.length > 0 ? recentOrders[0].created_at : null,
        
        // Customer segmentation
        customer_segment: this.determineCustomerSegment(recentOrders),
        lifetime_value: this.calculateLifetimeValue(recentOrders),
        purchase_frequency: this.calculatePurchaseFrequency(recentOrders, shopifyCustomer.createdAt),
        
        // Metadata
        metafields: metafields,
        custom_fields: this.transformMetafieldsToCustomFields(metafields),
        
        // Timestamps
        created_at: shopifyCustomer.createdAt,
        updated_at: shopifyCustomer.updatedAt,
        
        // Additional computed fields
        has_phone: !!shopifyCustomer.phone,
        has_address: addresses.length > 0,
        is_repeat_customer: recentOrders.length > 1,
        days_since_last_order: this.calculateDaysSinceLastOrder(recentOrders),
        
        // Account age and activity
        account_age_days: this.calculateAccountAge(shopifyCustomer.createdAt),
        is_new_customer: this.calculateAccountAge(shopifyCustomer.createdAt) <= 30,
        
        // CMS specific fields
        content_type: 'customer',
        source: 'shopify',
        sync_status: 'synced',
        last_synced: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to transform Shopify customer: ${error.message}`);
    }
  }

  cmsToShopify(cmsCustomer) {
    try {
      // Transform CMS customer back to Shopify format for updates
      const shopifyCustomer = {
        id: cmsCustomer.shopify_id,
        email: cmsCustomer.email,
        firstName: cmsCustomer.first_name,
        lastName: cmsCustomer.last_name,
        phone: cmsCustomer.phone,
        state: this.mapCMSStatusToShopifyState(cmsCustomer.status),
        acceptsMarketing: cmsCustomer.accepts_marketing || false
      };

      // Add default address if it exists
      if (cmsCustomer.default_address) {
        shopifyCustomer.defaultAddress = {
          firstName: cmsCustomer.default_address.first_name,
          lastName: cmsCustomer.default_address.last_name,
          company: cmsCustomer.default_address.company,
          address1: cmsCustomer.default_address.address1,
          address2: cmsCustomer.default_address.address2,
          city: cmsCustomer.default_address.city,
          province: cmsCustomer.default_address.province,
          country: cmsCustomer.default_address.country,
          zip: cmsCustomer.default_address.zip,
          phone: cmsCustomer.default_address.phone
        };
      }

      // Add addresses if they exist
      if (cmsCustomer.addresses && cmsCustomer.addresses.length > 0) {
        shopifyCustomer.addresses = cmsCustomer.addresses.map(address => ({
          id: address.id,
          firstName: address.first_name,
          lastName: address.last_name,
          company: address.company,
          address1: address.address1,
          address2: address.address2,
          city: address.city,
          province: address.province,
          country: address.country,
          zip: address.zip,
          phone: address.phone
        }));
      }

      // Add metafields
      if (cmsCustomer.metafields && cmsCustomer.metafields.length > 0) {
        shopifyCustomer.metafields = cmsCustomer.metafields.map(metafield => ({
          id: metafield.id,
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type
        }));
      }

      return shopifyCustomer;

    } catch (error) {
      throw new Error(`Failed to transform CMS customer to Shopify: ${error.message}`);
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

  generateDisplayName(shopifyCustomer) {
    if (shopifyCustomer.firstName && shopifyCustomer.lastName) {
      return `${shopifyCustomer.firstName} ${shopifyCustomer.lastName}`;
    } else if (shopifyCustomer.firstName) {
      return shopifyCustomer.firstName;
    } else if (shopifyCustomer.email) {
      return shopifyCustomer.email.split('@')[0];
    } else {
      return 'Customer';
    }
  }

  generateInitials(shopifyCustomer) {
    const firstName = shopifyCustomer.firstName || '';
    const lastName = shopifyCustomer.lastName || '';
    
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    
    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    } else if (firstInitial) {
      return firstInitial;
    } else if (shopifyCustomer.email) {
      return shopifyCustomer.email.charAt(0).toUpperCase();
    } else {
      return 'C';
    }
  }

  mapShopifyStateToStatus(shopifyState) {
    const stateMap = {
      'enabled': 'active',
      'disabled': 'inactive',
      'invited': 'pending',
      'declined': 'declined'
    };

    return stateMap[shopifyState] || 'active';
  }

  mapCMSStatusToShopifyState(cmsStatus) {
    const statusMap = {
      'active': 'enabled',
      'inactive': 'disabled',
      'pending': 'invited',
      'declined': 'declined'
    };

    return statusMap[cmsStatus] || 'enabled';
  }

  determineCustomerSegment(orders) {
    const totalSpent = orders.reduce((sum, order) => sum + order.total_price, 0);
    const orderCount = orders.length;

    if (orderCount === 0) {
      return 'new';
    } else if (orderCount === 1) {
      return 'first_time';
    } else if (totalSpent >= 1000) {
      return 'vip';
    } else if (totalSpent >= 500) {
      return 'high_value';
    } else if (orderCount >= 5) {
      return 'loyal';
    } else {
      return 'regular';
    }
  }

  calculateLifetimeValue(orders) {
    return orders.reduce((sum, order) => sum + order.total_price, 0);
  }

  calculatePurchaseFrequency(orders, customerCreatedAt) {
    if (orders.length <= 1) return 0;

    const accountAgeMonths = this.calculateAccountAge(customerCreatedAt) / 30;
    return accountAgeMonths > 0 ? orders.length / accountAgeMonths : 0;
  }

  calculateDaysSinceLastOrder(orders) {
    if (orders.length === 0) return null;

    const lastOrderDate = new Date(orders[0].created_at);
    const now = new Date();
    const diffTime = Math.abs(now - lastOrderDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  calculateAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  // Customer analysis helpers
  getCustomerAnalytics(cmsCustomer) {
    return {
      lifetime_value: cmsCustomer.lifetime_value,
      average_order_value: cmsCustomer.average_order_value,
      purchase_frequency: cmsCustomer.purchase_frequency,
      recency_score: this.calculateRecencyScore(cmsCustomer.days_since_last_order),
      engagement_score: this.calculateEngagementScore(cmsCustomer),
      churn_risk: this.assessChurnRisk(cmsCustomer),
      preferred_contact: this.determinePreferredContact(cmsCustomer)
    };
  }

  calculateRecencyScore(daysSinceLastOrder) {
    if (!daysSinceLastOrder) return 0;
    
    if (daysSinceLastOrder <= 30) return 5;
    if (daysSinceLastOrder <= 90) return 4;
    if (daysSinceLastOrder <= 180) return 3;
    if (daysSinceLastOrder <= 365) return 2;
    return 1;
  }

  calculateEngagementScore(customer) {
    let score = 0;
    
    // Marketing opt-in
    if (customer.accepts_marketing) score += 2;
    if (customer.email_verified) score += 1;
    if (customer.sms_opt_in) score += 1;
    
    // Profile completeness
    if (customer.has_phone) score += 1;
    if (customer.has_address) score += 1;
    
    // Activity
    if (customer.is_repeat_customer) score += 2;
    if (customer.order_count >= 5) score += 2;
    
    return Math.min(score, 10); // Cap at 10
  }

  assessChurnRisk(customer) {
    const daysSinceLastOrder = customer.days_since_last_order;
    const averageOrderValue = customer.average_order_value;
    const orderCount = customer.order_count;

    if (!daysSinceLastOrder || orderCount === 0) {
      return 'unknown';
    }

    if (daysSinceLastOrder > 365 && orderCount === 1) {
      return 'high';
    } else if (daysSinceLastOrder > 180 && averageOrderValue < 50) {
      return 'high';
    } else if (daysSinceLastOrder > 90) {
      return 'medium';
    } else if (daysSinceLastOrder > 30) {
      return 'low';
    } else {
      return 'very_low';
    }
  }

  determinePreferredContact(customer) {
    if (customer.sms_opt_in && customer.has_phone) {
      return 'sms';
    } else if (customer.email_verified || customer.accepts_marketing) {
      return 'email';
    } else if (customer.has_phone) {
      return 'phone';
    } else {
      return 'email';
    }
  }

  // Customer comparison and merging
  areCustomersEqual(shopifyCustomer, cmsCustomer) {
    try {
      return (
        shopifyCustomer.email === cmsCustomer.email &&
        shopifyCustomer.firstName === cmsCustomer.first_name &&
        shopifyCustomer.lastName === cmsCustomer.last_name &&
        shopifyCustomer.acceptsMarketing === cmsCustomer.accepts_marketing &&
        new Date(shopifyCustomer.updatedAt).getTime() <= new Date(cmsCustomer.updated_at).getTime()
      );
    } catch (error) {
      return false;
    }
  }

  mergeCustomerUpdates(existingCmsCustomer, newShopifyCustomer) {
    try {
      const transformedCustomer = this.shopifyToCMS(newShopifyCustomer);
      
      // Preserve CMS-specific fields that shouldn't be overwritten
      return {
        ...transformedCustomer,
        id: existingCmsCustomer.id, // Keep CMS ID
        cms_notes: existingCmsCustomer.cms_notes || '',
        internal_tags: existingCmsCustomer.internal_tags || [],
        assigned_to: existingCmsCustomer.assigned_to,
        custom_cms_fields: existingCmsCustomer.custom_cms_fields || {},
        
        // Preserve historical data
        first_order_date: existingCmsCustomer.first_order_date,
        total_orders_historical: Math.max(
          existingCmsCustomer.total_orders_historical || 0,
          transformedCustomer.order_count
        ),
        
        // Update sync status
        sync_status: 'updated',
        last_synced: new Date().toISOString(),
        previous_sync: existingCmsCustomer.last_synced,
        
        // Track profile changes
        profile_changes: this.trackProfileChanges(existingCmsCustomer, transformedCustomer)
      };

    } catch (error) {
      throw new Error(`Failed to merge customer updates: ${error.message}`);
    }
  }

  trackProfileChanges(oldCustomer, newCustomer) {
    const changes = [];
    const fieldsToTrack = [
      'first_name', 'last_name', 'email', 'phone', 
      'accepts_marketing', 'status'
    ];

    for (const field of fieldsToTrack) {
      if (oldCustomer[field] !== newCustomer[field]) {
        changes.push({
          field,
          from: oldCustomer[field],
          to: newCustomer[field],
          changed_at: new Date().toISOString()
        });
      }
    }

    return changes;
  }

  // Validation methods
  validateShopifyCustomer(customer) {
    const required = ['id', 'email'];
    const missing = required.filter(field => !customer[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new Error('Invalid email format');
    }

    return true;
  }

  validateCMSCustomer(customer) {
    const required = ['shopify_id', 'email'];
    const missing = required.filter(field => !customer[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  // Customer segment definitions
  getCustomerSegments() {
    return {
      'new': 'New customer (no orders)',
      'first_time': 'First-time buyer (1 order)',
      'regular': 'Regular customer (2-4 orders)',
      'loyal': 'Loyal customer (5+ orders)',
      'high_value': 'High-value customer ($500+ LTV)',
      'vip': 'VIP customer ($1000+ LTV)'
    };
  }

  getChurnRiskLevels() {
    return {
      'very_low': 'Very Low (ordered within 30 days)',
      'low': 'Low (ordered within 90 days)',
      'medium': 'Medium (ordered within 180 days)',
      'high': 'High (no order in 180+ days)',
      'unknown': 'Unknown (insufficient data)'
    };
  }
}