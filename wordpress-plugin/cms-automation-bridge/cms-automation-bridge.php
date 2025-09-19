<?php
/**
 * Plugin Name: CMS Automation Bridge
 * Plugin URI: https://github.com/cms-automation/wordpress-bridge
 * Description: Bidirectional content synchronization with headless CMS platform. Features AI-powered content generation, real-time sync, and multi-site management.
 * Version: 1.0.0
 * Author: CMS Automation Team
 * Author URI: https://cms-automation.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: cms-automation-bridge
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('CMS_AUTOMATION_VERSION', '1.0.0');
define('CMS_AUTOMATION_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CMS_AUTOMATION_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('CMS_AUTOMATION_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main plugin class
 */
class CMS_Automation_Bridge {
    
    /**
     * Plugin instance
     */
    private static $instance = null;
    
    /**
     * Get plugin instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        
        // Content sync hooks
        add_action('save_post', array($this, 'sync_post_to_cms'), 10, 2);
        add_action('delete_post', array($this, 'delete_post_from_cms'));
        
        // AJAX hooks for AI content generation
        add_action('wp_ajax_cms_generate_ai_content', array($this, 'ajax_generate_ai_content'));
        add_action('wp_ajax_cms_sync_content', array($this, 'ajax_sync_content'));
        
        // Meta boxes
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        
        // Activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Load plugin textdomain
        load_plugin_textdomain('cms-automation-bridge', false, dirname(plugin_basename(__FILE__)) . '/languages/');
        
        // Include required files
        $this->include_files();
    }
    
    /**
     * Admin initialization
     */
    public function admin_init() {
        // Register settings
        register_setting('cms_automation_settings', 'cms_automation_api_url');
        register_setting('cms_automation_settings', 'cms_automation_api_key');
        register_setting('cms_automation_settings', 'cms_automation_site_id');
        register_setting('cms_automation_settings', 'cms_automation_sync_direction');
        register_setting('cms_automation_settings', 'cms_automation_auto_sync');
        register_setting('cms_automation_settings', 'cms_automation_content_types');
    }
    
