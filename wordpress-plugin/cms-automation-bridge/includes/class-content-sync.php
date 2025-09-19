<?php
/**
 * Content Synchronization Class
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CMS_Automation_Content_Sync {
    
    private $api_client;
    
    public function __construct() {
        $this->api_client = new CMS_Automation_API_Client();
    }
    
    /**
     * Sync WordPress post to CMS
     */
    public function sync_post_to_cms($post_id) {
        $post = get_post($post_id);
        
        if (!$post || $post->post_status !== 'publish') {
            return array(
                'success' => false,
                'message' => __('Post not found or not published', 'cms-automation-bridge')
            );
        }
        
        // Check if this content type should be synced
        $content_types = get_option('cms_automation_content_types', array('post', 'page'));
        if (!in_array($post->post_type, $content_types)) {
            return array(
                'success' => false,
                'message' => __('Content type not configured for sync', 'cms-automation-bridge')
            );
        }
        
        // Prepare content data
        $content_data = $this->prepare_content_data($post);
        
        // Check if this post already exists in CMS
        $cms_id = get_post_meta($post_id, '_cms_automation_id', true);
        
        if ($cms_id) {
            // Update existing content
            $result = $this->api_client->update_content($cms_id, $content_data);
        } else {
            // Create new content
            $result = $this->api_client->create_content($content_data);
            
            if ($result['success'] && isset($result['data']['id'])) {
                // Store CMS ID in WordPress
                update_post_meta($post_id, '_cms_automation_id', $result['data']['id']);
            }
        }
        
        // Update sync metadata
        if ($result['success']) {
            update_post_meta($post_id, '_cms_automation_last_sync', current_time('mysql'));
            update_post_meta($post_id, '_cms_automation_sync_status', 'success');
        } else {
            update_post_meta($post_id, '_cms_automation_sync_status', 'failed');
            update_post_meta($post_id, '_cms_automation_sync_error', $result['message']);
        }
        
        // Log sync attempt
        $this->log_sync_attempt($post_id, $cms_id, $result);
        
        return $result;
    }
    
    /**
     * Delete post from CMS
     */
    public function delete_post_from_cms($cms_id) {
        $result = $this->api_client->delete_content($cms_id);
        
        // Log deletion attempt
        $this->log_sync_attempt(null, $cms_id, $result, 'delete');
        
        return $result;
    }
    
    /**
     * Sync CMS content to WordPress
     */
    public function sync_cms_to_wp($cms_content) {
        // Check if content already exists in WordPress
        $existing_posts = get_posts(array(
            'meta_key' => '_cms_automation_id',
            'meta_value' => $cms_content['id'],
            'posts_per_page' => 1,
            'post_status' => 'any'
        ));
        
        if (!empty($existing_posts)) {
            // Update existing post
            $post_id = $existing_posts[0]->ID;
            return $this->update_wp_post($post_id, $cms_content);
        } else {
            // Create new post
            return $this->create_wp_post($cms_content);
        }
    }
    
    /**
     * Create WordPress post from CMS content
     */
    private function create_wp_post($cms_content) {
        $post_data = array(
            'post_title' => sanitize_text_field($cms_content['title']),
            'post_content' => wp_kses_post($cms_content['content']),
            'post_status' => $this->map_cms_status($cms_content['status']),
            'post_type' => $this->map_cms_content_type($cms_content['content_type_id']),
            'meta_input' => array(
                '_cms_automation_id' => $cms_content['id'],
                '_cms_automation_last_sync' => current_time('mysql'),
                '_cms_automation_sync_status' => 'success'
            )
        );
        
        // Set post date if available
        if (isset($cms_content['published_at']) && !empty($cms_content['published_at'])) {
            $post_data['post_date'] = date('Y-m-d H:i:s', strtotime($cms_content['published_at']));
        }
        
        // Set excerpt if available
        if (isset($cms_content['excerpt']) && !empty($cms_content['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($cms_content['excerpt']);
        }
        
        $post_id = wp_insert_post($post_data, true);
        
        if (is_wp_error($post_id)) {
            return array(
                'success' => false,
                'message' => $post_id->get_error_message()
            );
        }
        
        // Handle featured image if available
        if (isset($cms_content['featured_image']) && !empty($cms_content['featured_image'])) {
            $this->set_featured_image($post_id, $cms_content['featured_image']);
        }
        
        // Handle tags and categories
        $this->sync_taxonomy_terms($post_id, $cms_content);
        
        return array(
            'success' => true,
            'post_id' => $post_id,
            'message' => __('Post created successfully', 'cms-automation-bridge')
        );
    }
    
    /**
     * Update WordPress post from CMS content
     */
    private function update_wp_post($post_id, $cms_content) {
        $post_data = array(
            'ID' => $post_id,
            'post_title' => sanitize_text_field($cms_content['title']),
            'post_content' => wp_kses_post($cms_content['content']),
            'post_status' => $this->map_cms_status($cms_content['status'])
        );
        
        // Set excerpt if available
        if (isset($cms_content['excerpt']) && !empty($cms_content['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_textarea_field($cms_content['excerpt']);
        }
        
        $result = wp_update_post($post_data, true);
        
        if (is_wp_error($result)) {
            return array(
                'success' => false,
                'message' => $result->get_error_message()
            );
        }
        
        // Update sync metadata
        update_post_meta($post_id, '_cms_automation_last_sync', current_time('mysql'));
        update_post_meta($post_id, '_cms_automation_sync_status', 'success');
        
        // Handle featured image if available
        if (isset($cms_content['featured_image']) && !empty($cms_content['featured_image'])) {
            $this->set_featured_image($post_id, $cms_content['featured_image']);
        }
        
        // Handle tags and categories
        $this->sync_taxonomy_terms($post_id, $cms_content);
        
        return array(
            'success' => true,
            'post_id' => $post_id,
            'message' => __('Post updated successfully', 'cms-automation-bridge')
        );
    }
    
    /**
     * Prepare WordPress post data for CMS
     */
    private function prepare_content_data($post) {
        $data = array(
            'title' => $post->post_title,
            'content' => $post->post_content,
            'status' => $this->map_wp_status($post->post_status),
            'content_type_id' => $this->map_wp_content_type($post->post_type),
            'excerpt' => $post->post_excerpt,
            'created_at' => $post->post_date,
            'updated_at' => $post->post_modified,
            'source' => 'wordpress',
            'source_id' => $post->ID,
            'author' => array(
                'id' => $post->post_author,
                'name' => get_the_author_meta('display_name', $post->post_author),
                'email' => get_the_author_meta('user_email', $post->post_author)
            )
        );
        
        // Add published date if post is published
        if ($post->post_status === 'publish') {
            $data['published_at'] = $post->post_date;
        }
        
        // Add featured image if available
        $featured_image_id = get_post_thumbnail_id($post->ID);
        if ($featured_image_id) {
            $featured_image_url = wp_get_attachment_image_url($featured_image_id, 'full');
            if ($featured_image_url) {
                $data['featured_image'] = $featured_image_url;
            }
        }
        
        // Add categories and tags
        $categories = get_the_terms($post->ID, 'category');
        if ($categories && !is_wp_error($categories)) {
            $data['categories'] = array_map(function($cat) {
                return $cat->name;
            }, $categories);
        }
        
        $tags = get_the_terms($post->ID, 'post_tag');
        if ($tags && !is_wp_error($tags)) {
            $data['tags'] = array_map(function($tag) {
                return $tag->name;
            }, $tags);
        }
        
        // Add custom fields
        $custom_fields = get_post_meta($post->ID);
        if (!empty($custom_fields)) {
            $data['meta'] = array();
            foreach ($custom_fields as $key => $value) {
                // Skip internal WordPress and plugin meta
                if (!str_starts_with($key, '_') || str_starts_with($key, '_cms_automation_')) {
                    continue;
                }
                $data['meta'][$key] = is_array($value) && count($value) === 1 ? $value[0] : $value;
            }
        }
        
        return $data;
    }
    
    /**
     * Map WordPress post status to CMS status
     */
    private function map_wp_status($wp_status) {
        $status_map = array(
            'publish' => 'published',
            'draft' => 'draft',
            'private' => 'draft',
            'pending' => 'draft',
            'auto-draft' => 'draft',
            'trash' => 'archived'
        );
        
        return isset($status_map[$wp_status]) ? $status_map[$wp_status] : 'draft';
    }
    
    /**
     * Map CMS status to WordPress post status
     */
    private function map_cms_status($cms_status) {
        $status_map = array(
            'published' => 'publish',
            'draft' => 'draft',
            'archived' => 'trash'
        );
        
        return isset($status_map[$cms_status]) ? $status_map[$cms_status] : 'draft';
    }
    
    /**
     * Map WordPress content type to CMS content type
     */
    private function map_wp_content_type($wp_type) {
        $type_map = array(
            'post' => 'blog-post',
            'page' => 'page',
            'product' => 'product',
            'event' => 'event'
        );
        
        return isset($type_map[$wp_type]) ? $type_map[$wp_type] : 'blog-post';
    }
    
    /**
     * Map CMS content type to WordPress content type
     */
    private function map_cms_content_type($cms_type) {
        $type_map = array(
            'blog-post' => 'post',
            'page' => 'page',
            'product' => 'product',
            'event' => 'event'
        );
        
        return isset($type_map[$cms_type]) ? $type_map[$cms_type] : 'post';
    }
    
    /**
     * Set featured image from URL
     */
    private function set_featured_image($post_id, $image_url) {
        // Download image and set as featured image
        $upload_dir = wp_upload_dir();
        $image_data = wp_remote_get($image_url);
        
        if (is_wp_error($image_data)) {
            return false;
        }
        
        $filename = basename($image_url);
        $file_path = $upload_dir['path'] . '/' . $filename;
        
        if (wp_mkdir_p($upload_dir['path'])) {
            file_put_contents($file_path, wp_remote_retrieve_body($image_data));
            
            $attachment = array(
                'post_mime_type' => wp_remote_retrieve_header($image_data, 'content-type'),
                'post_title' => sanitize_file_name($filename),
                'post_content' => '',
                'post_status' => 'inherit'
            );
            
            $attachment_id = wp_insert_attachment($attachment, $file_path, $post_id);
            
            if (!is_wp_error($attachment_id)) {
                require_once(ABSPATH . 'wp-admin/includes/image.php');
                $attachment_data = wp_generate_attachment_metadata($attachment_id, $file_path);
                wp_update_attachment_metadata($attachment_id, $attachment_data);
                set_post_thumbnail($post_id, $attachment_id);
            }
        }
    }
    
    /**
     * Sync taxonomy terms (categories, tags, etc.)
     */
    private function sync_taxonomy_terms($post_id, $cms_content) {
        // Handle categories
        if (isset($cms_content['categories']) && is_array($cms_content['categories'])) {
            $category_ids = array();
            foreach ($cms_content['categories'] as $category_name) {
                $category = get_term_by('name', $category_name, 'category');
                if (!$category) {
                    $category = wp_insert_term($category_name, 'category');
                    if (!is_wp_error($category)) {
                        $category_ids[] = $category['term_id'];
                    }
                } else {
                    $category_ids[] = $category->term_id;
                }
            }
            wp_set_post_categories($post_id, $category_ids);
        }
        
        // Handle tags
        if (isset($cms_content['tags']) && is_array($cms_content['tags'])) {
            wp_set_post_tags($post_id, $cms_content['tags']);
        }
    }
    
    /**
     * Log sync attempt
     */
    private function log_sync_attempt($post_id, $cms_id, $result, $action = 'sync') {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'cms_automation_sync_log';
        
        $wpdb->insert(
            $table_name,
            array(
                'post_id' => $post_id,
                'cms_id' => $cms_id,
                'action' => $action,
                'status' => $result['success'] ? 'success' : 'failed',
                'message' => $result['message'] ?? '',
                'sync_time' => current_time('mysql')
            ),
            array(
                '%d',
                '%s',
                '%s',
                '%s',
                '%s',
                '%s'
            )
        );
    }
    
    /**
     * Get sync log for a post
     */
    public function get_sync_log($post_id, $limit = 10) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'cms_automation_sync_log';
        
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE post_id = %d ORDER BY sync_time DESC LIMIT %d",
                $post_id,
                $limit
            )
        );
    }
    
    /**
     * Bulk sync content
     */
    public function bulk_sync($args = array()) {
        $defaults = array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_cms_automation_sync',
                    'value' => '1',
                    'compare' => '='
                )
            )
        );
        
        $args = wp_parse_args($args, $defaults);
        $posts = get_posts($args);
        
        $results = array(
            'success' => 0,
            'failed' => 0,
            'total' => count($posts)
        );
        
        foreach ($posts as $post) {
            $result = $this->sync_post_to_cms($post->ID);
            if ($result['success']) {
                $results['success']++;
            } else {
                $results['failed']++;
            }
        }
        
        return $results;
    }
}