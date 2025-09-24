<?php
/**
 * Plugin Name: Headless CMS Bridge - Debug Version
 * Version: 1.0.3-debug
 * Description: Debug version to identify problematic files.
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Safe activation
register_activation_hook(__FILE__, function() {
    error_log('DEBUG: Plugin activation started');
    add_option('wp_headless_cms_bridge_debug_activated', true);
    error_log('DEBUG: Plugin activation completed');
});

// Initialize after WordPress is loaded
add_action('plugins_loaded', function() {
    error_log('DEBUG: Starting to load classes...');
    
    $includes_dir = plugin_dir_path(__FILE__) . 'wp-headless-cms-bridge/includes/';
    
    // Test loading each class individually
    $classes = array(
        'class-loader.php',
        'class-i18n.php', 
        'class-admin.php',
        'class-public.php',
        'class-api-client.php',
        'class-content-sync.php',
        'class-webhook-handler.php',
        'class-admin-settings.php'
    );
    
    foreach ($classes as $class_file) {
        $file_path = $includes_dir . $class_file;
        if (file_exists($file_path)) {
            error_log("DEBUG: Loading $class_file...");
            try {
                require_once $file_path;
                error_log("DEBUG: Successfully loaded $class_file");
            } catch (Exception $e) {
                error_log("DEBUG: ERROR loading $class_file: " . $e->getMessage());
                return; // Stop loading on first error
            } catch (ParseError $e) {
                error_log("DEBUG: PARSE ERROR in $class_file: " . $e->getMessage());
                return; // Stop loading on first error
            }
        } else {
            error_log("DEBUG: File not found: $file_path");
        }
    }
    
    error_log('DEBUG: All classes loaded successfully');
    
    // Try to load the main plugin class
    $plugin_file = $includes_dir . 'class-plugin.php';
    if (file_exists($plugin_file)) {
        error_log('DEBUG: Loading main plugin class...');
        try {
            require_once $plugin_file;
            error_log('DEBUG: Main plugin class loaded successfully');
        } catch (Exception $e) {
            error_log("DEBUG: ERROR loading main plugin class: " . $e->getMessage());
        }
    }
});