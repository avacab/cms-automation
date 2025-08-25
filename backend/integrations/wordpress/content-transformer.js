/**
 * Content Transformation Utilities for WordPress Integration
 * 
 * Handles data transformation between CMS and WordPress formats,
 * including field mapping, data validation, and format conversion.
 * 
 * @package CMS_Automation_Backend
 * @since   1.0.0
 */

class ContentTransformer {
    constructor(options = {}) {
        this.fieldMappings = options.fieldMappings || this.getDefaultFieldMappings();
        this.customTransformers = options.customTransformers || {};
        this.dateFormat = options.dateFormat || 'iso';
        this.htmlSanitizer = options.htmlSanitizer || null;
    }

    /**
     * Get default field mappings between CMS and WordPress
     */
    getDefaultFieldMappings() {
        return {
            cms_to_wp: {
                'id': 'meta._headless_cms_id',
                'title': 'title',
                'slug': 'slug',
                'content': 'content',
                'excerpt': 'excerpt',
                'status': 'status',
                'created_at': 'date',
                'updated_at': 'modified',
                'author.id': 'author',
                'author.name': 'meta.author_name',
                'featured_image.id': 'featured_media',
                'featured_image.alt': 'meta.featured_image_alt',
                'metadata.seo_title': 'meta._yoast_wpseo_title',
                'metadata.seo_description': 'meta._yoast_wpseo_metadesc',
                'taxonomies.categories': 'categories',
                'taxonomies.tags': 'tags',
                'type': 'type'
            },
            wp_to_cms: {
                'id': 'wordpress_id',
                'title.rendered': 'title',
                'title': 'title',
                'slug': 'slug',
                'content.rendered': 'content',
                'content': 'content',
                'excerpt.rendered': 'excerpt',
                'excerpt': 'excerpt',
                'status': 'status',
                'date': 'created_at',
                'modified': 'updated_at',
                'author': 'author.id',
                'featured_media': 'featured_image.wp_id',
                'categories': 'taxonomies.categories',
                'tags': 'taxonomies.tags',
                'type': 'type',
                'meta._headless_cms_id': 'id',
                'meta._yoast_wpseo_title': 'metadata.seo_title',
                'meta._yoast_wpseo_metadesc': 'metadata.seo_description'
            }
        };
    }

    /**
     * Transform CMS content to WordPress format
     */
    transformCMSToWP(cmsContent, options = {}) {
        try {
            const wpContent = this.applyFieldMapping(
                cmsContent, 
                this.fieldMappings.cms_to_wp,
                'cms_to_wp'
            );

            // Apply status transformation
            wpContent.status = this.transformStatus(cmsContent.status, 'cms_to_wp');

            // Handle WordPress-specific formatting
            wpContent = this.formatForWordPress(wpContent, cmsContent);

            // Apply custom transformations
            const result = this.applyCustomTransformers(wpContent, cmsContent, 'cms_to_wp');

            this.validateWordPressContent(result);
            
            return result;
        } catch (error) {
            throw new Error(`CMS to WordPress transformation failed: ${error.message}`);
        }
    }

    /**
     * Transform WordPress content to CMS format
     */
    transformWPToCMS(wpContent, options = {}) {
        try {
            const cmsContent = this.applyFieldMapping(
                wpContent,
                this.fieldMappings.wp_to_cms,
                'wp_to_cms'
            );

            // Apply status transformation
            cmsContent.status = this.transformStatus(wpContent.status, 'wp_to_cms');

            // Handle CMS-specific formatting
            const formatted = this.formatForCMS(cmsContent, wpContent);

            // Apply custom transformations
            const result = this.applyCustomTransformers(formatted, wpContent, 'wp_to_cms');

            this.validateCMSContent(result);
            
            return result;
        } catch (error) {
            throw new Error(`WordPress to CMS transformation failed: ${error.message}`);
        }
    }

