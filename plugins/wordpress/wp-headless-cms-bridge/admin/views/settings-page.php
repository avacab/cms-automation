<?php
/**
 * Admin settings page template.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

$active_tab = isset($_GET['tab']) ? $_GET['tab'] : 'settings';
?>

<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    
    <h2 class="nav-tab-wrapper">
        <a href="?page=wp-headless-cms-bridge&tab=settings" class="nav-tab <?php echo $active_tab == 'settings' ? 'nav-tab-active' : ''; ?>">
            <?php _e('Settings', 'wp-headless-cms-bridge'); ?>
        </a>
        <a href="?page=wp-headless-cms-bridge&tab=social" class="nav-tab <?php echo $active_tab == 'social' ? 'nav-tab-active' : ''; ?>">
            <?php _e('Social Media', 'wp-headless-cms-bridge'); ?>
        </a>
        <a href="?page=wp-headless-cms-bridge&tab=sync-logs" class="nav-tab <?php echo $active_tab == 'sync-logs' ? 'nav-tab-active' : ''; ?>">
            <?php _e('Sync Logs', 'wp-headless-cms-bridge'); ?>
        </a>
        <a href="?page=wp-headless-cms-bridge&tab=status" class="nav-tab <?php echo $active_tab == 'status' ? 'nav-tab-active' : ''; ?>">
            <?php _e('Status', 'wp-headless-cms-bridge'); ?>
        </a>
    </h2>

    <?php if ($active_tab == 'settings'): ?>
        <div class="tab-content">
            <form method="post" action="options.php">
                <?php
                settings_fields('wp_headless_cms_bridge_settings');
                do_settings_sections('wp-headless-cms-bridge');
                submit_button();
                ?>
            </form>
        </div>

    <?php elseif ($active_tab == 'social'): ?>
        <div class="tab-content">
            <h2><?php _e('Social Media Integration', 'wp-headless-cms-bridge'); ?></h2>
            <p><?php _e('Configure automatic social media posting when content is published to WordPress.', 'wp-headless-cms-bridge'); ?></p>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('wp_headless_cms_bridge_social_settings');
                ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="social_enabled"><?php _e('Enable Social Media Posting', 'wp-headless-cms-bridge'); ?></label>
                        </th>
                        <td>
                            <input type="checkbox" id="social_enabled" name="wp_headless_cms_bridge_social_enabled" value="1" 
                                <?php checked(get_option('wp_headless_cms_bridge_social_enabled', false)); ?> />
                            <label for="social_enabled"><?php _e('Automatically schedule social media posts when content is published', 'wp-headless-cms-bridge'); ?></label>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label><?php _e('Social Media Platforms', 'wp-headless-cms-bridge'); ?></label>
                        </th>
                        <td>
                            <?php
                            $enabled_platforms = get_option('wp_headless_cms_bridge_social_platforms', array());
                            $platforms = array(
                                'facebook' => __('Facebook', 'wp-headless-cms-bridge'),
                                'twitter' => __('Twitter', 'wp-headless-cms-bridge'),
                                'linkedin' => __('LinkedIn', 'wp-headless-cms-bridge'),
                                'instagram' => __('Instagram', 'wp-headless-cms-bridge')
                            );
                            ?>
                            <fieldset>
                                <?php foreach ($platforms as $platform => $label): ?>
                                    <label>
                                        <input type="checkbox" name="wp_headless_cms_bridge_social_platforms[]" 
                                               value="<?php echo esc_attr($platform); ?>"
                                               <?php checked(in_array($platform, $enabled_platforms)); ?> />
                                        <?php echo esc_html($label); ?>
                                    </label><br>
                                <?php endforeach; ?>
                            </fieldset>
                            <p class="description"><?php _e('Select which social media platforms to post to automatically.', 'wp-headless-cms-bridge'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="social_optimal_timing"><?php _e('Optimal Timing', 'wp-headless-cms-bridge'); ?></label>
                        </th>
                        <td>
                            <input type="checkbox" id="social_optimal_timing" name="wp_headless_cms_bridge_social_optimal_timing" value="1" 
                                <?php checked(get_option('wp_headless_cms_bridge_social_optimal_timing', true)); ?> />
                            <label for="social_optimal_timing"><?php _e('Use optimal posting times for each platform', 'wp-headless-cms-bridge'); ?></label>
                            <p class="description">
                                <?php _e('When enabled, posts will be scheduled at optimal times: Facebook 3PM, Twitter 8AM, LinkedIn 12PM, Instagram 7PM (UTC).', 'wp-headless-cms-bridge'); ?>
                            </p>
                        </td>
                    </tr>
                </table>
                
                <div class="social-media-status">
                    <h3><?php _e('Social Media Connection Status', 'wp-headless-cms-bridge'); ?></h3>
                    <div id="social-status-display">
                        <p><?php _e('Loading social media connection status...', 'wp-headless-cms-bridge'); ?></p>
                    </div>
                    <button type="button" class="button button-secondary" onclick="checkSocialStatus()">
                        <?php _e('Check Connection Status', 'wp-headless-cms-bridge'); ?>
                    </button>
                </div>
                
                <?php submit_button(__('Save Social Media Settings', 'wp-headless-cms-bridge')); ?>
            </form>
            
            <div class="social-media-help">
                <h3><?php _e('Setting Up Social Media Integration', 'wp-headless-cms-bridge'); ?></h3>
                <ol>
                    <li><?php _e('Enable social media posting above', 'wp-headless-cms-bridge'); ?></li>
                    <li><?php _e('Select the platforms you want to post to', 'wp-headless-cms-bridge'); ?></li>
                    <li><?php _e('Configure social media accounts in your CMS dashboard', 'wp-headless-cms-bridge'); ?></li>
                    <li><?php _e('Publish a post to test the integration', 'wp-headless-cms-bridge'); ?></li>
                </ol>
                
                <p><strong><?php _e('Note:', 'wp-headless-cms-bridge'); ?></strong> 
                <?php _e('Social media accounts must be connected through your CMS dashboard. This plugin only triggers the scheduling - the actual posting is handled by your headless CMS.', 'wp-headless-cms-bridge'); ?></p>
            </div>
        </div>
        
        <script>
        function checkSocialStatus() {
            const statusDiv = document.getElementById('social-status-display');
            statusDiv.innerHTML = '<p><?php _e("Checking social media connection status...", "wp-headless-cms-bridge"); ?></p>';
            
            // Make AJAX request to check social media status
            fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=check_social_status&nonce=<?php echo wp_create_nonce("check_social_status"); ?>'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    let html = '<div class="social-status-results">';
                    const services = data.data.services;
                    
                    for (const [platform, status] of Object.entries(services)) {
                        const statusClass = status.ready ? 'status-connected' : 'status-disconnected';
                        const statusText = status.ready ? '<?php _e("Connected", "wp-headless-cms-bridge"); ?>' : '<?php _e("Not Connected", "wp-headless-cms-bridge"); ?>';
                        html += `<div class="social-platform-status ${statusClass}">
                            <strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}:</strong> ${statusText}
                        </div>`;
                    }
                    
                    html += '</div>';
                    statusDiv.innerHTML = html;
                } else {
                    statusDiv.innerHTML = '<p class="error"><?php _e("Failed to check social media status. Please ensure your CMS API is configured correctly.", "wp-headless-cms-bridge"); ?></p>';
                }
            })
            .catch(error => {
                statusDiv.innerHTML = '<p class="error"><?php _e("Error checking social media status.", "wp-headless-cms-bridge"); ?></p>';
            });
        }
        
        // Check status on page load
        document.addEventListener('DOMContentLoaded', checkSocialStatus);
        </script>
        
        <style>
        .social-media-status {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            background: #f9f9f9;
        }
        
        .social-status-results {
            margin: 10px 0;
        }
        
        .social-platform-status {
            padding: 5px;
            margin: 5px 0;
        }
        
        .status-connected {
            color: #46b450;
        }
        
        .status-disconnected {
            color: #dc3232;
        }
        
        .social-media-help {
            margin-top: 30px;
            padding: 15px;
            border-left: 4px solid #0073aa;
            background: #f0f8ff;
        }
        </style>

    <?php elseif ($active_tab == 'sync-logs'): ?>
        <div class="tab-content">
            <h2><?php _e('Sync Logs', 'wp-headless-cms-bridge'); ?></h2>
            
            <div class="sync-log-actions">
                <button type="button" class="button button-secondary" onclick="refreshSyncLogs()">
                    <?php _e('Refresh', 'wp-headless-cms-bridge'); ?>
                </button>
                <button type="button" class="button button-primary" onclick="syncAllContent()">
                    <?php _e('Sync All Content', 'wp-headless-cms-bridge'); ?>
                </button>
            </div>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th scope="col"><?php _e('Date/Time', 'wp-headless-cms-bridge'); ?></th>
                        <th scope="col"><?php _e('Post ID', 'wp-headless-cms-bridge'); ?></th>
                        <th scope="col"><?php _e('CMS ID', 'wp-headless-cms-bridge'); ?></th>
                        <th scope="col"><?php _e('Action', 'wp-headless-cms-bridge'); ?></th>
                        <th scope="col"><?php _e('Status', 'wp-headless-cms-bridge'); ?></th>
                        <th scope="col"><?php _e('Error Message', 'wp-headless-cms-bridge'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($sync_logs)): ?>
                        <?php foreach ($sync_logs as $log): ?>
                            <tr>
                                <td><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log->sync_time))); ?></td>
                                <td><?php echo esc_html($log->post_id); ?></td>
                                <td><?php echo esc_html($log->cms_id); ?></td>
                                <td><?php echo esc_html($log->action); ?></td>
                                <td>
                                    <span class="status-<?php echo esc_attr($log->status); ?>">
                                        <?php echo esc_html(ucfirst($log->status)); ?>
                                    </span>
                                </td>
                                <td><?php echo $log->error_message ? esc_html($log->error_message) : '—'; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="6"><?php _e('No sync logs found.', 'wp-headless-cms-bridge'); ?></td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

    <?php elseif ($active_tab == 'status'): ?>
        <div class="tab-content">
            <h2><?php _e('System Status', 'wp-headless-cms-bridge'); ?></h2>
            
            <div class="status-cards">
                <div class="status-card">
                    <h3><?php _e('API Connection', 'wp-headless-cms-bridge'); ?></h3>
                    <?php
                    $config_status = $this->api_client->get_config_status();
                    if ($config_status['fully_configured']):
                    ?>
                        <div class="status-indicator status-success">
                            <span class="dashicons dashicons-yes-alt"></span>
                            <?php _e('Configured', 'wp-headless-cms-bridge'); ?>
                        </div>
                        <button type="button" class="button" onclick="testConnection()">
                            <?php _e('Test Connection', 'wp-headless-cms-bridge'); ?>
                        </button>
                    <?php else: ?>
                        <div class="status-indicator status-error">
                            <span class="dashicons dashicons-warning"></span>
                            <?php _e('Not Configured', 'wp-headless-cms-bridge'); ?>
                        </div>
                        <p><?php _e('Please configure the API URL and API key in the Settings tab.', 'wp-headless-cms-bridge'); ?></p>
                    <?php endif; ?>
                </div>

                <div class="status-card">
                    <h3><?php _e('Content Sync', 'wp-headless-cms-bridge'); ?></h3>
                    <?php if ($settings['sync_enabled']): ?>
                        <div class="status-indicator status-success">
                            <span class="dashicons dashicons-update"></span>
                            <?php _e('Enabled', 'wp-headless-cms-bridge'); ?>
                        </div>
                        <p><?php printf(__('Direction: %s', 'wp-headless-cms-bridge'), esc_html(ucwords(str_replace('_', ' ', $settings['sync_direction'])))); ?></p>
                        <p><?php printf(__('Post Types: %s', 'wp-headless-cms-bridge'), esc_html(implode(', ', $settings['post_types']))); ?></p>
                    <?php else: ?>
                        <div class="status-indicator status-warning">
                            <span class="dashicons dashicons-pause"></span>
                            <?php _e('Disabled', 'wp-headless-cms-bridge'); ?>
                        </div>
                    <?php endif; ?>
                </div>

                <div class="status-card">
                    <h3><?php _e('Webhooks', 'wp-headless-cms-bridge'); ?></h3>
                    <?php if (!empty($settings['webhook_secret'])): ?>
                        <div class="status-indicator status-success">
                            <span class="dashicons dashicons-admin-links"></span>
                            <?php _e('Ready', 'wp-headless-cms-bridge'); ?>
                        </div>
                        <div class="webhook-info">
                            <?php
                            $webhook_handler = new WP_Headless_CMS_Bridge_Webhook_Handler($this->plugin_name, $this->version);
                            $webhook_urls = $webhook_handler->get_webhook_urls();
                            ?>
                            <p><strong><?php _e('Content:', 'wp-headless-cms-bridge'); ?></strong><br>
                            <code><?php echo esc_url($webhook_urls['content']); ?></code></p>
                            <p><strong><?php _e('Media:', 'wp-headless-cms-bridge'); ?></strong><br>
                            <code><?php echo esc_url($webhook_urls['media']); ?></code></p>
                        </div>
                    <?php else: ?>
                        <div class="status-indicator status-error">
                            <span class="dashicons dashicons-warning"></span>
                            <?php _e('No Secret Key', 'wp-headless-cms-bridge'); ?>
                        </div>
                    <?php endif; ?>
                </div>

                <div class="status-card">
                    <h3><?php _e('Logging', 'wp-headless-cms-bridge'); ?></h3>
                    <?php if ($settings['log_enabled']): ?>
                        <div class="status-indicator status-success">
                            <span class="dashicons dashicons-media-text"></span>
                            <?php _e('Enabled', 'wp-headless-cms-bridge'); ?>
                        </div>
                        <p><?php printf(__('Retention: %d days', 'wp-headless-cms-bridge'), $settings['log_retention_days']); ?></p>
                    <?php else: ?>
                        <div class="status-indicator status-warning">
                            <span class="dashicons dashicons-dismiss"></span>
                            <?php _e('Disabled', 'wp-headless-cms-bridge'); ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="system-info">
                <h3><?php _e('System Information', 'wp-headless-cms-bridge'); ?></h3>
                <table class="wp-list-table widefat">
                    <tbody>
                        <tr>
                            <td><strong><?php _e('Plugin Version:', 'wp-headless-cms-bridge'); ?></strong></td>
                            <td><?php echo esc_html(WP_HEADLESS_CMS_BRIDGE_VERSION); ?></td>
                        </tr>
                        <tr>
                            <td><strong><?php _e('WordPress Version:', 'wp-headless-cms-bridge'); ?></strong></td>
                            <td><?php echo esc_html(get_bloginfo('version')); ?></td>
                        </tr>
                        <tr>
                            <td><strong><?php _e('PHP Version:', 'wp-headless-cms-bridge'); ?></strong></td>
                            <td><?php echo esc_html(PHP_VERSION); ?></td>
                        </tr>
                        <tr>
                            <td><strong><?php _e('REST API:', 'wp-headless-cms-bridge'); ?></strong></td>
                            <td>
                                <?php if (function_exists('rest_get_url_prefix')): ?>
                                    <span class="dashicons dashicons-yes-alt"></span> <?php _e('Enabled', 'wp-headless-cms-bridge'); ?>
                                <?php else: ?>
                                    <span class="dashicons dashicons-warning"></span> <?php _e('Disabled', 'wp-headless-cms-bridge'); ?>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <tr>
                            <td><strong><?php _e('cURL:', 'wp-headless-cms-bridge'); ?></strong></td>
                            <td>
                                <?php if (function_exists('curl_version')): ?>
                                    <span class="dashicons dashicons-yes-alt"></span> <?php _e('Enabled', 'wp-headless-cms-bridge'); ?>
                                <?php else: ?>
                                    <span class="dashicons dashicons-warning"></span> <?php _e('Disabled', 'wp-headless-cms-bridge'); ?>
                                <?php endif; ?>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>

    <!-- Loading overlay -->
    <div id="loading-overlay" style="display: none;">
        <div class="loading-spinner"></div>
    </div>
</div>

<style>
.status-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.status-card {
    background: #fff;
    border: 1px solid #c3c4c7;
    border-radius: 4px;
    padding: 20px;
}

.status-card h3 {
    margin-top: 0;
    margin-bottom: 15px;
}

.status-indicator {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    font-weight: 600;
}

.status-indicator .dashicons {
    margin-right: 8px;
}

.status-success {
    color: #00a32a;
}

.status-warning {
    color: #dba617;
}

.status-error {
    color: #d63638;
}

.webhook-info {
    margin-top: 10px;
}

.webhook-info code {
    font-size: 12px;
    word-break: break-all;
}

.sync-log-actions {
    margin: 20px 0;
}

.sync-log-actions .button {
    margin-right: 10px;
}

.status-success {
    color: #00a32a;
}

.status-error {
    color: #d63638;
}

#loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 2s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.webhook-urls {
    background: #f0f0f1;
    padding: 15px;
    border-radius: 4px;
    margin: 10px 0;
}

.webhook-urls code {
    background: #fff;
    padding: 5px 8px;
    border-radius: 3px;
    font-size: 12px;
}
</style>