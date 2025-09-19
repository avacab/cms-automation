<?php
/**
 * Admin Settings Class
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CMS_Automation_Admin_Settings {
    
    public function __construct() {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('wp_ajax_cms_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_cms_get_sync_status', array($this, 'ajax_get_sync_status'));
        add_action('wp_ajax_cms_analyze_content', array($this, 'ajax_analyze_content'));
        add_action('wp_ajax_cms_get_writing_suggestions', array($this, 'ajax_get_writing_suggestions'));
    }
    
    /**
     * Register plugin settings
     */
    public function register_settings() {
        // API Settings
        register_setting('cms_automation_settings', 'cms_automation_api_url', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_url',
            'default' => 'https://cms-automation-api.vercel.app'
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_api_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_site_id', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        // Sync Settings
        register_setting('cms_automation_settings', 'cms_automation_sync_direction', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_sync_direction'),
            'default' => 'bidirectional'
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_auto_sync', array(
            'type' => 'boolean',
            'default' => true
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_content_types', array(
            'type' => 'array',
            'sanitize_callback' => array($this, 'sanitize_content_types'),
            'default' => array('post', 'page')
        ));
        
        // AI Settings
        register_setting('cms_automation_settings', 'cms_automation_ai_enabled', array(
            'type' => 'boolean',
            'default' => true
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_ai_auto_suggestions', array(
            'type' => 'boolean',
            'default' => true
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_ai_default_temperature', array(
            'type' => 'number',
            'sanitize_callback' => array($this, 'sanitize_temperature'),
            'default' => 0.7
        ));
        
        register_setting('cms_automation_settings', 'cms_automation_ai_default_length', array(
            'type' => 'integer',
            'sanitize_callback' => array($this, 'sanitize_content_length'),
            'default' => 500
        ));
    }
    
    /**
     * Add settings page to admin menu
     */
    public function add_settings_page() {
        add_submenu_page(
            'options-general.php',
            __('CMS Automation Settings', 'cms-automation-bridge'),
            __('CMS Automation', 'cms-automation-bridge'),
            'manage_options',
            'cms-automation-settings',
            array($this, 'settings_page_callback')
        );
    }
    
    /**
     * Settings page callback
     */
    public function settings_page_callback() {
        if (isset($_POST['submit'])) {
            $this->handle_settings_save();
        }
        
        require_once CMS_AUTOMATION_PLUGIN_PATH . 'includes/admin-settings-page.php';
    }
    
    /**
     * Handle settings save
     */
    private function handle_settings_save() {
        if (!check_admin_referer('cms_automation_settings', 'cms_automation_nonce')) {
            return;
        }
        
        if (!current_user_can('manage_options')) {
            return;
        }
        
        // Save settings
        $fields = array(
            'cms_automation_api_url',
            'cms_automation_api_key',
            'cms_automation_site_id',
            'cms_automation_sync_direction',
            'cms_automation_auto_sync',
            'cms_automation_content_types',
            'cms_automation_ai_enabled',
            'cms_automation_ai_auto_suggestions',
            'cms_automation_ai_default_temperature',
            'cms_automation_ai_default_length'
        );
        
        foreach ($fields as $field) {
            if (isset($_POST[$field])) {
                update_option($field, $_POST[$field]);
            } else {
                // Handle checkboxes that aren't sent when unchecked
                if (in_array($field, array('cms_automation_auto_sync', 'cms_automation_ai_enabled', 'cms_automation_ai_auto_suggestions'))) {
                    update_option($field, false);
                }
            }
        }
        
        add_settings_error(
            'cms_automation_settings',
            'settings_updated',
            __('Settings saved successfully!', 'cms-automation-bridge'),
            'updated'
        );
    }
    
    /**
     * AJAX handler for connection testing
     */
    public function ajax_test_connection() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $api_client = new CMS_Automation_API_Client();
        $result = $api_client->test_connection();
        
        if ($result['success']) {
            wp_send_json_success($result['message']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * AJAX handler for sync status
     */
    public function ajax_get_sync_status() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        $post_id = intval($_POST['post_id']);
        
        if (!current_user_can('edit_post', $post_id)) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $sync_status = get_post_meta($post_id, '_cms_automation_sync_status', true);
        $last_sync = get_post_meta($post_id, '_cms_automation_last_sync', true);
        $sync_error = get_post_meta($post_id, '_cms_automation_sync_error', true);
        
        $status = array(
            'status' => $sync_status ?: 'pending',
            'last_sync' => $last_sync,
            'message' => $this->get_sync_status_message($sync_status, $sync_error)
        );
        
        wp_send_json_success($status);
    }
    
    /**
     * AJAX handler for content analysis
     */
    public function ajax_analyze_content() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        $content = wp_kses_post($_POST['content']);
        $post_id = intval($_POST['post_id']);
        
        if (!current_user_can('edit_posts')) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $ai_content = new CMS_Automation_AI_Content();
        
        // Calculate readability
        $readability = $this->calculate_readability($content);
        
        // Calculate SEO score
        $seo_score = $this->calculate_seo_score($content, $post_id);
        
        // Get word count
        $word_count = str_word_count(strip_tags($content));
        
        $analysis = array(
            'readability' => $readability,
            'seo_score' => $seo_score,
            'word_count' => $word_count,
            'character_count' => strlen($content),
            'paragraph_count' => substr_count($content, "\n\n") + 1,
            'heading_count' => preg_match_all('/<h[1-6][^>]*>/i', $content)
        );
        
        wp_send_json_success($analysis);
    }
    
    /**
     * AJAX handler for writing suggestions
     */
    public function ajax_get_writing_suggestions() {
        check_ajax_referer('cms_automation_nonce', 'nonce');
        
        $content = wp_kses_post($_POST['content']);
        $post_id = intval($_POST['post_id']);
        
        if (!current_user_can('edit_posts')) {
            wp_die(__('Insufficient permissions', 'cms-automation-bridge'));
        }
        
        $ai_content = new CMS_Automation_AI_Content();
        $result = $ai_content->get_writing_suggestions($content, $post_id);
        
        if ($result['success']) {
            wp_send_json_success($result['data']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * Sanitize sync direction
     */
    public function sanitize_sync_direction($value) {
        $allowed = array('bidirectional', 'wp_to_cms', 'cms_to_wp');
        return in_array($value, $allowed) ? $value : 'bidirectional';
    }
    
    /**
     * Sanitize content types
     */
    public function sanitize_content_types($value) {
        if (!is_array($value)) {
            return array('post', 'page');
        }
        
        $post_types = get_post_types(array('public' => true));
        return array_intersect($value, array_keys($post_types));
    }
    
    /**
     * Sanitize temperature value
     */
    public function sanitize_temperature($value) {
        $float_value = floatval($value);
        return max(0, min(1, $float_value));
    }
    
    /**
     * Sanitize content length
     */
    public function sanitize_content_length($value) {
        $int_value = intval($value);
        return max(50, min(4000, $int_value));
    }
    
    /**
     * Get sync status message
     */
    private function get_sync_status_message($status, $error = '') {
        switch ($status) {
            case 'success':
                return __('✅ Synced successfully', 'cms-automation-bridge');
            case 'failed':
                return __('❌ Sync failed', 'cms-automation-bridge') . ($error ? ': ' . $error : '');
            case 'syncing':
                return __('🔄 Syncing...', 'cms-automation-bridge');
            default:
                return __('⏳ Pending sync', 'cms-automation-bridge');
        }
    }
    
    /**
     * Calculate readability score
     */
    private function calculate_readability($content) {
        $text = strip_tags($content);
        $words = str_word_count($text);
        $sentences = max(1, substr_count($text, '.') + substr_count($text, '!') + substr_count($text, '?'));
        $syllables = $this->count_syllables($text);
        
        if ($words === 0) {
            return 0;
        }
        
        // Flesch Reading Ease Score
        $score = 206.835 - (1.015 * ($words / $sentences)) - (84.6 * ($syllables / $words));
        
        return max(0, min(100, round($score)));
    }
    
    /**
     * Count syllables in text
     */
    private function count_syllables($text) {
        $text = strtolower($text);
        $words = str_word_count($text, 1);
        $syllables = 0;
        
        foreach ($words as $word) {
            $syllables += max(1, preg_match_all('/[aeiouy]+/', $word));
        }
        
        return $syllables;
    }
    
    /**
     * Calculate SEO score
     */
    private function calculate_seo_score($content, $post_id = null) {
        $score = 0;
        $text = strip_tags($content);
        $word_count = str_word_count($text);
        
        // Word count check
        if ($word_count >= 300 && $word_count <= 2000) {
            $score += 25;
        } elseif ($word_count >= 200) {
            $score += 15;
        }
        
        // Heading structure
        if (preg_match_all('/<h[1-6][^>]*>/i', $content)) {
            $score += 20;
        }
        
        // Image alt tags
        $images = preg_match_all('/<img[^>]*>/i', $content);
        $alt_tags = preg_match_all('/<img[^>]*alt=["\'][^"\']+["\'][^>]*>/i', $content);
        if ($images > 0 && $alt_tags === $images) {
            $score += 15;
        }
        
        // Internal links
        if (preg_match_all('/<a[^>]*href=["\'][^"\']*' . preg_quote(get_site_url(), '/') . '/i', $content)) {
            $score += 15;
        }
        
        // Paragraph length
        $paragraphs = preg_split('/\n\s*\n/', $text);
        $avg_length = array_sum(array_map('str_word_count', $paragraphs)) / count($paragraphs);
        if ($avg_length <= 100) {
            $score += 10;
        }
        
        // Readability bonus
        $readability = $this->calculate_readability($content);
        if ($readability >= 60) {
            $score += 15;
        }
        
        return min(100, $score);
    }
    
    /**
     * Get plugin status summary
     */
    public function get_plugin_status() {
        $api_url = get_option('cms_automation_api_url');
        $api_key = get_option('cms_automation_api_key');
        $auto_sync = get_option('cms_automation_auto_sync');
        
        $status = array(
            'configured' => !empty($api_url) && !empty($api_key),
            'auto_sync_enabled' => $auto_sync,
            'content_types' => get_option('cms_automation_content_types', array()),
            'last_test' => get_option('cms_automation_last_connection_test'),
            'version' => CMS_AUTOMATION_VERSION
        );
        
        return $status;
    }
    
    /**
     * Reset plugin settings
     */
    public function reset_settings() {
        $options = array(
            'cms_automation_api_url',
            'cms_automation_api_key',
            'cms_automation_site_id',
            'cms_automation_sync_direction',
            'cms_automation_auto_sync',
            'cms_automation_content_types',
            'cms_automation_ai_enabled',
            'cms_automation_ai_auto_suggestions',
            'cms_automation_ai_default_temperature',
            'cms_automation_ai_default_length'
        );
        
        foreach ($options as $option) {
            delete_option($option);
        }
        
        return true;
    }
}