<?php
/**
 * Plugin Name: Headless CMS Bridge
 * Plugin URI: https://github.com/your-org/wp-headless-cms-bridge
 * Description: Bridge WordPress with headless CMS systems for seamless content synchronization and management.
 * Version: 1.0.3
 * Author: CMS Automation Team
 * Author URI: https://cms-automation.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-headless-cms-bridge
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 *
 * @package WP_Headless_CMS_Bridge
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

// Plugin version
define('WP_HEADLESS_CMS_BRIDGE_VERSION', '1.0.3');

// Plugin paths
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_FILE', __FILE__);
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR', WP_HEADLESS_CMS_BRIDGE_PLUGIN_DIR . 'includes/');

/**
 * The code that runs during plugin activation.
 */
function activate_wp_headless_cms_bridge() {
    // Very minimal activation - just log and set a flag
    error_log('WP Headless CMS Bridge: Activation hook called');
    add_option('wp_headless_cms_bridge_needs_activation_init', true, '', 'no');
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivate_wp_headless_cms_bridge() {
    error_log('WP Headless CMS Bridge: Deactivation hook called');
    // Clean up activation flag
    delete_option('wp_headless_cms_bridge_needs_activation_init');
}

/**
 * The code that runs during plugin uninstallation.
 */
function uninstall_wp_headless_cms_bridge() {
    error_log('WP Headless CMS Bridge: Uninstall hook called');
    // Only clean up basic options during uninstall
    delete_option('wp_headless_cms_bridge_needs_activation_init');
}

// Register activation, deactivation and uninstall hooks
register_activation_hook(__FILE__, 'activate_wp_headless_cms_bridge');
register_deactivation_hook(__FILE__, 'deactivate_wp_headless_cms_bridge');
register_uninstall_hook(__FILE__, 'uninstall_wp_headless_cms_bridge');

/**
 * Begins execution of the plugin.
 *
 * @since 1.0.0
 */
function run_wp_headless_cms_bridge() {
    error_log('WP Headless CMS Bridge: Starting plugin initialization');
    
    try {
        // Check if we can safely load classes
        if (!class_exists('WP_Headless_CMS_Bridge_Plugin')) {
            $plugin_file = WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-plugin.php';
            if (file_exists($plugin_file)) {
                require_once $plugin_file;
                error_log('WP Headless CMS Bridge: Main plugin class loaded');
            } else {
                error_log('WP Headless CMS Bridge: ERROR - Main plugin class file not found');
                return;
            }
        }
        
        // Initialize the plugin
        $plugin = new WP_Headless_CMS_Bridge_Plugin();
        $plugin->run();
        
        error_log('WP Headless CMS Bridge: Plugin initialized successfully');
        
    } catch (Exception $e) {
        error_log('WP Headless CMS Bridge: FATAL ERROR during initialization: ' . $e->getMessage());
        // Don't rethrow the exception to prevent site crashes
    } catch (ParseError $e) {
        error_log('WP Headless CMS Bridge: PARSE ERROR during initialization: ' . $e->getMessage());
    }
}

// Initialize the plugin only after WordPress is fully loaded
add_action('plugins_loaded', 'run_wp_headless_cms_bridge', 10);