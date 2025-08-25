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

}