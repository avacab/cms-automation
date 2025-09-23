<?php
/**
 * Content synchronization functionality.
 *
 * Handles synchronization of WordPress content with the headless CMS,
 * including posts, pages, media, and metadata.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_Content_Sync {

    /**
     * The plugin name.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $plugin_name    The plugin name.
     */
    private $plugin_name;

    /**
     * The plugin version.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $version    The plugin version.
     */
    private $version;

    /**
     * The API client instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      WP_Headless_CMS_Bridge_API_Client    $api_client    The API client.
     */
    private $api_client;

    /**
     * Initialize the content sync.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    The plugin name.
     * @param    string    $version        The plugin version.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
        
        // Initialize API client
        $this->api_client = new WP_Headless_CMS_Bridge_API_Client($plugin_name, $version);
    }

    /**
     * Sync post to CMS when it's saved.
     *
     * @since    1.0.0
     * @param    int       $post_id    The post ID.
     * @param    WP_Post   $post       The post object.
     * @param    bool      $update     Whether this is an existing post being updated.
     */
    public function sync_post_to_cms($post_id, $post, $update) {
        
        // Debug logging
        error_log("CMS Bridge: sync_post_to_cms called for post ID: $post_id, status: {$post->post_status}, type: {$post->post_type}");
        
        // Check if sync is enabled
        $sync_enabled = get_option('wp_headless_cms_bridge_sync_enabled', false);
        error_log("CMS Bridge: sync_enabled = " . ($sync_enabled ? 'true' : 'false'));
        if (!$sync_enabled) {
            error_log("CMS Bridge: Sync is disabled, skipping");
            return;
        }

        // Check if this post type should be synced
        $sync_post_types = get_option('wp_headless_cms_bridge_post_types', array('post', 'page'));
        if (!in_array($post->post_type, $sync_post_types)) {
            return;
        }

        // Skip autosaves and revisions
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }

        // Check if this post status should be synced
        $sync_post_statuses = get_option('wp_headless_cms_bridge_sync_post_statuses', array('publish'));
        error_log("CMS Bridge: sync_post_statuses = " . print_r($sync_post_statuses, true));
        if (!in_array($post->post_status, $sync_post_statuses)) {
            error_log("CMS Bridge: Post status '{$post->post_status}' not in sync list, skipping");
            return;
        }

        // Prevent infinite loops
        if (get_transient('wp_headless_cms_bridge_syncing_' . $post_id)) {
            return;
        }
        set_transient('wp_headless_cms_bridge_syncing_' . $post_id, true, 300); // 5 minutes

        try {
            // Transform WordPress post to CMS format
            $cms_data = $this->transform_wp_post_to_cms($post);
            
            // Check if this post already exists in CMS
            $cms_id = get_post_meta($post_id, '_headless_cms_id', true);
            
            if ($cms_id && $update) {
                // Update existing content
                $response = $this->api_client->update_content($cms_id, $cms_data);
                $action = 'update';
            } else {
                // Create new content
                $response = $this->api_client->create_content($cms_data);
                $action = 'create';
            }

            if (is_wp_error($response)) {
                // Log error
                $this->log_sync_error($post_id, $action, $response->get_error_message());
            } else {
                // Success - save CMS ID if it's a new post
                if ($action === 'create' && isset($response['data']['id'])) {
                    update_post_meta($post_id, '_headless_cms_id', $response['data']['id']);
                }
                
                // Log success
                $this->log_sync_success($post_id, $cms_id, $action);
                
                // Sync featured image if present
                $this->maybe_sync_featured_image($post_id, $response);
            }

        } catch (Exception $e) {
            $this->log_sync_error($post_id, 'sync', $e->getMessage());
        } finally {
            // Clean up lock
            delete_transient('wp_headless_cms_bridge_syncing_' . $post_id);
        }
    }

    /**
     * Delete post from CMS when it's deleted in WordPress.
     *
     * @since    1.0.0
     * @param    int    $post_id    The post ID.
     */
    public function delete_post_from_cms($post_id) {
        
        // Check if sync is enabled
        if (!get_option('wp_headless_cms_bridge_sync_enabled', false)) {
            return;
        }

        $cms_id = get_post_meta($post_id, '_headless_cms_id', true);
        
        if (!$cms_id) {
            return;
        }

        $response = $this->api_client->delete_content($cms_id);
        
        if (is_wp_error($response)) {
            $this->log_sync_error($post_id, 'delete', $response->get_error_message());
        } else {
            $this->log_sync_success($post_id, $cms_id, 'delete');
            // Clean up meta
            delete_post_meta($post_id, '_headless_cms_id');
        }
    }

    /**
     * Handle post trashing.
     *
     * @since    1.0.0
     * @param    int    $post_id    The post ID.
     */
    public function trash_post_in_cms($post_id) {
        // For now, we'll delete from CMS when trashed
        // You could implement a "trash" status in your CMS instead
        $this->delete_post_from_cms($post_id);
    }

    /**
     * Handle post untrashing.
     *
     * @since    1.0.0
     * @param    int    $post_id    The post ID.
     */
    public function untrash_post_in_cms($post_id) {
        $post = get_post($post_id);
        if ($post && $post->post_status === 'publish') {
            // Re-sync the post
            $this->sync_post_to_cms($post_id, $post, false);
        }
    }

    /**
     * Transform WordPress post to CMS format.
     *
     * @since    1.0.0
     * @param    WP_Post    $post    The WordPress post object.
     * @return   array              The CMS-formatted data.
     */
    private function transform_wp_post_to_cms($post) {
        
        // Basic post data
        $cms_data = array(
            'title' => $post->post_title,
            'slug' => $post->post_name,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'status' => $this->map_wp_status_to_cms($post->post_status),
            'type' => $post->post_type,
            'author' => array(
                'id' => $post->post_author,
                'name' => get_the_author_meta('display_name', $post->post_author),
                'email' => get_the_author_meta('user_email', $post->post_author)
            ),
            'created_at' => $post->post_date_gmt,
            'updated_at' => $post->post_modified_gmt,
            'wordpress_id' => $post->ID
        );

        // Add metadata
        $cms_data['metadata'] = $this->get_post_metadata($post->ID);

        // Add taxonomies
        $cms_data['taxonomies'] = $this->get_post_taxonomies($post->ID);

        // Add featured image
        $featured_image_id = get_post_thumbnail_id($post->ID);
        if ($featured_image_id) {
            $cms_data['featured_image'] = $this->get_image_data($featured_image_id);
        }

        // Allow filtering of CMS data
        return apply_filters('wp_headless_cms_bridge_cms_data', $cms_data, $post);
    }

    /**
     * Map WordPress post status to CMS status.
     *
     * @since    1.0.0
     * @param    string    $wp_status    WordPress post status.
     * @return   string                  CMS status.
     */
    private function map_wp_status_to_cms($wp_status) {
        $status_map = array(
            'publish' => 'published',
            'draft' => 'draft',
            'private' => 'private',
            'pending' => 'pending',
            'trash' => 'trashed'
        );

        return isset($status_map[$wp_status]) ? $status_map[$wp_status] : 'draft';
    }

    /**
     * Get post metadata for CMS sync.
     *
     * @since    1.0.0
     * @param    int      $post_id    The post ID.
     * @return   array                Post metadata.
     */
    private function get_post_metadata($post_id) {
        $metadata = array();
        
        // SEO metadata
        $seo_title = get_post_meta($post_id, '_yoast_wpseo_title', true);
        if ($seo_title) {
            $metadata['seo_title'] = $seo_title;
        }

        $seo_description = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
        if ($seo_description) {
            $metadata['seo_description'] = $seo_description;
        }

        // Custom fields (you might want to filter which ones to sync)
        $custom_fields = get_post_custom($post_id);
        foreach ($custom_fields as $key => $value) {
            // Skip private meta fields (starting with _) unless specifically needed
            if (strpos($key, '_') !== 0) {
                $metadata['custom_' . $key] = is_array($value) ? $value[0] : $value;
            }
        }

        return apply_filters('wp_headless_cms_bridge_post_metadata', $metadata, $post_id);
    }

    /**
     * Get post taxonomies for CMS sync.
     *
     * @since    1.0.0
     * @param    int      $post_id    The post ID.
     * @return   array                Post taxonomies.
     */
    private function get_post_taxonomies($post_id) {
        $taxonomies = array();
        
        $post_taxonomies = get_object_taxonomies(get_post_type($post_id));
        
        foreach ($post_taxonomies as $taxonomy) {
            $terms = wp_get_post_terms($post_id, $taxonomy);
            if (!is_wp_error($terms) && !empty($terms)) {
                $taxonomies[$taxonomy] = array();
                foreach ($terms as $term) {
                    $taxonomies[$taxonomy][] = array(
                        'id' => $term->term_id,
                        'name' => $term->name,
                        'slug' => $term->slug
                    );
                }
            }
        }

        return $taxonomies;
    }

    /**
     * Get image data for CMS sync.
     *
     * @since    1.0.0
     * @param    int      $image_id    The image ID.
     * @return   array                 Image data.
     */
    private function get_image_data($image_id) {
        $image_url = wp_get_attachment_url($image_id);
        $image_meta = wp_get_attachment_metadata($image_id);
        
        return array(
            'id' => $image_id,
            'url' => $image_url,
            'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
            'caption' => wp_get_attachment_caption($image_id),
            'filename' => basename($image_url),
            'filesize' => isset($image_meta['filesize']) ? $image_meta['filesize'] : 0,
            'width' => isset($image_meta['width']) ? $image_meta['width'] : 0,
            'height' => isset($image_meta['height']) ? $image_meta['height'] : 0,
            'mime_type' => get_post_mime_type($image_id)
        );
    }

    /**
     * Maybe sync featured image to CMS.
     *
     * @since    1.0.0
     * @param    int      $post_id     The post ID.
     * @param    array    $cms_response The CMS response from post creation/update.
     */
    private function maybe_sync_featured_image($post_id, $cms_response) {
        $featured_image_id = get_post_thumbnail_id($post_id);
        
        if (!$featured_image_id) {
            return;
        }

        // Check if image is already synced
        $cms_image_id = get_post_meta($featured_image_id, '_headless_cms_media_id', true);
        
        if ($cms_image_id) {
            return; // Already synced
        }

        // Prepare image data for upload
        $image_path = get_attached_file($featured_image_id);
        if (!$image_path || !file_exists($image_path)) {
            return;
        }

        $image_data = array(
            'file' => curl_file_create($image_path),
            'alt' => get_post_meta($featured_image_id, '_wp_attachment_image_alt', true),
            'caption' => wp_get_attachment_caption($featured_image_id),
            'wordpress_id' => $featured_image_id
        );

        $response = $this->api_client->upload_media($image_data);
        
        if (!is_wp_error($response) && isset($response['data']['id'])) {
            update_post_meta($featured_image_id, '_headless_cms_media_id', $response['data']['id']);
        }
    }

    /**
     * Sync content from CMS to WordPress (for bidirectional sync).
     *
     * @since    1.0.0
     * @param    string    $cms_id           The CMS content ID.
     * @param    array     $cms_data         The CMS content data.
     * @return   int|WP_Error               WordPress post ID or error.
     */
    public function sync_cms_to_wp($cms_id, $cms_data) {
        
        // Check if sync direction allows CMS to WP
        $sync_direction = get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms');
        if (!in_array($sync_direction, array('cms_to_wp', 'bidirectional'))) {
            return new WP_Error('sync_disabled', __('CMS to WordPress sync is disabled.', 'wp-headless-cms-bridge'));
        }

        // Look for existing post by CMS ID
        $existing_posts = get_posts(array(
            'meta_key' => '_headless_cms_id',
            'meta_value' => $cms_id,
            'post_type' => 'any',
            'post_status' => 'any',
            'numberposts' => 1
        ));

        $post_data = $this->transform_cms_post_to_wp($cms_data);
        
        if (!empty($existing_posts)) {
            // Update existing post
            $post_data['ID'] = $existing_posts[0]->ID;
            $post_id = wp_update_post($post_data, true);
        } else {
            // Create new post
            $post_id = wp_insert_post($post_data, true);
            
            if (!is_wp_error($post_id)) {
                update_post_meta($post_id, '_headless_cms_id', $cms_id);
            }
        }

        return $post_id;
    }

    /**
     * Transform CMS post data to WordPress format.
     *
     * @since    1.0.0
     * @param    array    $cms_data    The CMS post data.
     * @return   array                 WordPress post data.
     */
    private function transform_cms_post_to_wp($cms_data) {
        
        $post_data = array(
            'post_title' => isset($cms_data['title']) ? $cms_data['title'] : '',
            'post_name' => isset($cms_data['slug']) ? $cms_data['slug'] : '',
            'post_content' => isset($cms_data['content']) ? $cms_data['content'] : '',
            'post_excerpt' => isset($cms_data['excerpt']) ? $cms_data['excerpt'] : '',
            'post_status' => $this->map_cms_status_to_wp(isset($cms_data['status']) ? $cms_data['status'] : 'draft'),
            'post_type' => isset($cms_data['type']) ? $cms_data['type'] : 'post',
            'post_date' => isset($cms_data['created_at']) ? $cms_data['created_at'] : '',
            'post_modified' => isset($cms_data['updated_at']) ? $cms_data['updated_at'] : ''
        );

        // Handle author if provided
        if (isset($cms_data['author']['email'])) {
            $user = get_user_by('email', $cms_data['author']['email']);
            if ($user) {
                $post_data['post_author'] = $user->ID;
            }
        }

        return apply_filters('wp_headless_cms_bridge_wp_post_data', $post_data, $cms_data);
    }

    /**
     * Map CMS status to WordPress status.
     *
     * @since    1.0.0
     * @param    string    $cms_status    CMS status.
     * @return   string                   WordPress status.
     */
    private function map_cms_status_to_wp($cms_status) {
        $status_map = array(
            'published' => 'publish',
            'draft' => 'draft',
            'private' => 'private',
            'pending' => 'pending',
            'trashed' => 'trash'
        );

        return isset($status_map[$cms_status]) ? $status_map[$cms_status] : 'draft';
    }

    /**
     * Log sync success.
     *
     * @since    1.0.0
     * @param    int       $post_id    WordPress post ID.
     * @param    string    $cms_id     CMS content ID.
     * @param    string    $action     Sync action.
     */
    private function log_sync_success($post_id, $cms_id, $action) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'headless_cms_sync_log';
        
        $wpdb->insert(
            $table_name,
            array(
                'post_id' => $post_id,
                'cms_id' => $cms_id,
                'action' => $action,
                'status' => 'success',
                'sync_time' => current_time('mysql')
            ),
            array('%d', '%s', '%s', '%s', '%s')
        );
    }

    /**
     * Log sync error.
     *
     * @since    1.0.0
     * @param    int       $post_id         WordPress post ID.
     * @param    string    $action          Sync action.
     * @param    string    $error_message   Error message.
     */
    private function log_sync_error($post_id, $action, $error_message) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'headless_cms_sync_log';
        
        $wpdb->insert(
            $table_name,
            array(
                'post_id' => $post_id,
                'action' => $action,
                'status' => 'error',
                'error_message' => $error_message,
                'sync_time' => current_time('mysql')
            ),
            array('%d', '%s', '%s', '%s', '%s')
        );

        // Also log to WordPress error log
        error_log("[WP Headless CMS Bridge] Sync error for post {$post_id}: {$error_message}");
    }

    /**
     * Get sync logs for admin display.
     *
     * @since    1.0.0
     * @param    int      $limit    Number of logs to retrieve.
     * @param    int      $offset   Offset for pagination.
     * @return   array              Sync logs.
     */
    public function get_sync_logs($limit = 50, $offset = 0) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'headless_cms_sync_log';
        
        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table_name} ORDER BY sync_time DESC LIMIT %d OFFSET %d",
            $limit,
            $offset
        ));

        return $results;
    }

    /**
     * Clean up old sync logs.
     *
     * @since    1.0.0
     */
    public function cleanup_old_logs() {
        $retention_days = get_option('wp_headless_cms_bridge_log_retention_days', 30);
        
        if ($retention_days <= 0) {
            return; // Don't clean up if retention is 0 or negative
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'headless_cms_sync_log';
        
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$table_name} WHERE sync_time < DATE_SUB(NOW(), INTERVAL %d DAY)",
            $retention_days
        ));
    }

}