    /**
     * Apply field mapping between formats
     */
    applyFieldMapping(sourceData, mappings, direction) {
        const result = {};
        
        Object.entries(mappings).forEach(([sourcePath, targetPath]) => {
            const value = this.getNestedValue(sourceData, sourcePath);
            
            if (value !== undefined && value !== null) {
                this.setNestedValue(result, targetPath, value);
            }
        });

        return result;
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        if (!path || !obj) return undefined;
        
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Set nested value in object using dot notation
     */
    setNestedValue(obj, path, value) {
        if (!path) return;
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        const target = keys.reduce((current, key) => {
            if (!current[key]) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * Transform status between systems
     */
    transformStatus(status, direction) {
        const statusMappings = {
            cms_to_wp: {
                'published': 'publish',
                'draft': 'draft',
                'private': 'private',
                'pending': 'pending',
                'trashed': 'trash',
                'archived': 'draft'
            },
            wp_to_cms: {
                'publish': 'published',
                'draft': 'draft',
                'private': 'private',
                'pending': 'pending',
                'trash': 'trashed',
                'auto-draft': 'draft'
            }
        };

        return statusMappings[direction][status] || status;
    }

    /**
     * Format content specifically for WordPress
     */
    formatForWordPress(wpContent, originalCMS) {
        const formatted = { ...wpContent };

        // Ensure meta object exists
        if (!formatted.meta) {
            formatted.meta = {};
        }

        // Handle date formats
        if (formatted.date) {
            formatted.date = this.formatDateForWordPress(formatted.date);
        }
        if (formatted.modified) {
            formatted.modified = this.formatDateForWordPress(formatted.modified);
        }

        // Handle HTML content
        if (formatted.content) {
            formatted.content = this.sanitizeHtmlForWordPress(formatted.content);
        }

        // Handle excerpt
        if (!formatted.excerpt && formatted.content) {
            formatted.excerpt = this.generateExcerpt(formatted.content, 150);
        }

        // Handle taxonomies
        if (originalCMS.taxonomies) {
            formatted.categories = this.transformTaxonomies(originalCMS.taxonomies.categories, 'id');
            formatted.tags = this.transformTaxonomies(originalCMS.taxonomies.tags, 'id');
        }

        // Handle custom fields from metadata
        if (originalCMS.metadata) {
            Object.entries(originalCMS.metadata).forEach(([key, value]) => {
                if (key.startsWith('custom_')) {
                    formatted.meta[key.replace('custom_', '')] = value;
                } else if (!formatted.meta[key]) {
                    formatted.meta[key] = value;
                }
            });
        }

        return formatted;
    }

    /**
     * Format content specifically for CMS
     */
    formatForCMS(cmsContent, originalWP) {
        const formatted = { ...cmsContent };

        // Generate CMS ID if not present
        if (!formatted.id && originalWP.id) {
            formatted.id = `wp_${originalWP.id}`;
        }

        // Handle date formats
        if (formatted.created_at) {
            formatted.created_at = this.formatDateForCMS(formatted.created_at);
        }
        if (formatted.updated_at) {
            formatted.updated_at = this.formatDateForCMS(formatted.updated_at);
        }

        // Handle author information
        if (originalWP.author && !formatted.author) {
            formatted.author = {
                id: originalWP.author,
                name: this.getNestedValue(originalWP, 'meta.author_name') || ''
            };
        }

        // Handle taxonomies
        if (originalWP.categories || originalWP.tags) {
            formatted.taxonomies = {};
            
            if (originalWP.categories && originalWP.categories.length > 0) {
                formatted.taxonomies.categories = this.transformTaxonomies(originalWP.categories);
            }
            
            if (originalWP.tags && originalWP.tags.length > 0) {
                formatted.taxonomies.tags = this.transformTaxonomies(originalWP.tags);
            }
        }

        // Handle metadata from WordPress meta fields
        if (originalWP.meta) {
            formatted.metadata = {};
            
            Object.entries(originalWP.meta).forEach(([key, value]) => {
                if (key.startsWith('_') && !key.includes('headless_cms') && !key.includes('yoast')) {
                    // Skip private meta fields except known ones
                    return;
                }
                
                if (key.includes('yoast')) {
                    // Already handled in field mapping
                    return;
                }
                
                formatted.metadata[key] = value;
            });
        }

        return formatted;
    }

    /**
     * Transform taxonomies array
     */
    transformTaxonomies(taxonomies, extractField = null) {
        if (!Array.isArray(taxonomies)) {
            return [];
        }

        return taxonomies.map(taxonomy => {
            if (typeof taxonomy === 'object' && taxonomy !== null) {
                return extractField ? taxonomy[extractField] : taxonomy;
            }
            return taxonomy;
        }).filter(item => item !== undefined && item !== null);
    }

    /**
     * Format date for WordPress (ISO 8601)
     */
    formatDateForWordPress(date) {
        if (!date) return '';
        
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toISOString();
    }

    /**
     * Format date for CMS
     */
    formatDateForCMS(date) {
        if (!date) return '';
        
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        
        switch (this.dateFormat) {
            case 'iso':
                return dateObj.toISOString();
            case 'unix':
                return Math.floor(dateObj.getTime() / 1000);
            case 'mysql':
                return dateObj.toISOString().slice(0, 19).replace('T', ' ');
            default:
                return dateObj.toISOString();
        }
    }

    /**
     * Sanitize HTML content for WordPress
     */
    sanitizeHtmlForWordPress(html) {
        if (!html) return '';
        
        if (this.htmlSanitizer) {
            return this.htmlSanitizer(html, 'wordpress');
        }
        
        // Basic sanitization - in production, use a proper HTML sanitizer
        return html
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
            .replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers
    }

    /**
     * Generate excerpt from content
     */
    generateExcerpt(content, maxLength = 150) {
        if (!content) return '';
        
        // Strip HTML tags
        const textOnly = content.replace(/<[^>]+>/g, ' ').trim();
        
        if (textOnly.length <= maxLength) {
            return textOnly;
        }
        
        // Find the last space within the limit
        const truncated = textOnly.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }

    /**
     * Apply custom transformers
     */
    applyCustomTransformers(targetData, sourceData, direction) {
        let result = { ...targetData };
        
        if (this.customTransformers[direction]) {
            for (const transformer of this.customTransformers[direction]) {
                if (typeof transformer === 'function') {
                    result = transformer(result, sourceData) || result;
                }
            }
        }
        
        return result;
    }

    /**
     * Validate WordPress content structure
     */
    validateWordPressContent(content) {
        const required = ['title'];
        const errors = [];
        
        required.forEach(field => {
            if (!content[field]) {
                errors.push(`Missing required WordPress field: ${field}`);
            }
        });
        
        if (errors.length > 0) {
            throw new Error(`WordPress content validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Validate CMS content structure
     */
    validateCMSContent(content) {
        const required = ['title'];
        const errors = [];
        
        required.forEach(field => {
            if (!content[field]) {
                errors.push(`Missing required CMS field: ${field}`);
            }
        });
        
        if (errors.length > 0) {
            throw new Error(`CMS content validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Add custom field mapping
     */
    addFieldMapping(direction, sourceField, targetField) {
        if (!this.fieldMappings[direction]) {
            this.fieldMappings[direction] = {};
        }
        
        this.fieldMappings[direction][sourceField] = targetField;
    }

    /**
     * Add custom transformer function
     */
    addCustomTransformer(direction, transformerFunction) {
        if (!this.customTransformers[direction]) {
            this.customTransformers[direction] = [];
        }
        
        this.customTransformers[direction].push(transformerFunction);
    }

    /**
     * Batch transform multiple content items
     */
    batchTransform(items, direction) {
        const transformMethod = direction === 'cms_to_wp' ? 
            this.transformCMSToWP.bind(this) : 
            this.transformWPToCMS.bind(this);
        
        const results = [];
        const errors = [];
        
        items.forEach((item, index) => {
            try {
                results.push(transformMethod(item));
            } catch (error) {
                errors.push({
                    index,
                    item,
                    error: error.message
                });
            }
        });
        
        return {
            success: results,
            errors
        };
    }

    /**
     * Get field mapping configuration
     */
    getFieldMappings() {
        return this.fieldMappings;
    }

    /**
     * Update field mappings
     */
    updateFieldMappings(newMappings) {
        this.fieldMappings = {
            ...this.fieldMappings,
            ...newMappings
        };
    }
}

module.exports = ContentTransformer;