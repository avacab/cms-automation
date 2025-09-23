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