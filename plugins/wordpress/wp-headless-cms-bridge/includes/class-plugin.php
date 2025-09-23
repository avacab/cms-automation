<?php
/**
 * The core plugin class.
 *
 * This is used to define internationalization, admin-specific hooks, and
 * public-facing site hooks.
 *
 * @package WP_Headless_CMS_Bridge
 * @since   1.0.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class WP_Headless_CMS_Bridge_Plugin {

    /**
     * The loader that's responsible for maintaining and registering all hooks that power
     * the plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      WP_Headless_CMS_Bridge_Loader    $loader    Maintains and registers all hooks for the plugin.
     */
    protected $loader;

    /**
     * The unique identifier of this plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      string    $plugin_name    The string used to uniquely identify this plugin.
     */
    protected $plugin_name;

    /**
     * The current version of the plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      string    $version    The current version of the plugin.
     */
    protected $version;

    /**
     * Define the core functionality of the plugin.
     *
     * Set the plugin name and the plugin version that can be used throughout the plugin.
     * Load the dependencies, define the locale, and set the hooks for the admin area and
     * the public-facing side of the site.
     *
     * @since    1.0.0
     */
    public function __construct() {

        if (defined('WP_HEADLESS_CMS_BRIDGE_VERSION')) {
            $this->version = WP_HEADLESS_CMS_BRIDGE_VERSION;
        } else {
            $this->version = '1.0.0';
        }

        $this->plugin_name = 'wp-headless-cms-bridge';

        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_api_hooks();

    }

    /**
     * Load the required dependencies for this plugin.
     *
     * Include the following files that make up the plugin:
     *
     * - WP_Headless_CMS_Bridge_Loader. Orchestrates the hooks of the plugin.
     * - WP_Headless_CMS_Bridge_i18n. Defines internationalization functionality.
     * - WP_Headless_CMS_Bridge_Admin. Defines all hooks for the admin area.
     * - WP_Headless_CMS_Bridge_Public. Defines all hooks for the public side of the site.
     *
     * Create an instance of the loader which will be used to register the hooks
     * with WordPress.
     *
     * @since    1.0.0
     * @access   private
     */
    private function load_dependencies() {

        // The class responsible for orchestrating the actions and filters of the core plugin.
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-loader.php';

        // The class responsible for defining internationalization functionality of the plugin.
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-i18n.php';

        // The class responsible for defining all actions that occur in the admin area.
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-admin.php';

        // The class responsible for defining all actions that occur in the public-facing side of the site.
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-public.php';

        // The API client for communicating with the headless CMS
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-api-client.php';

        // Content synchronization functionality
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-content-sync.php';

        // Webhook handling
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-webhook-handler.php';

        // Admin settings
        require_once WP_HEADLESS_CMS_BRIDGE_INCLUDES_DIR . 'class-admin-settings.php';

        $this->loader = new WP_Headless_CMS_Bridge_Loader();

    }

    /**
     * Define the locale for this plugin for internationalization.
     *
     * Uses the WP_Headless_CMS_Bridge_i18n class in order to set the domain and to register the hook
     * with WordPress.
     *
     * @since    1.0.0
     * @access   private
     */
    private function set_locale() {

        $plugin_i18n = new WP_Headless_CMS_Bridge_i18n();
        $this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');

    }

    /**
     * Register all of the hooks related to the admin area functionality
     * of the plugin.
     *
     * @since    1.0.0
     * @access   private
     */
    private function define_admin_hooks() {

        $plugin_admin = new WP_Headless_CMS_Bridge_Admin($this->get_plugin_name(), $this->get_version());
        $plugin_settings = new WP_Headless_CMS_Bridge_Admin_Settings($this->get_plugin_name(), $this->get_version());

        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');
        $this->loader->add_action('admin_menu', $plugin_settings, 'add_admin_menu');
        $this->loader->add_action('admin_init', $plugin_settings, 'register_settings');

    }

    /**
     * Register all of the hooks related to the public-facing functionality
     * of the plugin.
     *
     * @since    1.0.0
     * @access   private
     */
    private function define_public_hooks() {

        $plugin_public = new WP_Headless_CMS_Bridge_Public($this->get_plugin_name(), $this->get_version());

        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');

    }

    /**
     * Register all of the hooks related to the API and content sync functionality
     * of the plugin.
     *
     * @since    1.0.0
     * @access   private
     */
    private function define_api_hooks() {

        $content_sync = new WP_Headless_CMS_Bridge_Content_Sync($this->get_plugin_name(), $this->get_version());
        $webhook_handler = new WP_Headless_CMS_Bridge_Webhook_Handler($this->get_plugin_name(), $this->get_version());

        // Content sync hooks
        $this->loader->add_action('save_post', $content_sync, 'sync_post_to_cms', 10, 3);
        $this->loader->add_action('delete_post', $content_sync, 'delete_post_from_cms', 10, 1);
        $this->loader->add_action('wp_trash_post', $content_sync, 'trash_post_in_cms', 10, 1);
        $this->loader->add_action('untrash_post', $content_sync, 'untrash_post_in_cms', 10, 1);

        // Webhook hooks
        $this->loader->add_action('rest_api_init', $webhook_handler, 'register_webhook_endpoints');

    }

    /**
     * Run the loader to execute all of the hooks with WordPress.
     *
     * @since    1.0.0
     */
    public function run() {
        $this->loader->run();
    }

    /**
     * The name of the plugin used to uniquely identify it within the context of
     * WordPress and to define internationalization functionality.
     *
     * @since     1.0.0
     * @return    string    The name of the plugin.
     */
    public function get_plugin_name() {
        return $this->plugin_name;
    }

    /**
     * The reference to the class that orchestrates the hooks with the plugin.
     *
     * @since     1.0.0
     * @return    WP_Headless_CMS_Bridge_Loader    Orchestrates the hooks of the plugin.
     */
    public function get_loader() {
        return $this->loader;
    }

    /**
     * Retrieve the version number of the plugin.
     *
     * @since     1.0.0
     * @return    string    The version number of the plugin.
     */
    public function get_version() {
        return $this->version;
    }

    /**
     * Plugin activation hook.
     *
     * @since 1.0.0
     */
    public static function activate() {
        // Create necessary database tables
        self::create_database_tables();
        
        // Set default options
        self::set_default_options();
        
        // Schedule cron jobs if needed
        self::schedule_cron_jobs();
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Plugin deactivation hook.
     *
     * @since 1.0.0
     */
    public static function deactivate() {
        // Clear scheduled cron jobs
        self::clear_cron_jobs();
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Plugin uninstallation hook.
     *
     * @since 1.0.0
     */
    public static function uninstall() {
        // Remove database tables
        self::remove_database_tables();
        
        // Remove plugin options
        self::remove_plugin_options();
        
        // Clear any cached data
        self::clear_cached_data();
    }

    /**
     * Create necessary database tables.
     *
     * @since 1.0.0
     */
    private static function create_database_tables() {
        global $wpdb;

        $table_name = $wpdb->prefix . 'headless_cms_sync_log';

        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            post_id bigint(20) NOT NULL,
            cms_id varchar(100) DEFAULT '',
            action varchar(50) NOT NULL,
            status varchar(20) NOT NULL,
            error_message text,
            sync_time datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            INDEX post_id (post_id),
            INDEX cms_id (cms_id),
            INDEX sync_time (sync_time)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Set default plugin options.
     *
     * @since 1.0.0
     */
    private static function set_default_options() {
        $default_options = array(
            'cms_api_url' => '',
            'cms_api_key' => '',
            'sync_enabled' => false,
            'sync_direction' => 'wp_to_cms', // wp_to_cms, cms_to_wp, bidirectional
            'post_types' => array('post', 'page'),
            'webhook_secret' => wp_generate_password(32, false),
            'log_enabled' => true,
            'log_retention_days' => 30
        );

        foreach ($default_options as $option_name => $default_value) {
            $option_key = 'wp_headless_cms_bridge_' . $option_name;
            if (false === get_option($option_key)) {
                add_option($option_key, $default_value);
            }
        }
    }

    /**
     * Schedule cron jobs.
     *
     * @since 1.0.0
     */
    private static function schedule_cron_jobs() {
        if (!wp_next_scheduled('wp_headless_cms_bridge_cleanup_logs')) {
            wp_schedule_event(time(), 'daily', 'wp_headless_cms_bridge_cleanup_logs');
        }
    }

    /**
     * Clear cron jobs.
     *
     * @since 1.0.0
     */
    private static function clear_cron_jobs() {
        wp_clear_scheduled_hook('wp_headless_cms_bridge_cleanup_logs');
    }

    /**
     * Remove database tables.
     *
     * @since 1.0.0
     */
    private static function remove_database_tables() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'headless_cms_sync_log';
        $wpdb->query("DROP TABLE IF EXISTS $table_name");
    }

    /**
     * Remove plugin options.
     *
     * @since 1.0.0
     */
    private static function remove_plugin_options() {
        $options_to_remove = array(
            'wp_headless_cms_bridge_cms_api_url',
            'wp_headless_cms_bridge_cms_api_key',
            'wp_headless_cms_bridge_sync_enabled',
            'wp_headless_cms_bridge_sync_direction',
            'wp_headless_cms_bridge_post_types',
            'wp_headless_cms_bridge_webhook_secret',
            'wp_headless_cms_bridge_log_enabled',
            'wp_headless_cms_bridge_log_retention_days'
        );

        foreach ($options_to_remove as $option) {
            delete_option($option);
        }
    }

    /**
     * Clear cached data.
     *
     * @since 1.0.0
     */
    private static function clear_cached_data() {
        // Clear any transients or cached data
        delete_transient('wp_headless_cms_bridge_api_status');
    }

}