<?php
/**
 * Plugin Name: Headless CMS Bridge - Safe Version
 * Plugin URI: https://github.com/your-org/wp-headless-cms-bridge
 * Description: Safe version of the Headless CMS Bridge plugin with careful loading.
 * Version: 1.0.3
 * Author: CMS Automation Team
 * Author URI: https://cms-automation.com
 * License: GPL v2 or later
 * Text Domain: wp-headless-cms-bridge
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('WP_HEADLESS_CMS_BRIDGE_SAFE_VERSION', '1.0.3');
define('WP_HEADLESS_CMS_BRIDGE_SAFE_FILE', __FILE__);
define('WP_HEADLESS_CMS_BRIDGE_SAFE_DIR', plugin_dir_path(__FILE__));
define('WP_HEADLESS_CMS_BRIDGE_SAFE_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class WP_Headless_CMS_Bridge_Safe {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }
    
    public function init() {
        // Safe initialization
        error_log('WP Headless CMS Bridge Safe: Initialized successfully');
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Headless CMS Bridge',
            'CMS Bridge',
            'manage_options',
            'wp-headless-cms-bridge-safe',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        echo '<div class="wrap">';
        echo '<h1>Headless CMS Bridge - Safe Version</h1>';
        echo '<p>This is a minimal safe version of the plugin.</p>';
        echo '<p>Version: ' . WP_HEADLESS_CMS_BRIDGE_SAFE_VERSION . '</p>';
        echo '<p>Status: Plugin loaded successfully!</p>';
        echo '</div>';
    }
    
    public static function activate() {
        error_log('WP Headless CMS Bridge Safe: Plugin activated');
        add_option('wp_headless_cms_bridge_safe_version', WP_HEADLESS_CMS_BRIDGE_SAFE_VERSION);
    }
    
    public static function deactivate() {
        error_log('WP Headless CMS Bridge Safe: Plugin deactivated');
    }
}

// Activation/deactivation hooks
register_activation_hook(__FILE__, array('WP_Headless_CMS_Bridge_Safe', 'activate'));
register_deactivation_hook(__FILE__, array('WP_Headless_CMS_Bridge_Safe', 'deactivate'));

// Initialize plugin only when WordPress is ready
function wp_headless_cms_bridge_safe_init() {
    WP_Headless_CMS_Bridge_Safe::get_instance();
}
add_action('plugins_loaded', 'wp_headless_cms_bridge_safe_init');