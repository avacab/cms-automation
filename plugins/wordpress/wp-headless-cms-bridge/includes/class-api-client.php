<?php
/**
 * API Client for communicating with the Headless CMS system.
 *
 * Handles all HTTP communication with the CMS API, including
 * authentication, error handling, and data transformation.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_API_Client {

    /**
     * The plugin name.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $plugin_name    The plugin name.
     */
    private $plugin_name;

    /**
     * The plugin version.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $version    The plugin version.
     */
    private $version;

    /**
     * API base URL.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $api_url    The CMS API base URL.
     */
    private $api_url;

    /**
     * API key for authentication.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $api_key    The API key.
     */
    private $api_key;

    /**
     * Initialize the API client.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    The plugin name.
     * @param    string    $version        The plugin version.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
        
        // Load configuration
        $this->api_url = get_option('wp_headless_cms_bridge_cms_api_url', '');
        $this->api_key = get_option('wp_headless_cms_bridge_cms_api_key', '');
    }

    /**
     * Test API connection.
     *
     * @since    1.0.0
     * @return   array|WP_Error    Response data or error.
     */
    public function test_connection() {
        if (empty($this->api_url)) {
            return new WP_Error('missing_url', __('CMS API URL is not configured.', 'wp-headless-cms-bridge'));
        }

        $response = $this->make_request('GET', '/health', array(), array('timeout' => 10));
        
        if (is_wp_error($response)) {
            return $response;
        }

        return array(
            'success' => true,
            'message' => __('Successfully connected to CMS API.', 'wp-headless-cms-bridge'),
            'data' => $response
        );
    }


    /**
     * Get content from CMS.
     *
     * @since    1.0.0
     * @param    string    $cms_id    The CMS content ID.
     * @return   array|WP_Error      Response data or error.
     */
    public function get_content($cms_id) {
        return $this->make_request('GET', "/api/v1/content/{$cms_id}");
    }

    /**
     * Delete content from CMS.
     *
     * @since    1.0.0
     * @param    string    $cms_id    The CMS content ID.
     * @return   array|WP_Error      Response data or error.
     */
    public function delete_content($cms_id) {
        return $this->make_request('DELETE', "/api/v1/content/{$cms_id}");
    }

    /**
     * Get all content from CMS.
     *
     * @since    1.0.0
     * @param    array    $params    Query parameters.
     * @return   array|WP_Error     Response data or error.
     */
    public function get_all_content($params = array()) {
        $endpoint = '/api/v1/content';
        if (!empty($params)) {
            $endpoint .= '?' . http_build_query($params);
        }
        
        return $this->make_request('GET', $endpoint);
    }

    /**
     * Get content types from CMS.
     *
     * @since    1.0.0
     * @return   array|WP_Error    Response data or error.
     */
    public function get_content_types() {
        return $this->make_request('GET', '/api/v1/content-types');
    }

    /**
     * Upload media to CMS.
     *
     * @since    1.0.0
     * @param    array    $media_data    The media data.
     * @return   array|WP_Error         Response data or error.
     */
    public function upload_media($media_data) {
        return $this->make_request('POST', '/api/v1/media', $media_data, array(
            'headers' => array(
                'Content-Type' => 'multipart/form-data'
            )
        ));
    }

    /**
     * Make HTTP request to CMS API.
     *
     * @since    1.0.0
     * @param    string    $method     HTTP method (GET, POST, PUT, DELETE).
     * @param    string    $endpoint   API endpoint.
     * @param    array     $data       Request data.
     * @param    array     $options    Additional options.
     * @return   array|WP_Error       Response data or error.
     */
    private function make_request($method, $endpoint, $data = array(), $options = array()) {
        
        // Check if API is configured
        if (empty($this->api_url)) {
            return new WP_Error('api_not_configured', __('CMS API URL is not configured.', 'wp-headless-cms-bridge'));
        }

        // Build full URL
        $url = rtrim($this->api_url, '/') . '/' . ltrim($endpoint, '/');

        // Default arguments
        $args = array(
            'method'  => strtoupper($method),
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent'   => "WordPress/{$this->plugin_name} v{$this->version}"
            )
        );

        // Add API key if configured
        if (!empty($this->api_key)) {
            $args['headers']['Authorization'] = 'Bearer ' . $this->api_key;
        }

        // Add request body for POST/PUT requests
        if (in_array($method, array('POST', 'PUT', 'PATCH')) && !empty($data)) {
            if (isset($options['headers']['Content-Type']) && 
                $options['headers']['Content-Type'] === 'multipart/form-data') {
                $args['body'] = $data;
                unset($args['headers']['Content-Type']); // Let WordPress set this for multipart
            } else {
                $args['body'] = json_encode($data);
            }
        }

        // Merge additional options
        if (!empty($options)) {
            $args = array_merge_recursive($args, $options);
        }

        // Log the request if logging is enabled
        $this->log_request($method, $url, $args);

        // Make the request
        $response = wp_remote_request($url, $args);

        // Check for errors
        if (is_wp_error($response)) {
            $this->log_error('HTTP Error: ' . $response->get_error_message());
            return $response;
        }

        // Get response code and body
        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        // Log the response
        $this->log_response($response_code, $response_body);

        // Handle HTTP errors
        if ($response_code >= 400) {
            $error_message = $this->parse_error_message($response_body, $response_code);
            return new WP_Error('api_error', $error_message, array(
                'status' => $response_code,
                'response' => $response_body
            ));
        }

        // Parse JSON response
        $parsed_response = json_decode($response_body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('json_error', __('Invalid JSON response from CMS API.', 'wp-headless-cms-bridge'));
        }

        return $parsed_response;
    }

    /**
     * Parse error message from API response.
     *
     * @since    1.0.0
     * @param    string    $response_body    The response body.
     * @param    int       $response_code    The HTTP response code.
     * @return   string                     The error message.
     */
    private function parse_error_message($response_body, $response_code) {
        $parsed_body = json_decode($response_body, true);
        
        if (json_last_error() === JSON_ERROR_NONE && isset($parsed_body['message'])) {
            return $parsed_body['message'];
        }
        
        // Fallback error messages
        switch ($response_code) {
            case 401:
                return __('Authentication failed. Please check your API key.', 'wp-headless-cms-bridge');
            case 403:
                return __('Access forbidden. Insufficient permissions.', 'wp-headless-cms-bridge');
            case 404:
                return __('Content not found in CMS.', 'wp-headless-cms-bridge');
            case 429:
                return __('API rate limit exceeded. Please try again later.', 'wp-headless-cms-bridge');
            case 500:
                return __('Internal server error in CMS API.', 'wp-headless-cms-bridge');
            default:
                return sprintf(__('API request failed with status code %d.', 'wp-headless-cms-bridge'), $response_code);
        }
    }

    /**
     * Log API request (if logging is enabled).
     *
     * @since    1.0.0
     * @param    string    $method    HTTP method.
     * @param    string    $url       Request URL.
     * @param    array     $args      Request arguments.
     */
    private function log_request($method, $url, $args) {
        if (!get_option('wp_headless_cms_bridge_log_enabled', true)) {
            return;
        }

        $log_data = array(
            'timestamp' => current_time('mysql'),
            'type' => 'request',
            'method' => $method,
            'url' => $url,
            'headers' => isset($args['headers']) ? $args['headers'] : array(),
            'body_size' => isset($args['body']) ? strlen($args['body']) : 0
        );

        // Don't log sensitive data
        if (isset($log_data['headers']['Authorization'])) {
            $log_data['headers']['Authorization'] = '[REDACTED]';
        }

        error_log('[WP Headless CMS Bridge] Request: ' . json_encode($log_data));
    }

    /**
     * Log API response (if logging is enabled).
     *
     * @since    1.0.0
     * @param    int       $response_code    HTTP response code.
     * @param    string    $response_body    Response body.
     */
    private function log_response($response_code, $response_body) {
        if (!get_option('wp_headless_cms_bridge_log_enabled', true)) {
            return;
        }

        $log_data = array(
            'timestamp' => current_time('mysql'),
            'type' => 'response',
            'status_code' => $response_code,
            'body_size' => strlen($response_body),
            'success' => $response_code < 400
        );

        error_log('[WP Headless CMS Bridge] Response: ' . json_encode($log_data));
    }

    /**
     * Log error message.
     *
     * @since    1.0.0
     * @param    string    $message    Error message.
     */
    private function log_error($message) {
        if (!get_option('wp_headless_cms_bridge_log_enabled', true)) {
            return;
        }

        error_log('[WP Headless CMS Bridge] Error: ' . $message);
    }

    /**
     * Get API configuration status.
     *
     * @since    1.0.0
     * @return   array    Configuration status.
     */
    public function get_config_status() {
        return array(
            'api_url_configured' => !empty($this->api_url),
            'api_key_configured' => !empty($this->api_key),
            // API key is optional - webhooks use secret-based authentication
            'fully_configured' => !empty($this->api_url)
        );
    }

    /**
     * Update API configuration.
     *
     * @since    1.0.0
     * @param    string    $api_url    The API URL.
     * @param    string    $api_key    The API key.
     */
    public function update_config($api_url, $api_key) {
        $this->api_url = $api_url;
        $this->api_key = $api_key;
    }

    /**
     * Create content in CMS.
     *
     * @since    1.0.0
     * @param    array    $content_data    The content data.
     * @return   array|WP_Error          Response data or error.
     */
    public function create_content($content_data) {
        // Debug: Log what we're about to send
        error_log("CMS Bridge API: create_content called with data: " . json_encode($content_data));
        
        // The API expects content to be wrapped in a "content" object
        $data = array(
            'content' => $content_data
        );
        
        error_log("CMS Bridge API: Sending to API: " . json_encode($data));
        return $this->make_request('POST', '/api/v1/content', $data);
    }

    /**
     * Update content in CMS.
     *
     * @since    1.0.0
     * @param    string   $cms_id         The CMS content ID.
     * @param    array    $content_data   The content data.
     * @return   array|WP_Error          Response data or error.
     */
    public function update_content($cms_id, $content_data) {
        // Debug: Log what we're about to send
        error_log("CMS Bridge API: update_content called for CMS ID $cms_id with data: " . json_encode($content_data));
        
        // The API expects content to be wrapped in a "content" object
        $data = array(
            'content' => $content_data
        );
        
        error_log("CMS Bridge API: Sending to API: " . json_encode($data));
        return $this->make_request('PUT', "/api/v1/content/{$cms_id}", $data);
    }

}