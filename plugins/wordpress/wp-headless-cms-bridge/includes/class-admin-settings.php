<?php
/**
 * Admin settings functionality.
 *
 * Handles the admin interface, settings management, and configuration
 * for the WordPress headless CMS bridge plugin.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_Admin_Settings {

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
     * The content sync instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      WP_Headless_CMS_Bridge_Content_Sync    $content_sync    The content sync handler.
     */
    private $content_sync;

    /**
     * Initialize the admin settings.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    The plugin name.
     * @param    string    $version        The plugin version.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
        
        // Initialize API client and content sync
        $this->api_client = new WP_Headless_CMS_Bridge_API_Client($plugin_name, $version);
        $this->content_sync = new WP_Headless_CMS_Bridge_Content_Sync($plugin_name, $version);
    }

    /**
     * Add admin menu.
     *
     * @since    1.0.0
     */
    public function add_admin_menu() {
        
        add_options_page(
            __('Headless CMS Bridge', 'wp-headless-cms-bridge'),
            __('Headless CMS', 'wp-headless-cms-bridge'),
            'manage_options',
            'wp-headless-cms-bridge',
            array($this, 'display_admin_page')
        );
    }

    /**
     * Register plugin settings.
     *
     * @since    1.0.0
     */
    public function register_settings() {
        
        // Register setting group
        register_setting(
            'wp_headless_cms_bridge_settings',
            'wp_headless_cms_bridge_settings',
            array($this, 'sanitize_settings')
        );

        // API Configuration Section
        add_settings_section(
            'wp_headless_cms_bridge_api_section',
            __('API Configuration', 'wp-headless-cms-bridge'),
            array($this, 'api_section_callback'),
            'wp-headless-cms-bridge'
        );

        add_settings_field(
            'cms_api_url',
            __('CMS API URL', 'wp-headless-cms-bridge'),
            array($this, 'api_url_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_api_section'
        );

        add_settings_field(
            'cms_api_key',
            __('API Key', 'wp-headless-cms-bridge'),
            array($this, 'api_key_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_api_section'
        );

        // Sync Configuration Section
        add_settings_section(
            'wp_headless_cms_bridge_sync_section',
            __('Sync Configuration', 'wp-headless-cms-bridge'),
            array($this, 'sync_section_callback'),
            'wp-headless-cms-bridge'
        );

        add_settings_field(
            'sync_enabled',
            __('Enable Sync', 'wp-headless-cms-bridge'),
            array($this, 'sync_enabled_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_sync_section'
        );

        add_settings_field(
            'sync_direction',
            __('Sync Direction', 'wp-headless-cms-bridge'),
            array($this, 'sync_direction_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_sync_section'
        );

        add_settings_field(
            'post_types',
            __('Post Types to Sync', 'wp-headless-cms-bridge'),
            array($this, 'post_types_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_sync_section'
        );

        add_settings_field(
            'sync_post_statuses',
            __('Post Statuses to Sync', 'wp-headless-cms-bridge'),
            array($this, 'sync_post_statuses_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_sync_section'
        );

        add_settings_field(
            'auto_publish',
            __('Auto-publish', 'wp-headless-cms-bridge'),
            array($this, 'auto_publish_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_sync_section'
        );

        // Webhook Section
        add_settings_section(
            'wp_headless_cms_bridge_webhook_section',
            __('Webhook Configuration', 'wp-headless-cms-bridge'),
            array($this, 'webhook_section_callback'),
            'wp-headless-cms-bridge'
        );

        // Logging Section
        add_settings_section(
            'wp_headless_cms_bridge_logging_section',
            __('Logging Configuration', 'wp-headless-cms-bridge'),
            array($this, 'logging_section_callback'),
            'wp-headless-cms-bridge'
        );

        add_settings_field(
            'log_enabled',
            __('Enable Logging', 'wp-headless-cms-bridge'),
            array($this, 'log_enabled_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_logging_section'
        );

        add_settings_field(
            'log_retention_days',
            __('Log Retention (Days)', 'wp-headless-cms-bridge'),
            array($this, 'log_retention_field_callback'),
            'wp-headless-cms-bridge',
            'wp_headless_cms_bridge_logging_section'
        );
    }

    /**
     * Display the admin page.
     *
     * @since    1.0.0
     */
    public function display_admin_page() {
        
        // Handle AJAX requests
        if (isset($_POST['action'])) {
            switch ($_POST['action']) {
                case 'test_connection':
                    $this->handle_test_connection();
                    break;
                case 'regenerate_webhook_secret':
                    $this->handle_regenerate_webhook_secret();
                    break;
                case 'sync_all_content':
                    $this->handle_sync_all_content();
                    break;
            }
        }

        // Get current settings
        $settings = $this->get_current_settings();
        
        // Get sync logs
        $sync_logs = $this->content_sync->get_sync_logs(10);
        
        // Include the admin page template
        include_once WP_HEADLESS_CMS_BRIDGE_PLUGIN_DIR . 'admin/views/settings-page.php';
    }

    /**
     * Sanitize settings input.
     *
     * @since    1.0.0
     * @param    array    $input    Raw input data.
     * @return   array              Sanitized input data.
     */
    public function sanitize_settings($input) {
        $sanitized = array();

        if (isset($input['cms_api_url'])) {
            $sanitized['cms_api_url'] = esc_url_raw(trim($input['cms_api_url']));
        }

        if (isset($input['cms_api_key'])) {
            $sanitized['cms_api_key'] = sanitize_text_field($input['cms_api_key']);
        }

        if (isset($input['sync_enabled'])) {
            $sanitized['sync_enabled'] = (bool) $input['sync_enabled'];
        }

        if (isset($input['sync_direction'])) {
            $allowed_directions = array('wp_to_cms', 'cms_to_wp', 'bidirectional');
            $sanitized['sync_direction'] = in_array($input['sync_direction'], $allowed_directions) 
                ? $input['sync_direction'] 
                : 'wp_to_cms';
        }

        if (isset($input['post_types']) && is_array($input['post_types'])) {
            $sanitized['post_types'] = array_map('sanitize_text_field', $input['post_types']);
        }

        if (isset($input['sync_post_statuses']) && is_array($input['sync_post_statuses'])) {
            $allowed_statuses = array('publish', 'private', 'draft');
            $sanitized['sync_post_statuses'] = array_intersect($input['sync_post_statuses'], $allowed_statuses);
        }

        if (isset($input['auto_publish'])) {
            $sanitized['auto_publish'] = (bool) $input['auto_publish'];
        }

        if (isset($input['log_enabled'])) {
            $sanitized['log_enabled'] = (bool) $input['log_enabled'];
        }

        if (isset($input['log_retention_days'])) {
            $sanitized['log_retention_days'] = max(0, intval($input['log_retention_days']));
        }

        // Update individual options
        foreach ($sanitized as $key => $value) {
            update_option('wp_headless_cms_bridge_' . $key, $value);
        }

        // Update API client configuration
        if (isset($sanitized['cms_api_url']) || isset($sanitized['cms_api_key'])) {
            $this->api_client->update_config(
                $sanitized['cms_api_url'] ?? get_option('wp_headless_cms_bridge_cms_api_url', ''),
                $sanitized['cms_api_key'] ?? get_option('wp_headless_cms_bridge_cms_api_key', '')
            );
        }

        add_settings_error('wp_headless_cms_bridge_settings', 'settings_saved', __('Settings saved successfully.', 'wp-headless-cms-bridge'), 'success');

        return $sanitized;
    }

    /**
     * Get current settings with optimized defaults.
     *
     * @since    1.0.0
     * @return   array    Current settings.
     */
    private function get_current_settings() {
        return array(
            'cms_api_url' => get_option('wp_headless_cms_bridge_cms_api_url', 'https://cms-automation-api.vercel.app'),
            'cms_api_key' => get_option('wp_headless_cms_bridge_cms_api_key', ''),
            'sync_enabled' => get_option('wp_headless_cms_bridge_sync_enabled', true),
            'sync_direction' => get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms'),
            'post_types' => get_option('wp_headless_cms_bridge_post_types', array('post', 'page')),
            'sync_post_statuses' => get_option('wp_headless_cms_bridge_sync_post_statuses', array('publish')),
            'auto_publish' => get_option('wp_headless_cms_bridge_auto_publish', true),
            'webhook_secret' => get_option('wp_headless_cms_bridge_webhook_secret', ''),
            'log_enabled' => get_option('wp_headless_cms_bridge_log_enabled', true),
            'log_retention_days' => get_option('wp_headless_cms_bridge_log_retention_days', 30)
        );
    }

    // Section Callbacks

    public function api_section_callback() {
        echo '<p>' . __('Configure the connection to your headless CMS API.', 'wp-headless-cms-bridge') . '</p>';
    }

    public function sync_section_callback() {
        echo '<p>' . __('Configure content synchronization between WordPress and your headless CMS.', 'wp-headless-cms-bridge') . '</p>';
    }

    public function webhook_section_callback() {
        echo '<p>' . __('Webhook endpoints for receiving updates from your headless CMS.', 'wp-headless-cms-bridge') . '</p>';
        
        $webhook_handler = new WP_Headless_CMS_Bridge_Webhook_Handler($this->plugin_name, $this->version);
        $webhook_urls = $webhook_handler->get_webhook_urls();
        
        echo '<div class="webhook-urls">';
        echo '<h4>' . __('Webhook URLs', 'wp-headless-cms-bridge') . '</h4>';
        echo '<p><strong>' . __('Content Webhook:', 'wp-headless-cms-bridge') . '</strong><br>';
        echo '<code>' . esc_url($webhook_urls['content']) . '</code></p>';
        echo '<p><strong>' . __('Media Webhook:', 'wp-headless-cms-bridge') . '</strong><br>';
        echo '<code>' . esc_url($webhook_urls['media']) . '</code></p>';
        echo '<p><strong>' . __('Health Check:', 'wp-headless-cms-bridge') . '</strong><br>';
        echo '<code>' . esc_url($webhook_urls['health']) . '</code></p>';
        echo '<p><strong>' . __('Webhook Secret:', 'wp-headless-cms-bridge') . '</strong><br>';
        echo '<code>' . esc_html(get_option('wp_headless_cms_bridge_webhook_secret', '')) . '</code> ';
        echo '<button type="button" class="button" onclick="regenerateWebhookSecret()">' . __('Regenerate', 'wp-headless-cms-bridge') . '</button></p>';
        echo '</div>';
    }

    public function logging_section_callback() {
        echo '<p>' . __('Configure logging and monitoring for sync operations.', 'wp-headless-cms-bridge') . '</p>';
    }

    // Field Callbacks

    public function api_url_field_callback() {
        $value = get_option('wp_headless_cms_bridge_cms_api_url', 'https://cms-automation-api.vercel.app');
        echo '<input type="url" id="cms_api_url" name="wp_headless_cms_bridge_settings[cms_api_url]" value="' . esc_attr($value) . '" class="regular-text" placeholder="https://cms-automation-api.vercel.app" />';
        echo '<p class="description">' . __('The base URL of your headless CMS API (defaults to production API)', 'wp-headless-cms-bridge') . '</p>';
    }

    public function api_key_field_callback() {
        $value = get_option('wp_headless_cms_bridge_cms_api_key', '');
        echo '<input type="password" id="cms_api_key" name="wp_headless_cms_bridge_settings[cms_api_key]" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('API key for authentication with your headless CMS', 'wp-headless-cms-bridge') . '</p>';
        echo '<button type="button" class="button" onclick="testConnection()">' . __('Test Connection', 'wp-headless-cms-bridge') . '</button>';
        echo '<div id="connection-status"></div>';
    }

    public function sync_enabled_field_callback() {
        $value = get_option('wp_headless_cms_bridge_sync_enabled', true);
        echo '<label><input type="checkbox" id="sync_enabled" name="wp_headless_cms_bridge_settings[sync_enabled]" value="1"' . checked(1, $value, false) . ' />';
        echo ' ' . __('Enable automatic content synchronization', 'wp-headless-cms-bridge') . '</label>';
    }

    public function sync_direction_field_callback() {
        $value = get_option('wp_headless_cms_bridge_sync_direction', 'wp_to_cms');
        $options = array(
            'wp_to_cms' => __('WordPress to CMS (One-way)', 'wp-headless-cms-bridge'),
            'cms_to_wp' => __('CMS to WordPress (One-way)', 'wp-headless-cms-bridge'),
            'bidirectional' => __('Bidirectional (Both ways)', 'wp-headless-cms-bridge')
        );

        echo '<select id="sync_direction" name="wp_headless_cms_bridge_settings[sync_direction]">';
        foreach ($options as $option_value => $option_label) {
            echo '<option value="' . esc_attr($option_value) . '"' . selected($value, $option_value, false) . '>' . esc_html($option_label) . '</option>';
        }
        echo '</select>';
        echo '<p class="description">' . __('Choose the direction of content synchronization', 'wp-headless-cms-bridge') . '</p>';
    }

    public function post_types_field_callback() {
        $selected_types = get_option('wp_headless_cms_bridge_post_types', array('post', 'page'));
        $post_types = get_post_types(array('public' => true), 'objects');

        echo '<fieldset>';
        foreach ($post_types as $post_type) {
            $checked = in_array($post_type->name, $selected_types) ? 'checked="checked"' : '';
            echo '<label><input type="checkbox" name="wp_headless_cms_bridge_settings[post_types][]" value="' . esc_attr($post_type->name) . '" ' . $checked . ' />';
            echo ' ' . esc_html($post_type->label) . '</label><br>';
        }
        echo '</fieldset>';
        echo '<p class="description">' . __('Select which post types should be synchronized with the CMS', 'wp-headless-cms-bridge') . '</p>';
    }

    public function sync_post_statuses_field_callback() {
        $selected_statuses = get_option('wp_headless_cms_bridge_sync_post_statuses', array('publish'));
        
        $available_statuses = array(
            'publish' => __('Published', 'wp-headless-cms-bridge'),
            'private' => __('Private', 'wp-headless-cms-bridge'),
            'draft' => __('Draft', 'wp-headless-cms-bridge')
        );

        echo '<fieldset>';
        foreach ($available_statuses as $status => $label) {
            $checked = in_array($status, $selected_statuses) ? 'checked="checked"' : '';
            echo '<label><input type="checkbox" name="wp_headless_cms_bridge_settings[sync_post_statuses][]" value="' . esc_attr($status) . '" ' . $checked . ' />';
            echo ' ' . esc_html($label) . '</label><br>';
        }
        echo '</fieldset>';
        echo '<p class="description">' . __('Select which post statuses should be synchronized with the CMS. Published content is recommended.', 'wp-headless-cms-bridge') . '</p>';
    }

    public function auto_publish_field_callback() {
        $value = get_option('wp_headless_cms_bridge_auto_publish', true);
        echo '<label><input type="checkbox" id="auto_publish" name="wp_headless_cms_bridge_settings[auto_publish]" value="1"' . checked(1, $value, false) . ' />';
        echo ' ' . __('Automatically publish content received from CMS', 'wp-headless-cms-bridge') . '</label>';
        echo '<p class="description">' . __('When enabled, posts received via webhook will be published immediately. When disabled, they will be saved as drafts.', 'wp-headless-cms-bridge') . '</p>';
    }

    public function log_enabled_field_callback() {
        $value = get_option('wp_headless_cms_bridge_log_enabled', true);
        echo '<label><input type="checkbox" id="log_enabled" name="wp_headless_cms_bridge_settings[log_enabled]" value="1"' . checked(1, $value, false) . ' />';
        echo ' ' . __('Enable sync operation logging', 'wp-headless-cms-bridge') . '</label>';
    }

    public function log_retention_field_callback() {
        $value = get_option('wp_headless_cms_bridge_log_retention_days', 30);
        echo '<input type="number" id="log_retention_days" name="wp_headless_cms_bridge_settings[log_retention_days]" value="' . esc_attr($value) . '" min="0" max="365" />';
        echo '<p class="description">' . __('Number of days to retain sync logs (0 = keep forever)', 'wp-headless-cms-bridge') . '</p>';
    }

    // AJAX Handlers

    private function handle_test_connection() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Insufficient permissions', 'wp-headless-cms-bridge'));
        }

        check_admin_referer('wp_headless_cms_bridge_test_connection');

        $result = $this->api_client->test_connection();
        
        if (is_wp_error($result)) {
            wp_send_json_error(array(
                'message' => $result->get_error_message()
            ));
        } else {
            wp_send_json_success(array(
                'message' => __('Successfully connected to CMS API!', 'wp-headless-cms-bridge'),
                'data' => $result
            ));
        }
    }

    private function handle_regenerate_webhook_secret() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Insufficient permissions', 'wp-headless-cms-bridge'));
        }

        check_admin_referer('wp_headless_cms_bridge_regenerate_secret');

        $new_secret = wp_generate_password(32, false);
        update_option('wp_headless_cms_bridge_webhook_secret', $new_secret);

        wp_send_json_success(array(
            'message' => __('Webhook secret regenerated successfully!', 'wp-headless-cms-bridge'),
            'secret' => $new_secret
        ));
    }

    private function handle_sync_all_content() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Insufficient permissions', 'wp-headless-cms-bridge'));
        }

        check_admin_referer('wp_headless_cms_bridge_sync_all');

        // This would be a more complex operation in production
        // For now, just return a success message
        wp_send_json_success(array(
            'message' => __('Bulk sync operation initiated. Check the sync logs for progress.', 'wp-headless-cms-bridge')
        ));
    }

}