<?php
/**
 * Admin settings page
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Handle form submission
if (isset($_POST['submit']) && check_admin_referer('cms_automation_settings', 'cms_automation_nonce')) {
    update_option('cms_automation_api_url', sanitize_url($_POST['cms_automation_api_url']));
    update_option('cms_automation_api_key', sanitize_text_field($_POST['cms_automation_api_key']));
    update_option('cms_automation_site_id', sanitize_text_field($_POST['cms_automation_site_id']));
    update_option('cms_automation_sync_direction', sanitize_text_field($_POST['cms_automation_sync_direction']));
    update_option('cms_automation_auto_sync', isset($_POST['cms_automation_auto_sync']) ? '1' : '0');
    update_option('cms_automation_content_types', isset($_POST['cms_automation_content_types']) ? $_POST['cms_automation_content_types'] : array());
    
    echo '<div class="notice notice-success"><p>' . __('Settings saved successfully!', 'cms-automation-bridge') . '</p></div>';
}

// Test connection
$connection_status = '';
if (isset($_POST['test_connection']) && check_admin_referer('cms_automation_test', 'cms_automation_test_nonce')) {
    $api_client = new CMS_Automation_API_Client();
    $test_result = $api_client->test_connection();
    
    if ($test_result['success']) {
        $connection_status = '<div class="notice notice-success"><p>' . __('✅ Connection successful!', 'cms-automation-bridge') . '</p></div>';
    } else {
        $connection_status = '<div class="notice notice-error"><p>' . sprintf(__('❌ Connection failed: %s', 'cms-automation-bridge'), $test_result['message']) . '</p></div>';
    }
}

// Get current settings
$api_url = get_option('cms_automation_api_url', 'https://cms-automation-api.vercel.app');
$api_key = get_option('cms_automation_api_key', '');
$site_id = get_option('cms_automation_site_id', '');
$sync_direction = get_option('cms_automation_sync_direction', 'bidirectional');
$auto_sync = get_option('cms_automation_auto_sync', '1');
$content_types = get_option('cms_automation_content_types', array('post', 'page'));

// Get available post types
$post_types = get_post_types(array('public' => true), 'objects');
?>

<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    
    <div class="cms-automation-admin-header">
        <div class="cms-automation-logo">
            <h2>🔗 CMS Automation Bridge</h2>
            <p><?php _e('Connect your WordPress site with the headless CMS platform for seamless content synchronization and AI-powered content generation.', 'cms-automation-bridge'); ?></p>
        </div>
    </div>
    
    <?php echo $connection_status; ?>
    
    <div class="cms-automation-admin-content">
        <div class="cms-automation-main">
            <form method="post" action="">
                <?php wp_nonce_field('cms_automation_settings', 'cms_automation_nonce'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="cms_automation_api_url"><?php _e('CMS API URL', 'cms-automation-bridge'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="cms_automation_api_url" name="cms_automation_api_url" value="<?php echo esc_url($api_url); ?>" class="regular-text" required />
                            <p class="description"><?php _e('The base URL of your CMS platform API endpoint.', 'cms-automation-bridge'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="cms_automation_api_key"><?php _e('API Key', 'cms-automation-bridge'); ?></label>
                        </th>
                        <td>
                            <input type="password" id="cms_automation_api_key" name="cms_automation_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                            <p class="description"><?php _e('Your CMS platform API key for authentication.', 'cms-automation-bridge'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="cms_automation_site_id"><?php _e('Site ID', 'cms-automation-bridge'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="cms_automation_site_id" name="cms_automation_site_id" value="<?php echo esc_attr($site_id); ?>" class="regular-text" />
                            <p class="description"><?php _e('Unique identifier for this WordPress site in the CMS platform.', 'cms-automation-bridge'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="cms_automation_sync_direction"><?php _e('Sync Direction', 'cms-automation-bridge'); ?></label>
                        </th>
                        <td>
                            <select id="cms_automation_sync_direction" name="cms_automation_sync_direction">
                                <option value="bidirectional" <?php selected($sync_direction, 'bidirectional'); ?>><?php _e('Bidirectional (WordPress ↔ CMS)', 'cms-automation-bridge'); ?></option>
                                <option value="wp_to_cms" <?php selected($sync_direction, 'wp_to_cms'); ?>><?php _e('WordPress → CMS', 'cms-automation-bridge'); ?></option>
                                <option value="cms_to_wp" <?php selected($sync_direction, 'cms_to_wp'); ?>><?php _e('CMS → WordPress', 'cms-automation-bridge'); ?></option>
                            </select>
                            <p class="description"><?php _e('Choose the direction of content synchronization.', 'cms-automation-bridge'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <?php _e('Auto Sync', 'cms-automation-bridge'); ?>
                        </th>
                        <td>
                            <fieldset>
                                <label>
                                    <input type="checkbox" name="cms_automation_auto_sync" value="1" <?php checked($auto_sync, '1'); ?> />
                                    <?php _e('Automatically sync content when published or updated', 'cms-automation-bridge'); ?>
                                </label>
                                <p class="description"><?php _e('When enabled, content will be automatically synchronized in real-time.', 'cms-automation-bridge'); ?></p>
                            </fieldset>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <?php _e('Content Types', 'cms-automation-bridge'); ?>
                        </th>
                        <td>
                            <fieldset>
                                <?php foreach ($post_types as $post_type): ?>
                                <label>
                                    <input type="checkbox" name="cms_automation_content_types[]" value="<?php echo esc_attr($post_type->name); ?>" <?php checked(in_array($post_type->name, $content_types)); ?> />
                                    <?php echo esc_html($post_type->label); ?> (<?php echo esc_html($post_type->name); ?>)
                                </label><br>
                                <?php endforeach; ?>
                                <p class="description"><?php _e('Select which content types should be synchronized with the CMS platform.', 'cms-automation-bridge'); ?></p>
                            </fieldset>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <hr>
            
            <h3><?php _e('Connection Test', 'cms-automation-bridge'); ?></h3>
            <form method="post" action="">
                <?php wp_nonce_field('cms_automation_test', 'cms_automation_test_nonce'); ?>
                <p><?php _e('Test the connection to your CMS platform to ensure everything is configured correctly.', 'cms-automation-bridge'); ?></p>
                <input type="submit" name="test_connection" class="button button-secondary" value="<?php _e('Test Connection', 'cms-automation-bridge'); ?>" />
            </form>
        </div>
        
        <div class="cms-automation-sidebar">
            <div class="cms-automation-info-box">
                <h3><?php _e('Quick Start Guide', 'cms-automation-bridge'); ?></h3>
                <ol>
                    <li><?php _e('Enter your CMS platform API URL and credentials', 'cms-automation-bridge'); ?></li>
                    <li><?php _e('Test the connection to ensure everything works', 'cms-automation-bridge'); ?></li>
                    <li><?php _e('Select content types you want to synchronize', 'cms-automation-bridge'); ?></li>
                    <li><?php _e('Enable auto-sync for real-time synchronization', 'cms-automation-bridge'); ?></li>
                    <li><?php _e('Start creating content with AI assistance!', 'cms-automation-bridge'); ?></li>
                </ol>
            </div>
            
            <div class="cms-automation-info-box">
                <h3><?php _e('Features', 'cms-automation-bridge'); ?></h3>
                <ul>
                    <li>✅ <?php _e('Real-time content synchronization', 'cms-automation-bridge'); ?></li>
                    <li>✅ <?php _e('AI-powered content generation', 'cms-automation-bridge'); ?></li>
                    <li>✅ <?php _e('Bidirectional sync support', 'cms-automation-bridge'); ?></li>
                    <li>✅ <?php _e('Multiple content type support', 'cms-automation-bridge'); ?></li>
                    <li>✅ <?php _e('Conflict resolution', 'cms-automation-bridge'); ?></li>
                    <li>✅ <?php _e('Detailed sync logging', 'cms-automation-bridge'); ?></li>
                </ul>
            </div>
            
            <div class="cms-automation-info-box">
                <h3><?php _e('Support', 'cms-automation-bridge'); ?></h3>
                <p><?php _e('Need help? Visit our documentation or contact support:', 'cms-automation-bridge'); ?></p>
                <p>
                    <a href="https://docs.cms-automation.com" target="_blank" class="button"><?php _e('Documentation', 'cms-automation-bridge'); ?></a>
                    <a href="https://support.cms-automation.com" target="_blank" class="button"><?php _e('Support', 'cms-automation-bridge'); ?></a>
                </p>
            </div>
        </div>
    </div>
</div>

<style>
.cms-automation-admin-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
}

.cms-automation-admin-content {
    display: flex;
    gap: 20px;
}

.cms-automation-main {
    flex: 1;
}

.cms-automation-sidebar {
    width: 300px;
}

.cms-automation-info-box {
    background: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 15px;
}

.cms-automation-info-box h3 {
    margin-top: 0;
    color: #333;
}

.cms-automation-info-box ul,
.cms-automation-info-box ol {
    margin-left: 20px;
}

.cms-automation-info-box li {
    margin-bottom: 5px;
}
</style>