<?php
/**
 * The admin-specific functionality of the plugin.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_Admin {

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
     * Initialize the admin functionality.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    The plugin name.
     * @param    string    $version        The plugin version.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
    }

    /**
     * Register the stylesheets for the admin area.
     *
     * @since    1.0.0
     */
    public function enqueue_styles() {
        wp_enqueue_style(
            $this->plugin_name,
            WP_HEADLESS_CMS_BRIDGE_PLUGIN_URL . 'admin/css/admin-styles.css',
            array(),
            $this->version,
            'all'
        );
    }

    /**
     * Register the JavaScript for the admin area.
     *
     * @since    1.0.0
     */
    public function enqueue_scripts() {
        wp_enqueue_script(
            $this->plugin_name,
            WP_HEADLESS_CMS_BRIDGE_PLUGIN_URL . 'admin/js/admin-scripts.js',
            array('jquery'),
            $this->version,
            false
        );

        // Localize script with AJAX URL and nonces
        wp_localize_script(
            $this->plugin_name,
            'wpHeadlessCMSBridge',
            array(
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonces' => array(
                    'testConnection' => wp_create_nonce('wp_headless_cms_bridge_test_connection'),
                    'regenerateSecret' => wp_create_nonce('wp_headless_cms_bridge_regenerate_secret'),
                    'syncAll' => wp_create_nonce('wp_headless_cms_bridge_sync_all')
                ),
                'strings' => array(
                    'testing' => __('Testing connection...', 'wp-headless-cms-bridge'),
                    'success' => __('Success!', 'wp-headless-cms-bridge'),
                    'error' => __('Error:', 'wp-headless-cms-bridge'),
                    'regenerating' => __('Regenerating...', 'wp-headless-cms-bridge'),
                    'syncing' => __('Starting sync...', 'wp-headless-cms-bridge')
                )
            )
        );
    }

    /**
     * Register AJAX handlers.
     *
     * @since    1.0.0
     */
    public function register_ajax_handlers() {
        add_action('wp_ajax_wp_headless_cms_bridge_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_wp_headless_cms_bridge_regenerate_secret', array($this, 'ajax_regenerate_secret'));
        add_action('wp_ajax_wp_headless_cms_bridge_sync_all', array($this, 'ajax_sync_all'));
    }

    /**
     * AJAX handler for testing API connection.
     *
     * @since    1.0.0
     */
    public function ajax_test_connection() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'wp_headless_cms_bridge_test_connection')) {
            wp_die('Security check failed');
        }

        // Check user capabilities
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }

        $api_url = sanitize_url($_POST['api_url']);
        $api_key = sanitize_text_field($_POST['api_key']);

        if (empty($api_url)) {
            wp_send_json_error(array('message' => __('API URL is required.', 'wp-headless-cms-bridge')));
            return;
        }

        // Create temporary API client for testing
        $api_client = new WP_Headless_CMS_Bridge_API_Client($this->plugin_name, $this->version, $api_url, $api_key);
        
        // Test connection by calling health endpoint
        $test_url = rtrim($api_url, '/') . '/health';
        
        $response = wp_remote_get($test_url, array(
            'timeout' => 10,
            'headers' => array(
                'User-Agent' => 'WordPress/' . get_bloginfo('version') . '; ' . get_site_url()
            )
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => sprintf(__('Connection failed: %s', 'wp-headless-cms-bridge'), $response->get_error_message())));
            return;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        if ($response_code === 200) {
            $data = json_decode($response_body, true);
            if ($data && isset($data['status']) && $data['status'] === 'healthy') {
                wp_send_json_success(array('message' => __('Connection successful! API is responding normally.', 'wp-headless-cms-bridge')));
            } else {
                wp_send_json_error(array('message' => __('API responded but health check failed.', 'wp-headless-cms-bridge')));
            }
        } else {
            wp_send_json_error(array('message' => sprintf(__('HTTP Error %d: %s', 'wp-headless-cms-bridge'), $response_code, $response_body)));
        }
    }

    /**
     * AJAX handler for regenerating webhook secret.
     *
     * @since    1.0.0
     */
    public function ajax_regenerate_secret() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'wp_headless_cms_bridge_regenerate_secret')) {
            wp_die('Security check failed');
        }

        // Check user capabilities
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }

        // Generate new secret
        $new_secret = wp_generate_password(32, false);
        
        // Update option
        $settings = get_option('wp_headless_cms_bridge_settings', array());
        $settings['webhook_secret'] = $new_secret;
        update_option('wp_headless_cms_bridge_settings', $settings);

        wp_send_json_success(array(
            'message' => __('Webhook secret regenerated successfully.', 'wp-headless-cms-bridge'),
            'secret' => $new_secret
        ));
    }

    /**
     * AJAX handler for syncing all content.
     *
     * @since    1.0.0
     */
    public function ajax_sync_all() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'wp_headless_cms_bridge_sync_all')) {
            wp_die('Security check failed');
        }

        // Check user capabilities
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }

        // Get settings
        $settings = get_option('wp_headless_cms_bridge_settings', array());
        
        if (empty($settings['api_url'])) {
            wp_send_json_error(array('message' => __('API URL not configured.', 'wp-headless-cms-bridge')));
            return;
        }

        // Initialize sync service
        $sync_service = new WP_Headless_CMS_Bridge_Content_Sync($this->plugin_name, $this->version);
        
        // Get posts to sync
        $post_types = isset($settings['post_types']) ? $settings['post_types'] : array('post', 'page');
        
        $posts = get_posts(array(
            'post_type' => $post_types,
            'post_status' => 'publish',
            'numberposts' => -1
        ));

        $synced = 0;
        $failed = 0;

        foreach ($posts as $post) {
            $result = $sync_service->sync_post_to_cms($post->ID);
            if ($result['success']) {
                $synced++;
            } else {
                $failed++;
            }
        }

        $message = sprintf(
            __('Sync completed: %d successful, %d failed', 'wp-headless-cms-bridge'),
            $synced,
            $failed
        );

        wp_send_json_success(array('message' => $message));
    }

}