<?php
/**
 * AI Content Generation Class
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CMS_Automation_AI_Content {
    
    private $api_client;
    
    public function __construct() {
        $this->api_client = new CMS_Automation_API_Client();
    }
    
    /**
     * Generate AI content based on prompt
     */
    public function generate_content($prompt, $post_id = null, $options = array()) {
        // Get post context if post_id provided
        $context = array();
        if ($post_id) {
            $post = get_post($post_id);
            if ($post) {
                $context = array(
                    'content_type' => $post->post_type,
                    'existing_title' => $post->post_title,
                    'existing_content' => $post->post_content,
                    'post_id' => $post_id
                );
            }
        }
        
        // Merge context with options
        $generation_options = array_merge(array(
            'maxTokens' => 2000,
            'temperature' => 0.7,
            'targetLength' => 500
        ), $options);
        
        // Add context-specific options
        if (!empty($context['content_type'])) {
            $generation_options['contentType'] = $context['content_type'];
        }
        
        $result = $this->api_client->generate_ai_content($prompt, $generation_options);
        
        if ($result['success']) {
            // Log successful generation
            $this->log_ai_generation($post_id, $prompt, 'success', $result['data']);
            
            return array(
                'success' => true,
                'data' => array(
                    'content' => $result['data']['content'],
                    'title_suggestion' => $this->extract_title_from_content($result['data']['content']),
                    'word_count' => str_word_count(strip_tags($result['data']['content'])),
                    'usage' => $result['data']['usage'] ?? array()
                )
            );
        } else {
            // Log failed generation
            $this->log_ai_generation($post_id, $prompt, 'failed', $result['message']);
            
            return $result;
        }
    }
    
    /**
     * Get writing suggestions for content
     */
    public function get_writing_suggestions($content, $post_id = null) {
        $context = array();
        
        if ($post_id) {
            $post = get_post($post_id);
            if ($post) {
                $context = array(
                    'contentType' => $post->post_type,
                    'targetAudience' => get_post_meta($post_id, '_target_audience', true),
                    'purpose' => get_post_meta($post_id, '_content_purpose', true)
                );
            }
        }
        
        $result = $this->api_client->get_writing_suggestions($content, $context);
        
        if ($result['success']) {
            return array(
                'success' => true,
                'data' => array(
                    'suggestions' => $result['data']['suggestions'] ?? array(),
                    'overall_score' => $result['data']['overallScore'] ?? 0,
                    'summary' => $result['data']['summary'] ?? '',
                    'readability' => $this->calculate_readability($content),
                    'seo_score' => $this->calculate_seo_score($content, $post_id)
                )
            );
        }
        
        return $result;
    }
    
    /**
     * Adapt content to different formats
     */
    public function adapt_content($content, $target_format, $constraints = array()) {
        $result = $this->api_client->adapt_content($content, $target_format, $constraints);
        
        if ($result['success']) {
            return array(
                'success' => true,
                'data' => array(
                    'adapted_content' => $result['data']['adaptedContent'],
                    'original_format' => $result['data']['originalFormat'],
                    'target_format' => $result['data']['targetFormat'],
                    'word_count' => str_word_count(strip_tags($result['data']['adaptedContent'])),
                    'character_count' => strlen($result['data']['adaptedContent'])
                )
            );
        }
        
        return $result;
    }
    
    /**
     * Get available content formats
     */
    public function get_available_formats() {
        $result = $this->api_client->get_content_formats();
        
        if ($result['success']) {
            return $result['data'];
        }
        
        // Return default formats if API fails
        return array(
            'formats' => array(
                array(
                    'id' => 'blog-post',
                    'name' => 'Blog Post',
                    'description' => 'Standard blog post format',
                    'constraints' => array('minWords' => 300, 'maxWords' => 2000)
                ),
                array(
                    'id' => 'social-media',
                    'name' => 'Social Media Post',
                    'description' => 'Short social media content',
                    'constraints' => array('maxWords' => 50)
                ),
                array(
                    'id' => 'email-newsletter',
                    'name' => 'Email Newsletter',
                    'description' => 'Email-friendly format',
                    'constraints' => array('includeSubject' => true)
                )
            )
        );
    }
    
    /**
     * Generate content variations
     */
    public function generate_variations($content, $variations = 3, $options = array()) {
        $results = array();
        
        for ($i = 1; $i <= $variations; $i++) {
            $prompt = sprintf(__('Create a variation of this content with a different style and approach: %s', 'cms-automation-bridge'), $content);
            
            $variation_options = array_merge($options, array(
                'temperature' => 0.8 + ($i * 0.1) // Increase creativity for each variation
            ));
            
            $result = $this->api_client->generate_ai_content($prompt, $variation_options);
            
            if ($result['success']) {
                $results[] = array(
                    'variation' => $i,
                    'content' => $result['data']['content'],
                    'word_count' => str_word_count(strip_tags($result['data']['content']))
                );
            }
        }
        
        return array(
            'success' => !empty($results),
            'data' => $results
        );
    }
    
    /**
     * Extract title suggestion from generated content
     */
    private function extract_title_from_content($content) {
        // Look for H1 tags first
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/i', $content, $matches)) {
            return strip_tags($matches[1]);
        }
        
        // Look for first line if it looks like a title
        $lines = explode("\n", strip_tags($content));
        $first_line = trim($lines[0]);
        
        // Check if first line is likely a title (short, no periods, etc.)
        if (strlen($first_line) < 100 && substr_count($first_line, '.') === 0) {
            return $first_line;
        }
        
        // Generate title from first sentence
        $sentences = preg_split('/[.!?]+/', strip_tags($content));
        if (!empty($sentences[0])) {
            $title = trim($sentences[0]);
            return strlen($title) > 60 ? substr($title, 0, 57) . '...' : $title;
        }
        
        return '';
    }
    
    /**
     * Calculate basic readability score
     */
    private function calculate_readability($content) {
        $text = strip_tags($content);
        $words = str_word_count($text);
        $sentences = substr_count($text, '.') + substr_count($text, '!') + substr_count($text, '?');
        $syllables = $this->count_syllables($text);
        
        if ($sentences === 0 || $words === 0) {
            return 0;
        }
        
        // Flesch Reading Ease Score
        $score = 206.835 - (1.015 * ($words / $sentences)) - (84.6 * ($syllables / $words));
        
        return max(0, min(100, round($score)));
    }
    
    /**
     * Count syllables in text (approximation)
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
     * Calculate basic SEO score
     */
    private function calculate_seo_score($content, $post_id = null) {
        $score = 0;
        $text = strip_tags($content);
        $word_count = str_word_count($text);
        
        // Word count (ideal: 300-2000 words)
        if ($word_count >= 300 && $word_count <= 2000) {
            $score += 20;
        } elseif ($word_count >= 200) {
            $score += 10;
        }
        
        // Heading structure
        if (preg_match_all('/<h[1-6][^>]*>/i', $content)) {
            $score += 15;
        }
        
        // Internal links
        if (preg_match_all('/<a[^>]*href=["\'][^"\']*' . preg_quote(get_site_url(), '/') . '[^"\']*["\'][^>]*>/i', $content)) {
            $score += 10;
        }
        
        // Image alt tags
        $images = preg_match_all('/<img[^>]*>/i', $content);
        $alt_tags = preg_match_all('/<img[^>]*alt=["\'][^"\']+["\'][^>]*>/i', $content);
        if ($images > 0 && $alt_tags === $images) {
            $score += 15;
        }
        
        // Meta description (if post_id provided)
        if ($post_id) {
            $meta_description = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
            if (!empty($meta_description) && strlen($meta_description) >= 120 && strlen($meta_description) <= 160) {
                $score += 20;
            }
        }
        
        // Paragraph length (not too long)
        $paragraphs = explode("\n\n", $text);
        $avg_paragraph_length = array_sum(array_map('str_word_count', $paragraphs)) / count($paragraphs);
        if ($avg_paragraph_length <= 100) {
            $score += 10;
        }
        
        // Readability (bonus for good readability)
        $readability = $this->calculate_readability($content);
        if ($readability >= 60) {
            $score += 10;
        }
        
        return min(100, $score);
    }
    
    /**
     * Log AI generation attempt
     */
    private function log_ai_generation($post_id, $prompt, $status, $result_data) {
        $log_entry = array(
            'post_id' => $post_id,
            'prompt' => $prompt,
            'status' => $status,
            'timestamp' => current_time('mysql'),
            'result' => is_array($result_data) ? json_encode($result_data) : $result_data
        );
        
        $logs = get_option('cms_automation_ai_logs', array());
        $logs[] = $log_entry;
        
        // Keep only last 100 logs
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }
        
        update_option('cms_automation_ai_logs', $logs);
    }
    
    /**
     * Get AI generation logs
     */
    public function get_ai_logs($limit = 20) {
        $logs = get_option('cms_automation_ai_logs', array());
        return array_slice(array_reverse($logs), 0, $limit);
    }
    
    /**
     * Generate content outline
     */
    public function generate_outline($topic, $target_audience = '', $content_type = 'blog-post') {
        $prompt = sprintf(
            __('Create a detailed content outline for: "%s". Target audience: %s. Content type: %s. Include main headings, subheadings, and key points to cover.', 'cms-automation-bridge'),
            $topic,
            $target_audience ?: 'general audience',
            $content_type
        );
        
        $options = array(
            'maxTokens' => 1000,
            'temperature' => 0.6
        );
        
        return $this->api_client->generate_ai_content($prompt, $options);
    }
    
    /**
     * Improve existing content
     */
    public function improve_content($content, $focus_areas = array()) {
        $focus = !empty($focus_areas) ? implode(', ', $focus_areas) : 'clarity, engagement, and SEO';
        
        $prompt = sprintf(
            __('Improve this content focusing on %s. Keep the core message but enhance readability, engagement, and overall quality: %s', 'cms-automation-bridge'),
            $focus,
            $content
        );
        
        $options = array(
            'maxTokens' => strlen($content) * 2, // Allow for expansion
            'temperature' => 0.5
        );
        
        return $this->api_client->generate_ai_content($prompt, $options);
    }
}