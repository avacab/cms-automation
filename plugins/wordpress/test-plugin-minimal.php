<?php
/**
 * Plugin Name: Test Minimal Plugin
 * Version: 1.0.0
 * Description: Minimal test plugin to check for activation issues.
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

// Simple activation function for testing
function activate_test_minimal() {
    // Just log that activation was called
    error_log('Test Minimal Plugin: Activation hook called');
}

register_activation_hook(__FILE__, 'activate_test_minimal');

// Simple init function
function init_test_minimal() {
    error_log('Test Minimal Plugin: Init hook called');
}

add_action('init', 'init_test_minimal');