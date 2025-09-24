<?php
/**
 * Plugin Name: Headless CMS Bridge - Minimal Test
 * Version: 1.0.2-minimal
 * Description: Minimal version to test activation issues.
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

// Simple activation function
function activate_wp_headless_cms_bridge_minimal() {
    error_log('Minimal Plugin: Activation successful');
    add_option('wp_headless_cms_bridge_minimal_activated', true);
}

// Simple deactivation function
function deactivate_wp_headless_cms_bridge_minimal() {
    error_log('Minimal Plugin: Deactivation successful');
    delete_option('wp_headless_cms_bridge_minimal_activated');
}

// Register hooks
register_activation_hook(__FILE__, 'activate_wp_headless_cms_bridge_minimal');
register_deactivation_hook(__FILE__, 'deactivate_wp_headless_cms_bridge_minimal');

// Simple init function
function init_wp_headless_cms_bridge_minimal() {
    if (is_admin()) {
        add_action('admin_notices', function() {
            echo '<div class="notice notice-success"><p>Headless CMS Bridge Minimal Test is active!</p></div>';
        });
    }
}

// Initialize only when WordPress is ready
add_action('plugins_loaded', 'init_wp_headless_cms_bridge_minimal');