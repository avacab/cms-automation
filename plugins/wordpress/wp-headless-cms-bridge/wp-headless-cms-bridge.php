<?php
/**
 * Plugin Name: Headless CMS Bridge
 * Plugin URI: https://github.com/your-org/wp-headless-cms-bridge
 * Description: Bridge WordPress with headless CMS systems for seamless content synchronization and management.
 * Version: 1.0.1
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
define('WP_HEADLESS_CMS_BRIDGE_VERSION', '1.0.1');

// Plugin paths
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_FILE', __FILE__);
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WP_HEADLESS_CMS_BRIDGE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR', WP_HEADLESS_CMS_BRIDGE_PLUGIN_DIR . 'includes/');

/**
 * The code that runs during plugin activation.
 */
function activate_wp_headless_cms_bridge() {
    require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-plugin.php';
    WP_Headless_CMS_Bridge_Plugin::activate();
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivate_wp_headless_cms_bridge() {
    require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-plugin.php';
    WP_Headless_CMS_Bridge_Plugin::deactivate();
}

/**
 * The code that runs during plugin uninstallation.
 */
function uninstall_wp_headless_cms_bridge() {
    require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-plugin.php';
    WP_Headless_CMS_Bridge_Plugin::uninstall();
}

// Register activation, deactivation and uninstall hooks
register_activation_hook(__FILE__, 'activate_wp_headless_cms_bridge');
register_deactivation_hook(__FILE__, 'deactivate_wp_headless_cms_bridge');
register_uninstall_hook(__FILE__, 'uninstall_wp_headless_cms_bridge');

/**
 * Begins execution of the plugin.
 *
 * Since everything within the plugin is registered via hooks,
 * then kicking off the plugin from this point in the file does
 * not affect the page life cycle.
 *
 * @since 1.0.0
 */
function run_wp_headless_cms_bridge() {
    
    // Load the core plugin class
    require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-plugin.php';
    
    // Initialize the plugin
    $plugin = new WP_Headless_CMS_Bridge_Plugin();
    $plugin->run();
}

// Initialize the plugin
run_wp_headless_cms_bridge();