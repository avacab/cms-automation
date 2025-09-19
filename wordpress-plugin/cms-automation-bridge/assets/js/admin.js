/**
 * CMS Automation Bridge - Admin JavaScript
 */
(function($) {
    'use strict';

    // Initialize when document is ready
    $(document).ready(function() {
        CMSAutomation.init();
    });

    // Main CMS Automation object
    window.CMSAutomation = {
        
        // Configuration
        config: {
            ajaxUrl: cms_automation_ajax.ajax_url,
            nonce: cms_automation_ajax.nonce,
            strings: cms_automation_ajax.strings
        },

        // Initialize the plugin
        init: function() {
            this.bindEvents();
            this.initConnectionTest();
            this.initAIContentGeneration();
            this.initSyncStatus();
        },

        // Bind event handlers
        bindEvents: function() {
            var self = this;

            // AI Content Generation
            $(document).on('click', '#cms-generate-ai-content', function(e) {
                e.preventDefault();
                self.showAIPrompt();
            });

            $(document).on('click', '#cms-generate-content', function(e) {
                e.preventDefault();
                self.generateAIContent();
            });

            $(document).on('click', '#cms-cancel-ai', function(e) {
                e.preventDefault();
                self.hideAIPrompt();
            });

            // Force Sync
            $(document).on('click', '#cms-force-sync', function(e) {
                e.preventDefault();
                self.forceSyncContent();
            });

            // Connection Test
            $(document).on('click', 'input[name="test_connection"]', function(e) {
                self.showConnectionTesting($(this));
            });

            // Auto-hide notices
            setTimeout(function() {
                $('.notice.is-dismissible').fadeOut();
            }, 5000);
        },

        // Initialize connection testing
        initConnectionTest: function() {
            var $testButton = $('input[name="test_connection"]');
            if ($testButton.length) {
                // Check connection status on page load
                this.checkConnectionStatus();
            }
        },

        // Initialize AI content generation
        initAIContentGeneration: function() {
            // Add AI content generator to post editor if not exists
            if ($('#post').length && !$('.cms-ai-content-generator').length) {
                this.addAIContentGenerator();
            }

            // Initialize writing suggestions
            this.initWritingSuggestions();
        },

        // Initialize sync status monitoring
        initSyncStatus: function() {
            var self = this;
            var $syncStatus = $('.cms-sync-status');
            
            if ($syncStatus.length) {
                // Check sync status every 30 seconds
                setInterval(function() {
                    self.updateSyncStatus();
                }, 30000);
            }
        },

        // Show AI prompt input
        showAIPrompt: function() {
            $('#cms-ai-prompt').slideDown();
            $('#cms-ai-prompt textarea').focus();
        },

        // Hide AI prompt input
        hideAIPrompt: function() {
            $('#cms-ai-prompt').slideUp();
            $('#cms-ai-prompt textarea').val('');
        },

        // Generate AI content
        generateAIContent: function() {
            var self = this;
            var $button = $('#cms-generate-content');
            var $textarea = $('#cms-ai-prompt textarea');
            var prompt = $textarea.val().trim();
            var postId = $('#post_ID').val() || 0;

            if (!prompt) {
                alert('Please enter a content prompt.');
                $textarea.focus();
                return;
            }

            // Show loading state
            this.setButtonLoading($button, this.config.strings.generating);

            // AJAX request
            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_generate_ai_content',
                    nonce: this.config.nonce,
                    prompt: prompt,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.handleAIContentSuccess(response.data);
                    } else {
                        self.showError(response.data || 'Failed to generate content');
                    }
                },
                error: function() {
                    self.showError('Network error occurred');
                },
                complete: function() {
                    self.setButtonLoading($button, false);
                    self.hideAIPrompt();
                }
            });
        },

        // Handle successful AI content generation
        handleAIContentSuccess: function(data) {
            var content = data.content || '';
            var titleSuggestion = data.title_suggestion || '';

            // Insert content into editor
            if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
                // Visual editor
                var editor = tinymce.get('content');
                if (editor) {
                    editor.setContent(content);
                }
            } else if ($('#content').length) {
                // Text editor
                $('#content').val(content);
            }

            // Suggest title if empty
            if (titleSuggestion && $('#title').val() === '') {
                $('#title').val(titleSuggestion);
            }

            // Show success message
            this.showSuccess(this.config.strings.success);

            // Update word count if exists
            if (data.word_count) {
                this.updateWordCount(data.word_count);
            }

            // Auto-enable sync
            $('input[name="cms_automation_sync"]').prop('checked', true);
        },

        // Force sync content
        forceSyncContent: function() {
            var self = this;
            var $button = $('#cms-force-sync');
            var postId = $('#post_ID').val();

            if (!postId) {
                alert('Please save the post first.');
                return;
            }

            // Show loading state
            this.setButtonLoading($button, 'Syncing...');

            // AJAX request
            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_sync_content',
                    nonce: this.config.nonce,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.showSuccess('Content synced successfully');
                        self.updateSyncMetadata(response.data);
                    } else {
                        self.showError(response.data || 'Sync failed');
                    }
                },
                error: function() {
                    self.showError('Network error occurred');
                },
                complete: function() {
                    self.setButtonLoading($button, false);
                }
            });
        },

        // Check connection status
        checkConnectionStatus: function() {
            var self = this;
            var $statusElement = $('.cms-connection-status');

            if (!$statusElement.length) {
                return;
            }

            $statusElement.removeClass('connected disconnected').addClass('testing').text('Testing...');

            // Simple ping test
            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_test_connection',
                    nonce: this.config.nonce
                },
                timeout: 10000,
                success: function(response) {
                    if (response.success) {
                        $statusElement.removeClass('testing disconnected').addClass('connected').text('✅ Connected');
                    } else {
                        $statusElement.removeClass('testing connected').addClass('disconnected').text('❌ Disconnected');
                    }
                },
                error: function() {
                    $statusElement.removeClass('testing connected').addClass('disconnected').text('❌ Connection Failed');
                }
            });
        },

        // Show connection testing state
        showConnectionTesting: function($button) {
            var originalText = $button.val();
            $button.val('Testing...').prop('disabled', true);

            setTimeout(function() {
                $button.val(originalText).prop('disabled', false);
            }, 3000);
        },

        // Add AI content generator to post editor
        addAIContentGenerator: function() {
            var generatorHtml = `
                <div class="cms-ai-content-generator">
                    <h4>🤖 AI Content Assistant</h4>
                    <p>Generate content with AI or get writing suggestions for your post.</p>
                    <button type="button" class="button button-primary" id="cms-editor-ai-generate">Generate Content</button>
                    <button type="button" class="button" id="cms-editor-get-suggestions">Get Writing Suggestions</button>
                </div>
            `;

            // Insert after the editor
            $('#wp-content-wrap').after(generatorHtml);

            // Bind events for new buttons
            this.bindEditorAIEvents();
        },

        // Bind AI events for editor
        bindEditorAIEvents: function() {
            var self = this;

            $(document).on('click', '#cms-editor-ai-generate', function(e) {
                e.preventDefault();
                self.showEditorAIPrompt();
            });

            $(document).on('click', '#cms-editor-get-suggestions', function(e) {
                e.preventDefault();
                self.getWritingSuggestions();
            });
        },

        // Show AI prompt in editor
        showEditorAIPrompt: function() {
            var prompt = window.prompt('Enter your content prompt:');
            if (prompt) {
                this.generateEditorAIContent(prompt);
            }
        },

        // Generate AI content for editor
        generateEditorAIContent: function(prompt) {
            var self = this;
            var postId = $('#post_ID').val() || 0;

            // Show loading
            $('.cms-ai-content-generator').addClass('active');
            $('#cms-editor-ai-generate').text('Generating...').prop('disabled', true);

            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_generate_ai_content',
                    nonce: this.config.nonce,
                    prompt: prompt,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.handleAIContentSuccess(response.data);
                    } else {
                        self.showError(response.data || 'Failed to generate content');
                    }
                },
                error: function() {
                    self.showError('Network error occurred');
                },
                complete: function() {
                    $('.cms-ai-content-generator').removeClass('active');
                    $('#cms-editor-ai-generate').text('Generate Content').prop('disabled', false);
                }
            });
        },

        // Get writing suggestions
        getWritingSuggestions: function() {
            var content = this.getEditorContent();
            
            if (!content || content.length < 50) {
                alert('Please write some content first (at least 50 characters).');
                return;
            }

            // Show suggestions modal or panel
            this.showWritingSuggestions(content);
        },

        // Show writing suggestions
        showWritingSuggestions: function(content) {
            var self = this;
            var postId = $('#post_ID').val() || 0;

            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_get_writing_suggestions',
                    nonce: this.config.nonce,
                    content: content,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.displayWritingSuggestions(response.data);
                    } else {
                        self.showError('Failed to get suggestions');
                    }
                },
                error: function() {
                    self.showError('Network error occurred');
                }
            });
        },

        // Display writing suggestions
        displayWritingSuggestions: function(data) {
            var suggestions = data.suggestions || [];
            var score = data.overall_score || 0;

            var html = '<div class="cms-writing-suggestions-modal">';
            html += '<h3>Writing Suggestions (Score: ' + score + '/10)</h3>';
            
            if (suggestions.length > 0) {
                html += '<div class="cms-writing-suggestions">';
                suggestions.forEach(function(suggestion) {
                    html += '<div class="cms-suggestion">';
                    html += '<span class="cms-suggestion-type ' + suggestion.type + '">' + suggestion.type + '</span>';
                    html += '<div class="cms-suggestion-text">' + suggestion.issue + '</div>';
                    html += '<div class="cms-suggestion-text"><strong>Suggestion:</strong> ' + suggestion.suggestion + '</div>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<p>Great! No suggestions found. Your content looks good!</p>';
            }
            
            html += '<button type="button" class="button button-primary" onclick="$(this).closest(\'.cms-writing-suggestions-modal\').remove()">Close</button>';
            html += '</div>';

            // Show in modal
            $('body').append('<div class="cms-modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;"></div>');
            $('.cms-modal-overlay').html('<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;max-width:600px;max-height:80%;overflow-y:auto;">' + html + '</div>');
            
            $('.cms-modal-overlay').click(function(e) {
                if (e.target === this) {
                    $(this).remove();
                }
            });
        },

        // Initialize writing suggestions
        initWritingSuggestions: function() {
            var self = this;
            var debounceTimer;

            // Auto-analyze content while typing (debounced)
            $(document).on('input', '#content', function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() {
                    var content = self.getEditorContent();
                    if (content.length > 100) {
                        self.analyzeContentQuietly(content);
                    }
                }, 2000);
            });
        },

        // Quietly analyze content and show indicators
        analyzeContentQuietly: function(content) {
            var self = this;
            var postId = $('#post_ID').val() || 0;

            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_analyze_content',
                    nonce: this.config.nonce,
                    content: content,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.updateContentAnalysis(response.data);
                    }
                }
            });
        },

        // Update content analysis display
        updateContentAnalysis: function(data) {
            var $analysis = $('.cms-content-analysis');
            
            if (!$analysis.length) {
                // Create analysis panel
                var html = '<div class="cms-content-analysis"><h4>Content Analysis</h4><div class="cms-analysis-items"></div></div>';
                $('.cms-automation-meta-box').append(html);
                $analysis = $('.cms-content-analysis');
            }

            var $items = $analysis.find('.cms-analysis-items');
            $items.empty();

            // Add analysis items
            if (data.readability) {
                $items.append(this.createAnalysisItem('Readability', data.readability + '%', this.getScoreClass(data.readability)));
            }
            
            if (data.seo_score) {
                $items.append(this.createAnalysisItem('SEO Score', data.seo_score + '%', this.getScoreClass(data.seo_score)));
            }
            
            if (data.word_count) {
                $items.append(this.createAnalysisItem('Word Count', data.word_count, this.getWordCountClass(data.word_count)));
            }
        },

        // Create analysis item HTML
        createAnalysisItem: function(label, value, scoreClass) {
            return '<div class="cms-analysis-item"><span>' + label + '</span><span class="cms-analysis-score ' + scoreClass + '">' + value + '</span></div>';
        },

        // Get score class based on value
        getScoreClass: function(score) {
            if (score >= 80) return 'excellent';
            if (score >= 60) return 'good';
            if (score >= 40) return 'needs-improvement';
            return 'poor';
        },

        // Get word count class
        getWordCountClass: function(count) {
            if (count >= 300 && count <= 2000) return 'excellent';
            if (count >= 200) return 'good';
            return 'needs-improvement';
        },

        // Get editor content
        getEditorContent: function() {
            if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
                return tinymce.get('content').getContent();
            } else if ($('#content').length) {
                return $('#content').val();
            }
            return '';
        },

        // Update sync metadata
        updateSyncMetadata: function(data) {
            if (data.cms_id) {
                // Update CMS ID display if exists
                $('.cms-id-display').text(data.cms_id);
            }
            
            if (data.last_sync) {
                $('.cms-last-sync-display').text(data.last_sync);
            }
        },

        // Update sync status
        updateSyncStatus: function() {
            var postId = $('#post_ID').val();
            if (!postId) return;

            var self = this;
            $.ajax({
                url: this.config.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cms_get_sync_status',
                    nonce: this.config.nonce,
                    post_id: postId
                },
                success: function(response) {
                    if (response.success) {
                        self.displaySyncStatus(response.data);
                    }
                }
            });
        },

        // Display sync status
        displaySyncStatus: function(status) {
            var $status = $('.cms-sync-status');
            if (!$status.length) return;

            $status.removeClass('success failed pending syncing')
                   .addClass(status.status)
                   .text(status.message);
        },

        // Update word count display
        updateWordCount: function(count) {
            var $wordCount = $('#wp-word-count .word-count');
            if ($wordCount.length) {
                $wordCount.text(count);
            }
        },

        // Set button loading state
        setButtonLoading: function($button, loadingText) {
            if (loadingText) {
                $button.data('original-text', $button.text())
                       .text(loadingText)
                       .prop('disabled', true)
                       .addClass('cms-loading');
            } else {
                $button.text($button.data('original-text') || $button.text())
                       .prop('disabled', false)
                       .removeClass('cms-loading');
            }
        },

        // Show success message
        showSuccess: function(message) {
            this.showNotice(message, 'success');
        },

        // Show error message
        showError: function(message) {
            this.showNotice(message, 'error');
        },

        // Show notice
        showNotice: function(message, type) {
            type = type || 'info';
            var $notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>');
            
            $('.wrap > h1').after($notice);
            
            // Auto-dismiss after 5 seconds
            setTimeout(function() {
                $notice.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
        },

        // Utility: Debounce function
        debounce: function(func, wait) {
            var timeout;
            return function executedFunction() {
                var context = this;
                var args = arguments;
                var later = function() {
                    timeout = null;
                    func.apply(context, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

})(jQuery);