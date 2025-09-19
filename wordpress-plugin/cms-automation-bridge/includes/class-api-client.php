<?php
/**
 * CMS Automation API Client
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CMS_Automation_API_Client {
    
    private $api_url;
    private $api_key;
    private $site_id;
    private $access_token;
    private $refresh_token;
    private $organization_id;
    
    public function __construct() {
        $this->api_url = get_option('cms_automation_api_url', 'https://cms-automation-api.vercel.app');
        $this->api_key = get_option('cms_automation_api_key', ''); // Legacy support
        $this->site_id = get_option('cms_automation_site_id', ''); // Legacy support
        $this->access_token = get_option('cms_automation_access_token', '');
        $this->refresh_token = get_option('cms_automation_refresh_token', '');
        $this->organization_id = get_option('cms_automation_organization_id', '');
    }
    
    /**
     * Authenticate with email and password
     */
    public function authenticate($email, $password, $organization_id = null) {
        $data = array(
            'email' => $email,
            'password' => $password
        );
        
        if ($organization_id) {
            $data['organizationId'] = $organization_id;
        }
        
        $response = $this->make_request('POST', '/api/v1/auth/login', $data, false);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            // Store authentication tokens
            $this->access_token = $data['data']['tokens']['accessToken'];
            $this->refresh_token = $data['data']['tokens']['refreshToken'];
            $this->organization_id = $data['data']['organization']['id'];
            
            // Save to WordPress options
            update_option('cms_automation_access_token', $this->access_token);
            update_option('cms_automation_refresh_token', $this->refresh_token);
            update_option('cms_automation_organization_id', $this->organization_id);
            update_option('cms_automation_user_data', $data['data']['user']);
            update_option('cms_automation_organization_data', $data['data']['organization']);
            
            return array(
                'success' => true,
                'message' => __('Authentication successful', 'cms-automation-bridge'),
                'data' => $data['data']
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['error']['message']) ? $data['error']['message'] : __('Authentication failed', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Refresh access token
     */
    public function refresh_token() {
        if (empty($this->refresh_token)) {
            return array(
                'success' => false,
                'message' => __('No refresh token available', 'cms-automation-bridge')
            );
        }
        
        $response = $this->make_request('POST', '/api/v1/auth/refresh', array(
            'refreshToken' => $this->refresh_token
        ), false);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            $this->access_token = $data['data']['accessToken'];
            update_option('cms_automation_access_token', $this->access_token);
            
            return array(
                'success' => true,
                'message' => __('Token refreshed successfully', 'cms-automation-bridge')
            );
        } else {
            // Refresh failed, clear stored tokens
            $this->clear_authentication();
            
            return array(
                'success' => false,
                'message' => __('Token refresh failed. Please re-authenticate.', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Clear stored authentication data
     */
    public function clear_authentication() {
        $this->access_token = '';
        $this->refresh_token = '';
        $this->organization_id = '';
        
        delete_option('cms_automation_access_token');
        delete_option('cms_automation_refresh_token');
        delete_option('cms_automation_organization_id');
        delete_option('cms_automation_user_data');
        delete_option('cms_automation_organization_data');
    }
    
    /**
     * Check if user is authenticated
     */
    public function is_authenticated() {
        return !empty($this->access_token) && !empty($this->organization_id);
    }
    
    /**
     * Get current user data
     */
    public function get_current_user() {
        if (!$this->is_authenticated()) {
            return null;
        }
        
        $response = $this->make_request('GET', '/api/v1/auth/me');
        
        if (is_wp_error($response)) {
            return null;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            return $data['data'];
        }
        
        return null;
    }
    
    /**
     * Test API connection
     */
    public function test_connection() {
        $response = $this->make_request('GET', '/health', null, false);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code === 200) {
            return array(
                'success' => true,
                'message' => __('Connection successful', 'cms-automation-bridge')
            );
        } else {
            return array(
                'success' => false,
                'message' => sprintf(__('HTTP %d error', 'cms-automation-bridge'), $status_code)
            );
        }
    }
    
    /**
     * Create content in CMS
     */
    public function create_content($content_data) {
        $response = $this->make_request('POST', '/api/v1/content', $content_data);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 || $status_code === 201) {
            return array(
                'success' => true,
                'data' => $data
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['message']) ? $data['message'] : __('Unknown error', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Update content in CMS
     */
    public function update_content($cms_id, $content_data) {
        $response = $this->make_request('PUT', "/api/v1/content/{$cms_id}", $content_data);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200) {
            return array(
                'success' => true,
                'data' => $data
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['message']) ? $data['message'] : __('Unknown error', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Delete content from CMS
     */
    public function delete_content($cms_id) {
        $response = $this->make_request('DELETE', "/api/v1/content/{$cms_id}");
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code === 200 || $status_code === 204) {
            return array(
                'success' => true,
                'message' => __('Content deleted successfully', 'cms-automation-bridge')
            );
        } else {
            return array(
                'success' => false,
                'message' => __('Failed to delete content', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Generate AI content
     */
    public function generate_ai_content($prompt, $options = array()) {
        $data = array(
            'type' => 'complete',
            'input' => array(
                'prompt' => $prompt
            ),
            'options' => array_merge(array(
                'maxTokens' => 2000,
                'temperature' => 0.7,
                'targetLength' => 500
            ), $options)
        );
        
        $response = $this->make_request('POST', '/api/v1/ai/generate', $data);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            return array(
                'success' => true,
                'data' => $data['data']
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['error']['message']) ? $data['error']['message'] : __('Failed to generate content', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Get writing suggestions
     */
    public function get_writing_suggestions($content, $context = array()) {
        $data = array(
            'content' => $content,
            'context' => $context
        );
        
        $response = $this->make_request('POST', '/api/v1/ai/suggestions', $data);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            return array(
                'success' => true,
                'data' => $data['data']
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['error']['message']) ? $data['error']['message'] : __('Failed to get suggestions', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Adapt content to different formats
     */
    public function adapt_content($content, $target_format, $constraints = array()) {
        $data = array(
            'content' => $content,
            'targetFormat' => $target_format,
            'customConstraints' => $constraints
        );
        
        $response = $this->make_request('POST', '/api/v1/ai/adapt', $data);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            return array(
                'success' => true,
                'data' => $data['data']
            );
        } else {
            return array(
                'success' => false,
                'message' => isset($data['error']['message']) ? $data['error']['message'] : __('Failed to adapt content', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Get available content formats
     */
    public function get_content_formats() {
        $response = $this->make_request('GET', '/api/v1/ai/adapt/formats');
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($status_code === 200 && isset($data['success']) && $data['success']) {
            return array(
                'success' => true,
                'data' => $data['data']
            );
        } else {
            return array(
                'success' => false,
                'message' => __('Failed to get content formats', 'cms-automation-bridge')
            );
        }
    }
    
    /**
     * Make HTTP request to CMS API
     */
    private function make_request($method, $endpoint, $data = null, $require_auth = true) {
        $url = rtrim($this->api_url, '/') . $endpoint;
        
        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'WordPress CMS Automation Bridge/' . CMS_AUTOMATION_VERSION
            )
        );
        
        // Add authentication headers
        if ($require_auth) {
            if (!empty($this->access_token)) {
                $args['headers']['Authorization'] = 'Bearer ' . $this->access_token;
            } elseif (!empty($this->api_key)) {
                // Legacy API key support
                $args['headers']['Authorization'] = 'Bearer ' . $this->api_key;
            }
            
            // Add organization context
            if (!empty($this->organization_id)) {
                $args['headers']['X-Organization-ID'] = $this->organization_id;
            }
        }
        
        // Legacy site ID support
        if (!empty($this->site_id)) {
            $args['headers']['X-Site-ID'] = $this->site_id;
        }
        
        // Add request body for POST/PUT requests
        if ($data !== null && ($method === 'POST' || $method === 'PUT')) {
            $args['body'] = json_encode($data);
        }
        
        // Add WordPress and plugin info
        $args['headers']['X-WordPress-Version'] = get_bloginfo('version');
        $args['headers']['X-Plugin-Version'] = CMS_AUTOMATION_VERSION;
        $args['headers']['X-Site-URL'] = get_site_url();
        
        $response = wp_remote_request($url, $args);
        
        // Check if we need to refresh the access token
        if ($require_auth && !is_wp_error($response)) {
            $status_code = wp_remote_retrieve_response_code($response);
            if ($status_code === 401 && !empty($this->refresh_token)) {
                // Try to refresh the token
                $refresh_result = $this->refresh_token();
                if ($refresh_result['success']) {
                    // Retry the request with the new token
                    $args['headers']['Authorization'] = 'Bearer ' . $this->access_token;
                    $response = wp_remote_request($url, $args);
                }
            }
        }
        
        return $response;
    }
    
    /**
     * Log API request/response for debugging
     */
    private function log_request($url, $args, $response) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('CMS Automation API Request: ' . $url);
            error_log('CMS Automation API Args: ' . print_r($args, true));
            error_log('CMS Automation API Response: ' . print_r($response, true));
        }
    }
}