    /**
     * Include required files
     */
    private function include_files() {
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/class-api-client.php';
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/class-content-sync.php';
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/class-admin-settings.php';
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/class-ai-content.php';
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('CMS Automation', 'cms-automation-bridge'),
            __('CMS Automation', 'cms-automation-bridge'),
            'manage_options',
            'cms-automation',
            array($this, 'admin_page')
        );
    }
    
    /**
     * Admin page callback
     */
    public function admin_page() {
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/admin-page.php';
    }
    
    /**
     * Enqueue admin scripts and styles
     */
    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'cms-automation') !== false || $hook === 'post.php' || $hook === 'post-new.php') {
            wp_enqueue_style(
                'cms-automation-admin',
                CMS_AUTOMATION_PLUGIN_URL . 'assets/css/admin.css',
                array(),
                CMS_AUTOMATION_VERSION
            );
            
            wp_enqueue_script(
                'cms-automation-admin',
                CMS_AUTOMATION_PLUGIN_URL . 'assets/js/admin.js',
                array('jquery'),
                CMS_AUTOMATION_VERSION,
                true
            );
            
            // Localize script for AJAX
            wp_localize_script('cms-automation-admin', 'cms_automation_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('cms_automation_nonce'),
                'strings' => array(
                    'generating' => __('Generating content...', 'cms-automation-bridge'),
                    'error' => __('Error generating content', 'cms-automation-bridge'),
                    'success' => __('Content generated successfully', 'cms-automation-bridge'),
                )
            ));
        }
    }
    
    /**
     * Add meta boxes
     */
    public function add_meta_boxes() {
        $content_types = get_option('cms_automation_content_types', array('post', 'page'));
        
        foreach ($content_types as $post_type) {
            add_meta_box(
                'cms-automation-sync',
                __('CMS Automation', 'cms-automation-bridge'),
                array($this, 'meta_box_callback'),
                $post_type,
                'side',
                'high'
            );
        }
    }
    
    /**
     * Meta box callback
     */
    public function meta_box_callback($post) {
        wp_nonce_field('cms_automation_meta_box', 'cms_automation_meta_box_nonce');
        
        $sync_enabled = get_post_meta($post->ID, '_cms_automation_sync', true);
        $cms_id = get_post_meta($post->ID, '_cms_automation_id', true);
        $last_sync = get_post_meta($post->ID, '_cms_automation_last_sync', true);
        
        echo '<div class="cms-automation-meta-box">';
        echo '<p>';
        echo '<label>';
        echo '<input type="checkbox" name="cms_automation_sync" value="1" ' . checked($sync_enabled, '1', false) . ' />';
        echo ' ' . __('Sync with CMS Platform', 'cms-automation-bridge');
        echo '</label>';
        echo '</p>';
        
        if ($cms_id) {
            echo '<p><strong>' . __('CMS ID:', 'cms-automation-bridge') . '</strong> ' . esc_html($cms_id) . '</p>';
        }
        
        if ($last_sync) {
            echo '<p><strong>' . __('Last Sync:', 'cms-automation-bridge') . '</strong> ' . date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($last_sync)) . '</p>';
        }
        
        echo '<div class="cms-automation-actions">';
        echo '<button type="button" class="button" id="cms-generate-ai-content">' . __('Generate AI Content', 'cms-automation-bridge') . '</button>';
        echo '<button type="button" class="button" id="cms-force-sync">' . __('Force Sync Now', 'cms-automation-bridge') . '</button>';
        echo '</div>';
        
        echo '<div id="cms-ai-prompt" style="display:none; margin-top:10px;">';
        echo '<textarea name="ai_content_prompt" placeholder="' . __('Enter content prompt for AI generation...', 'cms-automation-bridge') . '" rows="3" style="width:100%;"></textarea>';
        echo '<p>';
        echo '<button type="button" class="button button-primary" id="cms-generate-content">' . __('Generate', 'cms-automation-bridge') . '</button>';
        echo '<button type="button" class="button" id="cms-cancel-ai">' . __('Cancel', 'cms-automation-bridge') . '</button>';
        echo '</p>';
        echo '</div>';
        
        echo '</div>';
    }
    
    /**
     * Sync post to CMS when saved
     */
    public function sync_post_to_cms($post_id, $post) {
        // Skip auto-saves and revisions
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }
        
        // Check if sync is enabled for this post
        $sync_enabled = get_post_meta($post_id, '_cms_automation_sync', true);
        if (!$sync_enabled) {
            return;
        }
        
        // Check if auto-sync is enabled
        $auto_sync = get_option('cms_automation_auto_sync', '1');
        if (!$auto_sync) {
            return;
        }
        
        // Perform sync
        $content_sync = new CMS_Automation_Content_Sync();
        $content_sync->sync_post_to_cms($post_id);
    }
    
    /**
     * Delete post from CMS when deleted in WordPress
     */
    public function delete_post_from_cms($post_id) {
        $cms_id = get_post_meta($post_id, '_cms_automation_id', true);
        if ($cms_id) {
            $content_sync = new CMS_Automation_Content_Sync();
            $content_sync->delete_post_from_cms($cms_id);
        }
    }
    
    /**
     * AJAX handler for AI content generation
     */
    public function ajax_generate_ai_content() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        if (!current_user_can('edit_posts')) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $prompt = sanitize_textarea_field($_POST['prompt']);
        $post_id = intval($_POST['post_id']);
        
        if (empty($prompt)) {
            wp_send_json_error(__('Prompt is required', 'cms-automation-bridge'));
        }
        
        $ai_content = new CMS_Automation_AI_Content();
        $result = $ai_content->generate_content($prompt, $post_id);
        
        if ($result['success']) {
            wp_send_json_success($result['data']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * AJAX handler for manual content sync
     */
    public function ajax_sync_content() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        if (!current_user_can('edit_posts')) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $post_id = intval($_POST['post_id']);
        
        $content_sync = new CMS_Automation_Content_Sync();
        $result = $content_sync->sync_post_to_cms($post_id);
        
        if ($result['success']) {
            wp_send_json_success($result['data']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        add_option('cms_automation_api_url', 'https://cms-automation-api.vercel.app');
        add_option('cms_automation_sync_direction', 'bidirectional');
        add_option('cms_automation_auto_sync', '1');
        add_option('cms_automation_content_types', array('post', 'page'));
        
        // Create database tables if needed
        $this->create_database_tables();
        
        // Schedule cron events
        if (!wp_next_scheduled('cms_automation_sync_check')) {
            wp_schedule_event(time(), 'hourly', 'cms_automation_sync_check');
        }
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clear scheduled events
        wp_clear_scheduled_hook('cms_automation_sync_check');
    }
    
    /**
     * Create database tables
     */
    private function create_database_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'cms_automation_sync_log';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            post_id bigint(20) NOT NULL,
            cms_id varchar(255) NOT NULL,
            action varchar(50) NOT NULL,
            status varchar(50) NOT NULL,
            message text,
            sync_time datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY post_id (post_id),
            KEY cms_id (cms_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
}

// Initialize plugin
add_action('plugins_loaded', array('CMS_Automation_Bridge', 'get_instance'));

/**
 * Get plugin instance
 */
function cms_automation_bridge() {
    return CMS_Automation_Bridge::get_instance();
}