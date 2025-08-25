/**
 * Admin JavaScript for WP Headless CMS Bridge
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

(function($) {
    'use strict';

    // Test API connection
    window.testConnection = function() {
        const $button = $('button:contains("Test Connection")');
        const $status = $('#connection-status');
        
        // Show loading state
        $button.text(wpHeadlessCMSBridge.strings.testing).prop('disabled', true);
        $status.html('<span class="spinner is-active"></span>');

        // Get current values
        const apiUrl = $('#cms_api_url').val();
        const apiKey = $('#cms_api_key').val();

        $.ajax({
            url: wpHeadlessCMSBridge.ajaxUrl,
            type: 'POST',
            data: {
                action: 'wp_headless_cms_bridge_test_connection',
                nonce: wpHeadlessCMSBridge.nonces.testConnection,
                api_url: apiUrl,
                api_key: apiKey
            },
            success: function(response) {
                if (response.success) {
                    $status.html('<div class="notice notice-success inline"><p><strong>' + 
                        wpHeadlessCMSBridge.strings.success + '</strong> ' + 
                        response.data.message + '</p></div>');
                } else {
                    $status.html('<div class="notice notice-error inline"><p><strong>' + 
                        wpHeadlessCMSBridge.strings.error + '</strong> ' + 
                        response.data.message + '</p></div>');
                }
            },
            error: function(xhr, status, error) {
                $status.html('<div class="notice notice-error inline"><p><strong>' + 
                    wpHeadlessCMSBridge.strings.error + '</strong> ' + 
                    error + '</p></div>');
            },
            complete: function() {
                $button.text('Test Connection').prop('disabled', false);
            }
        });
    };

    // Regenerate webhook secret
    window.regenerateWebhookSecret = function() {
        const $button = $('button:contains("Regenerate")');
        
        if (!confirm('Are you sure you want to regenerate the webhook secret? You will need to update your CMS configuration.')) {
            return;
        }

        $button.text(wpHeadlessCMSBridge.strings.regenerating).prop('disabled', true);

        $.ajax({
            url: wpHeadlessCMSBridge.ajaxUrl,
            type: 'POST',
            data: {
                action: 'wp_headless_cms_bridge_regenerate_secret',
                nonce: wpHeadlessCMSBridge.nonces.regenerateSecret
            },
            success: function(response) {
                if (response.success) {
                    // Update the displayed secret
                    $button.siblings('code').text(response.data.secret);
                    
                    // Show success message
                    $('<div class="notice notice-success is-dismissible"><p>' + 
                        response.data.message + '</p></div>')
                        .insertAfter('.webhook-urls')
                        .delay(3000)
                        .fadeOut();
                } else {
                    alert('Error: ' + response.data.message);
                }
            },
            error: function(xhr, status, error) {
                alert('Error: ' + error);
            },
            complete: function() {
                $button.text('Regenerate').prop('disabled', false);
            }
        });
    };

    // Sync all content
    window.syncAllContent = function() {
        const $button = $('button:contains("Sync All Content")');
        
        if (!confirm('This will sync all configured content to your CMS. This may take some time. Continue?')) {
            return;
        }

        $button.text(wpHeadlessCMSBridge.strings.syncing).prop('disabled', true);
        $('#loading-overlay').show();

        $.ajax({
            url: wpHeadlessCMSBridge.ajaxUrl,
            type: 'POST',
            data: {
                action: 'wp_headless_cms_bridge_sync_all',
                nonce: wpHeadlessCMSBridge.nonces.syncAll
            },
            success: function(response) {
                if (response.success) {
                    // Show success message
                    $('<div class="notice notice-success is-dismissible"><p>' + 
                        response.data.message + '</p></div>')
                        .insertAfter('.sync-log-actions')
                        .delay(5000)
                        .fadeOut();
                    
                    // Refresh logs after 2 seconds
                    setTimeout(function() {
                        refreshSyncLogs();
                    }, 2000);
                } else {
                    alert('Error: ' + response.data.message);
                }
            },
            error: function(xhr, status, error) {
                alert('Error: ' + error);
            },
            complete: function() {
                $button.text('Sync All Content').prop('disabled', false);
                $('#loading-overlay').hide();
            }
        });
    };

    // Refresh sync logs
    window.refreshSyncLogs = function() {
        location.reload(); // Simple refresh for now
    };

    // Auto-save settings when changed
    $(document).ready(function() {
        
        // Auto-test connection when API settings change
        let testTimeout;
        $('#cms_api_url, #cms_api_key').on('input', function() {
            clearTimeout(testTimeout);
            const $status = $('#connection-status');
            
            testTimeout = setTimeout(function() {
                const apiUrl = $('#cms_api_url').val();
                const apiKey = $('#cms_api_key').val();
                
                if (apiUrl && apiKey) {
                    $status.html('<p><em>API settings changed. Click "Test Connection" to verify.</em></p>');
                }
            }, 1000);
        });

        // Show/hide sync options based on sync enabled checkbox
        $('#sync_enabled').on('change', function() {
            const $syncOptions = $('#sync_direction, input[name="wp_headless_cms_bridge_settings[post_types][]"]').closest('tr');
            
            if ($(this).is(':checked')) {
                $syncOptions.show();
            } else {
                $syncOptions.hide();
            }
        }).trigger('change');

        // Handle AJAX form submissions
        $(document).on('submit', 'form[action="options.php"]', function(e) {
            const $form = $(this);
            const $submitButton = $form.find('input[type="submit"]');
            
            // Show loading state
            $submitButton.val('Saving...').prop('disabled', true);
            
            // Let the form submit normally, but provide visual feedback
            setTimeout(function() {
                if ($('.notice-success').length === 0) {
                    $submitButton.val('Save Changes').prop('disabled', false);
                }
            }, 3000);
        });

        // Make notices dismissible
        $(document).on('click', '.notice-dismiss', function() {
            $(this).parent().fadeOut();
        });

        // Add confirmation to dangerous actions
        $('input[name="wp_headless_cms_bridge_settings[sync_direction]"]').on('change', function() {
            if ($(this).val() === 'cms_to_wp' || $(this).val() === 'bidirectional') {
                if (!confirm('Warning: This sync direction can overwrite WordPress content with data from your CMS. Are you sure?')) {
                    $(this).prop('checked', false);
                    $('input[name="wp_headless_cms_bridge_settings[sync_direction]"][value="wp_to_cms"]').prop('checked', true);
                }
            }
        });

        // Copy webhook URLs to clipboard
        $('.webhook-urls code').on('click', function() {
            const text = $(this).text();
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function() {
                    // Visual feedback
                    const $code = $(this);
                    const originalBg = $code.css('background-color');
                    $code.css('background-color', '#46b450').delay(200).queue(function() {
                        $(this).css('background-color', originalBg).dequeue();
                    });
                });
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
        });

        // Add tooltips for better UX
        $('[title]').each(function() {
            $(this).tooltip();
        });

    });

})(jQuery);

// AJAX handlers for WordPress
jQuery(document).ready(function($) {
    
    // Register AJAX handlers
    $(document).on('wp_ajax_wp_headless_cms_bridge_test_connection', function() {
        // This would be handled by PHP in a real implementation
    });

});