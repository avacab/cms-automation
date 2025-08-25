export class ProductTransformer {
  shopifyToCMS(shopifyProduct) {
    try {
      // Extract images
      const images = shopifyProduct.images?.edges?.map(edge => ({
        id: edge.node.id,
        url: edge.node.url,
        alt_text: edge.node.altText,
        position: edge.node.position
      })) || [];

      // Extract variants
      const variants = shopifyProduct.variants?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        sku: edge.node.sku || '',
        price: parseFloat(edge.node.price || 0),
        compare_at_price: parseFloat(edge.node.compareAtPrice || 0),
        inventory_quantity: edge.node.inventoryQuantity || 0,
        available_for_sale: edge.node.availableForSale || false,
        weight: edge.node.weight || 0,
        weight_unit: edge.node.weightUnit || 'kg',
        requires_shipping: edge.node.requiresShipping || false,
        position: edge.node.position || 0
      })) || [];

      // Extract metafields
      const metafields = shopifyProduct.metafields?.edges?.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type
      })) || [];

      // Parse tags
      const tags = Array.isArray(shopifyProduct.tags) 
        ? shopifyProduct.tags 
        : (shopifyProduct.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);

      return {
        // Shopify identifiers
        shopify_id: shopifyProduct.id,
        shopify_handle: shopifyProduct.handle,
        
        // Basic product info
        title: shopifyProduct.title || '',
        description: shopifyProduct.description || '',
        vendor: shopifyProduct.vendor || '',
        product_type: shopifyProduct.productType || '',
        status: shopifyProduct.status || 'draft',
        
        // SEO
        seo_title: shopifyProduct.seo?.title || shopifyProduct.title,
        seo_description: shopifyProduct.seo?.description || shopifyProduct.description,
        
        // Pricing (using first variant if available)
        price: variants.length > 0 ? variants[0].price : 0,
        compare_at_price: variants.length > 0 ? variants[0].compare_at_price : 0,
        
        // Inventory
        inventory_quantity: variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
        available_for_sale: variants.some(v => v.available_for_sale),
        
        // Categories and tags
        tags: tags,
        categories: this.extractCategoriesFromTags(tags),
        
        // Media
        featured_image: images.length > 0 ? images[0].url : null,
        images: images,
        
        // Variants
        variants: variants,
        variant_count: variants.length,
        
        // Metadata
        metafields: metafields,
        custom_fields: this.transformMetafieldsToCustomFields(metafields),
        
        // Timestamps
        created_at: shopifyProduct.createdAt,
        updated_at: shopifyProduct.updatedAt,
        
        // Additional computed fields
        has_variants: variants.length > 1,
        in_stock: variants.some(v => v.inventory_quantity > 0),
        min_price: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0,
        max_price: variants.length > 0 ? Math.max(...variants.map(v => v.price)) : 0,
        
        // CMS specific fields
        content_type: 'product',
        source: 'shopify',
        sync_status: 'synced',
        last_synced: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to transform Shopify product: ${error.message}`);
    }
  }

  cmsToShopify(cmsProduct) {
    try {
      // Transform CMS product back to Shopify format for updates
      const shopifyProduct = {
        id: cmsProduct.shopify_id,
        title: cmsProduct.title,
        descriptionHtml: cmsProduct.description,
        vendor: cmsProduct.vendor,
        productType: cmsProduct.product_type,
        status: this.mapCMSStatusToShopify(cmsProduct.status),
        tags: Array.isArray(cmsProduct.tags) ? cmsProduct.tags.join(', ') : cmsProduct.tags,
        
        // SEO
        seo: {
          title: cmsProduct.seo_title,
          description: cmsProduct.seo_description
        }
      };

      // Add variants if they exist
      if (cmsProduct.variants && cmsProduct.variants.length > 0) {
        shopifyProduct.variants = cmsProduct.variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: variant.price.toString(),
          compareAtPrice: variant.compare_at_price > 0 ? variant.compare_at_price.toString() : null,
          inventoryQuantity: variant.inventory_quantity,
          weight: variant.weight,
          weightUnit: variant.weight_unit,
          requiresShipping: variant.requires_shipping
        }));
      }

      // Add images if they exist
      if (cmsProduct.images && cmsProduct.images.length > 0) {
        shopifyProduct.images = cmsProduct.images.map(image => ({
          id: image.id,
          src: image.url,
          altText: image.alt_text
        }));
      }

      // Add metafields
      if (cmsProduct.metafields && cmsProduct.metafields.length > 0) {
        shopifyProduct.metafields = cmsProduct.metafields.map(metafield => ({
          id: metafield.id,
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type
        }));
      }

      return shopifyProduct;

    } catch (error) {
      throw new Error(`Failed to transform CMS product to Shopify: ${error.message}`);
    }
  }

  extractCategoriesFromTags(tags) {
    // Extract category-like tags (you can customize this logic)
    const categoryPatterns = [
      /^cat[egory]*[:\-\s](.+)/i,
      /^type[:\-\s](.+)/i,
      /^collection[:\-\s](.+)/i
    ];

    const categories = [];
    
    for (const tag of tags) {
      for (const pattern of categoryPatterns) {
        const match = tag.match(pattern);
        if (match) {
          categories.push(match[1].trim());
        }
      }
    }

    return categories;
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

  mapCMSStatusToShopify(cmsStatus) {
    const statusMap = {
      'published': 'ACTIVE',
      'draft': 'DRAFT',
      'archived': 'ARCHIVED',
      'active': 'ACTIVE',
      'inactive': 'DRAFT'
    };

    return statusMap[cmsStatus] || 'DRAFT';
  }

  mapShopifyStatusToCMS(shopifyStatus) {
    const statusMap = {
      'ACTIVE': 'published',
      'DRAFT': 'draft',
      'ARCHIVED': 'archived'
    };

    return statusMap[shopifyStatus] || 'draft';
  }

  // Helper methods for product comparison and merging
  areProductsEqual(shopifyProduct, cmsProduct) {
    try {
      return (
        shopifyProduct.title === cmsProduct.title &&
        shopifyProduct.description === cmsProduct.description &&
        shopifyProduct.vendor === cmsProduct.vendor &&
        shopifyProduct.productType === cmsProduct.product_type &&
        shopifyProduct.status === this.mapCMSStatusToShopify(cmsProduct.status) &&
        new Date(shopifyProduct.updatedAt).getTime() <= new Date(cmsProduct.updated_at).getTime()
      );
    } catch (error) {
      return false;
    }
  }

  mergeProductUpdates(existingCmsProduct, newShopifyProduct) {
    try {
      const transformedProduct = this.shopifyToCMS(newShopifyProduct);
      
      // Preserve CMS-specific fields that shouldn't be overwritten
      return {
        ...transformedProduct,
        id: existingCmsProduct.id, // Keep CMS ID
        slug: existingCmsProduct.slug || this.generateSlug(transformedProduct.title),
        cms_categories: existingCmsProduct.cms_categories || [],
        custom_cms_fields: existingCmsProduct.custom_cms_fields || {},
        
        // Merge tags instead of replacing
        tags: [...new Set([
          ...(existingCmsProduct.tags || []),
          ...(transformedProduct.tags || [])
        ])],
        
        // Update sync status
        sync_status: 'updated',
        last_synced: new Date().toISOString(),
        previous_sync: existingCmsProduct.last_synced
      };

    } catch (error) {
      throw new Error(`Failed to merge product updates: ${error.message}`);
    }
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Validation methods
  validateShopifyProduct(product) {
    const required = ['id', 'title'];
    const missing = required.filter(field => !product[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  validateCMSProduct(product) {
    const required = ['shopify_id', 'title'];
    const missing = required.filter(field => !product[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }
}