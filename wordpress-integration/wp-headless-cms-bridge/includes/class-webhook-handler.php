<?php
/**
 * Webhook handler for receiving updates from the headless CMS.
 *
 * Processes incoming webhooks from the CMS to sync content changes
 * back to WordPress.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_Webhook_Handler {

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
     * The content sync instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      WP_Headless_CMS_Bridge_Content_Sync    $content_sync    The content sync handler.
     */
    private $content_sync;

    /**
     * Initialize the webhook handler.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    The plugin name.
     * @param    string    $version        The plugin version.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
        
        // Initialize content sync
        $this->content_sync = new WP_Headless_CMS_Bridge_Content_Sync($plugin_name, $version);
    }

    /**
     * Register webhook endpoints.
     *
     * @since    1.0.0
     */
    public function register_webhook_endpoints() {
        
        // Content webhook endpoint
        register_rest_route('wp-headless-cms-bridge/v1', '/webhook/content', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_content_webhook'),
            'permission_callback' => array($this, 'verify_webhook_permission'),
            'args' => array(
                'event' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return in_array($param, array('created', 'updated', 'deleted', 'published', 'unpublished'));
                    }
                ),
                'content_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return !empty($param);
                    }
                )
            )
        ));

        // Media webhook endpoint
        register_rest_route('wp-headless-cms-bridge/v1', '/webhook/media', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_media_webhook'),
            'permission_callback' => array($this, 'verify_webhook_permission'),
            'args' => array(
                'event' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return in_array($param, array('uploaded', 'updated', 'deleted'));
                    }
                ),
                'media_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return !empty($param);
                    }
                )
            )
        ));

        // Health check endpoint for the CMS to verify webhook connectivity
        register_rest_route('wp-headless-cms-bridge/v1', '/webhook/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_health_check'),
            'permission_callback' => '__return_true'
        ));
    }

    /**
     * Verify webhook permission using secret key.
     *
     * @since    1.0.0
     * @param    WP_REST_Request    $request    The REST request.
     * @return   bool|WP_Error                 Permission result.
     */
    public function verify_webhook_permission($request) {
        
        // Get the webhook secret from settings
        $webhook_secret = get_option('wp_headless_cms_bridge_webhook_secret', '');
        
        if (empty($webhook_secret)) {
            return new WP_Error('no_secret', __('Webhook secret not configured.', 'wp-headless-cms-bridge'), array('status' => 500));
        }

        // Get the signature from headers
        $signature = $request->get_header('X-CMS-Signature');
        if (empty($signature)) {
            return new WP_Error('missing_signature', __('Webhook signature missing.', 'wp-headless-cms-bridge'), array('status' => 401));
        }

        // Get the request body
        $body = $request->get_body();
        
        // Verify the signature
        $expected_signature = hash_hmac('sha256', $body, $webhook_secret);
        $provided_signature = str_replace('sha256=', '', $signature);
        
        if (!hash_equals($expected_signature, $provided_signature)) {
            $this->log_webhook_error('signature_mismatch', 'Invalid webhook signature', array(
                'expected' => $expected_signature,
                'provided' => $provided_signature
            ));
            return new WP_Error('invalid_signature', __('Invalid webhook signature.', 'wp-headless-cms-bridge'), array('status' => 401));
        }

        // Check timestamp to prevent replay attacks
        $timestamp = $request->get_header('X-CMS-Timestamp');
        if ($timestamp) {
            $current_time = time();
            $webhook_time = intval($timestamp);
            
            // Allow 5 minutes tolerance
            if (abs($current_time - $webhook_time) > 300) {
                return new WP_Error('stale_webhook', __('Webhook timestamp is too old.', 'wp-headless-cms-bridge'), array('status' => 401));
            }
        }

        return true;
    }

    /**
     * Handle content webhook.
     *
     * @since    1.0.0
     * @param    WP_REST_Request    $request    The REST request.
     * @return   WP_REST_Response              The response.
     */
    public function handle_content_webhook($request) {
        
        $event = $request->get_param('event');
        $content_id = $request->get_param('content_id');
        $content_data = $request->get_param('content');

        $this->log_webhook_event('content', $event, $content_id);

        try {
            switch ($event) {
                case 'created':
                case 'updated':
                case 'published':
                    $result = $this->handle_content_upsert($content_id, $content_data);
                    break;
                    
                case 'deleted':
                case 'unpublished':
                    $result = $this->handle_content_delete($content_id);
                    break;
                    
                default:
                    return new WP_Error('unknown_event', __('Unknown webhook event.', 'wp-headless-cms-bridge'), array('status' => 400));
            }

            if (is_wp_error($result)) {
                $this->log_webhook_error('processing_failed', $result->get_error_message(), array(
                    'event' => $event,
                    'content_id' => $content_id
                ));
                
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => $result->get_error_message()
                ), 400);
            }

            return new WP_REST_Response(array(
                'success' => true,
                'message' => __('Webhook processed successfully.', 'wp-headless-cms-bridge'),
                'post_id' => $result
            ), 200);

        } catch (Exception $e) {
            $this->log_webhook_error('exception', $e->getMessage(), array(
                'event' => $event,
                'content_id' => $content_id,
                'trace' => $e->getTraceAsString()
            ));
            
            return new WP_REST_Response(array(
                'success' => false,
                'message' => __('Internal server error processing webhook.', 'wp-headless-cms-bridge')
            ), 500);
        }
    }

    /**
     * Handle media webhook.
     *
     * @since    1.0.0
     * @param    WP_REST_Request    $request    The REST request.
     * @return   WP_REST_Response              The response.
     */
    public function handle_media_webhook($request) {
        
        $event = $request->get_param('event');
        $media_id = $request->get_param('media_id');
        $media_data = $request->get_param('media');

        $this->log_webhook_event('media', $event, $media_id);

        try {
            switch ($event) {
                case 'uploaded':
                case 'updated':
                    $result = $this->handle_media_upsert($media_id, $media_data);
                    break;
                    
                case 'deleted':
                    $result = $this->handle_media_delete($media_id);
                    break;
                    
                default:
                    return new WP_Error('unknown_event', __('Unknown media webhook event.', 'wp-headless-cms-bridge'), array('status' => 400));
            }

            if (is_wp_error($result)) {
                $this->log_webhook_error('media_processing_failed', $result->get_error_message(), array(
                    'event' => $event,
                    'media_id' => $media_id
                ));
                
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => $result->get_error_message()
                ), 400);
            }

            return new WP_REST_Response(array(
                'success' => true,
                'message' => __('Media webhook processed successfully.', 'wp-headless-cms-bridge'),
                'attachment_id' => $result
            ), 200);

        } catch (Exception $e) {
            $this->log_webhook_error('media_exception', $e->getMessage(), array(
                'event' => $event,
                'media_id' => $media_id,
                'trace' => $e->getTraceAsString()
            ));
            
            return new WP_REST_Response(array(
                'success' => false,
                'message' => __('Internal server error processing media webhook.', 'wp-headless-cms-bridge')
            ), 500);
        }
    }

    /**
     * Handle webhook health check.
     *
     * @since    1.0.0
     * @param    WP_REST_Request    $request    The REST request.
     * @return   WP_REST_Response              The response.
     */
    public function handle_health_check($request) {
        return new WP_REST_Response(array(
            'status' => 'healthy',
            'plugin' => 'wp-headless-cms-bridge',
            'version' => $this->version,
            'timestamp' => current_time('mysql'),
            'webhook_endpoints' => array(
                'content' => rest_url('wp-headless-cms-bridge/v1/webhook/content'),
                'media' => rest_url('wp-headless-cms-bridge/v1/webhook/media'),
                'health' => rest_url('wp-headless-cms-bridge/v1/webhook/health')
            ),
            'sync_enabled' => get_option('wp_headless_cms_bridge_sync_enabled', false),
            'sync_direction' => get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms')
        ), 200);
    }

    /**
     * Handle content creation/update from webhook.
     *
     * @since    1.0.0
     * @param    string    $cms_id         The CMS content ID.
     * @param    array     $content_data   The content data.
     * @return   int|WP_Error              WordPress post ID or error.
     */
    private function handle_content_upsert($cms_id, $content_data) {
        
        // Check if sync direction allows CMS to WP
        $sync_direction = get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms');
        if (!in_array($sync_direction, array('cms_to_wp', 'bidirectional'))) {
            return new WP_Error('sync_disabled', __('CMS to WordPress sync is disabled.', 'wp-headless-cms-bridge'));
        }

        if (empty($content_data)) {
            return new WP_Error('no_content_data', __('No content data provided in webhook.', 'wp-headless-cms-bridge'));
        }

        return $this->content_sync->sync_cms_to_wp($cms_id, $content_data);
    }

    /**
     * Handle content deletion from webhook.
     *
     * @since    1.0.0
     * @param    string    $cms_id    The CMS content ID.
     * @return   bool|WP_Error        Success or error.
     */
    private function handle_content_delete($cms_id) {
        
        // Check if sync direction allows CMS to WP
        $sync_direction = get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms');
        if (!in_array($sync_direction, array('cms_to_wp', 'bidirectional'))) {
            return new WP_Error('sync_disabled', __('CMS to WordPress sync is disabled.', 'wp-headless-cms-bridge'));
        }

        // Find the WordPress post by CMS ID
        $posts = get_posts(array(
            'meta_key' => '_headless_cms_id',
            'meta_value' => $cms_id,
            'post_type' => 'any',
            'post_status' => 'any',
            'numberposts' => 1
        ));

        if (empty($posts)) {
            return new WP_Error('post_not_found', __('WordPress post not found for CMS content.', 'wp-headless-cms-bridge'));
        }

        $post = $posts[0];
        
        // Move to trash instead of permanent deletion
        $result = wp_trash_post($post->ID);
        
        if (!$result) {
            return new WP_Error('delete_failed', __('Failed to delete WordPress post.', 'wp-headless-cms-bridge'));
        }

        return $post->ID;
    }

    /**
     * Handle media creation/update from webhook.
     *
     * @since    1.0.0
     * @param    string    $cms_media_id    The CMS media ID.
     * @param    array     $media_data      The media data.
     * @return   int|WP_Error               WordPress attachment ID or error.
     */
    private function handle_media_upsert($cms_media_id, $media_data) {
        
        if (empty($media_data) || empty($media_data['url'])) {
            return new WP_Error('no_media_data', __('No media data or URL provided in webhook.', 'wp-headless-cms-bridge'));
        }

        // Check if this media already exists
        $existing_attachments = get_posts(array(
            'meta_key' => '_headless_cms_media_id',
            'meta_value' => $cms_media_id,
            'post_type' => 'attachment',
            'post_status' => 'any',
            'numberposts' => 1
        ));

        if (!empty($existing_attachments)) {
            // Update existing attachment metadata
            $attachment_id = $existing_attachments[0]->ID;
            $this->update_attachment_metadata($attachment_id, $media_data);
            return $attachment_id;
        }

        // Download and create new attachment
        return $this->create_attachment_from_url($media_data['url'], $media_data, $cms_media_id);
    }

    /**
     * Handle media deletion from webhook.
     *
     * @since    1.0.0
     * @param    string    $cms_media_id    The CMS media ID.
     * @return   bool|WP_Error              Success or error.
     */
    private function handle_media_delete($cms_media_id) {
        
        // Find the WordPress attachment by CMS media ID
        $attachments = get_posts(array(
            'meta_key' => '_headless_cms_media_id',
            'meta_value' => $cms_media_id,
            'post_type' => 'attachment',
            'post_status' => 'any',
            'numberposts' => 1
        ));

        if (empty($attachments)) {
            return new WP_Error('attachment_not_found', __('WordPress attachment not found for CMS media.', 'wp-headless-cms-bridge'));
        }

        $attachment = $attachments[0];
        
        // Delete the attachment
        $result = wp_delete_attachment($attachment->ID, true);
        
        if (!$result) {
            return new WP_Error('delete_failed', __('Failed to delete WordPress attachment.', 'wp-headless-cms-bridge'));
        }

        return true;
    }

    /**
     * Create WordPress attachment from URL.
     *
     * @since    1.0.0
     * @param    string    $url              The media URL.
     * @param    array     $media_data       The media data.
     * @param    string    $cms_media_id     The CMS media ID.
     * @return   int|WP_Error                WordPress attachment ID or error.
     */
    private function create_attachment_from_url($url, $media_data, $cms_media_id) {
        
        if (!function_exists('media_sideload_image')) {
            require_once(ABSPATH . 'wp-admin/includes/media.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/image.php');
        }

        // Download the file
        $temp_file = download_url($url);
        
        if (is_wp_error($temp_file)) {
            return $temp_file;
        }

        // Get file info
        $file_array = array(
            'name' => isset($media_data['filename']) ? $media_data['filename'] : basename($url),
            'tmp_name' => $temp_file
        );

        // Create the attachment
        $attachment_id = media_handle_sideload($file_array, 0, isset($media_data['caption']) ? $media_data['caption'] : '');

        // Clean up temp file
        if (!is_wp_error($attachment_id)) {
            @unlink($temp_file);
        }

        if (is_wp_error($attachment_id)) {
            @unlink($temp_file);
            return $attachment_id;
        }

        // Update attachment metadata
        update_post_meta($attachment_id, '_headless_cms_media_id', $cms_media_id);
        
        if (isset($media_data['alt'])) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $media_data['alt']);
        }

        return $attachment_id;
    }

    /**
     * Update attachment metadata.
     *
     * @since    1.0.0
     * @param    int      $attachment_id    The attachment ID.
     * @param    array    $media_data       The media data.
     */
    private function update_attachment_metadata($attachment_id, $media_data) {
        
        if (isset($media_data['alt'])) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $media_data['alt']);
        }

        if (isset($media_data['caption'])) {
            wp_update_post(array(
                'ID' => $attachment_id,
                'post_excerpt' => $media_data['caption']
            ));
        }
    }

    /**
     * Log webhook event.
     *
     * @since    1.0.0
     * @param    string    $type      Event type (content, media).
     * @param    string    $event     Event name.
     * @param    string    $id        Content/media ID.
     */
    private function log_webhook_event($type, $event, $id) {
        if (!get_option('wp_headless_cms_bridge_log_enabled', true)) {
            return;
        }

        error_log("[WP Headless CMS Bridge] Webhook received: {$type}.{$event} for ID {$id}");
    }

    /**
     * Log webhook error.
     *
     * @since    1.0.0
     * @param    string    $error_code    Error code.
     * @param    string    $message       Error message.
     * @param    array     $context       Additional context.
     */
    private function log_webhook_error($error_code, $message, $context = array()) {
        if (!get_option('wp_headless_cms_bridge_log_enabled', true)) {
            return;
        }

        $log_message = "[WP Headless CMS Bridge] Webhook error ({$error_code}): {$message}";
        
        if (!empty($context)) {
            $log_message .= ' | Context: ' . json_encode($context);
        }

        error_log($log_message);
    }

    /**
     * Get webhook URLs for CMS configuration.
     *
     * @since    1.0.0
     * @return   array    Webhook URLs.
     */
    public function get_webhook_urls() {
        return array(
            'content' => rest_url('wp-headless-cms-bridge/v1/webhook/content'),
            'media' => rest_url('wp-headless-cms-bridge/v1/webhook/media'),
            'health' => rest_url('wp-headless-cms-bridge/v1/webhook/health')
        );
    }

}