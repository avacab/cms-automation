import { useState, useEffect } from 'react';
import { pluginService, Plugin } from '../services/api';

export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const pluginData = await pluginService.getPlugins();
      setPlugins(pluginData);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const refresh = () => {
    fetchPlugins();
  };

  const activatePlugin = async (id: string) => {
    try {
      const result = await pluginService.activatePlugin(id);
      if (result.success) {
        // Update plugin status locally
        setPlugins(prev => prev.map(plugin => 
          plugin.id === id ? { ...plugin, status: 'active' } : plugin
        ));
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const deactivatePlugin = async (id: string) => {
    try {
      const result = await pluginService.deactivatePlugin(id);
      if (result.success) {
        // Update plugin status locally
        setPlugins(prev => prev.map(plugin => 
          plugin.id === id ? { ...plugin, status: 'inactive' } : plugin
        ));
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const configurePlugin = async (id: string, settings: Record<string, any>) => {
    try {
      const result = await pluginService.configurePlugin(id, settings);
      if (result.success) {
        // Update plugin settings locally
        setPlugins(prev => prev.map(plugin => 
          plugin.id === id ? { ...plugin, settings: { ...plugin.settings, ...settings } } : plugin
        ));
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  // Get plugins by status
  const getPluginsByStatus = (status: Plugin['status']) => {
    return plugins.filter(plugin => plugin.status === status);
  };

  // Get plugins by type
  const getPluginsByType = (type: Plugin['type']) => {
    return plugins.filter(plugin => plugin.type === type);
  };

  // Get plugin statistics
  const getPluginStats = () => {
    return {
      total: plugins.length,
      active: plugins.filter(p => p.status === 'active').length,
      inactive: plugins.filter(p => p.status === 'inactive').length,
      error: plugins.filter(p => p.status === 'error').length,
      byType: {
        integration: plugins.filter(p => p.type === 'integration').length,
        authentication: plugins.filter(p => p.type === 'authentication').length,
        storage: plugins.filter(p => p.type === 'storage').length,
        workflow: plugins.filter(p => p.type === 'workflow').length,
        utility: plugins.filter(p => p.type === 'utility').length,
      }
    };
  };

  return {
    plugins,
    loading,
    error,
    refresh,
    activatePlugin,
    deactivatePlugin,
    configurePlugin,
    getPluginsByStatus,
    getPluginsByType,
    getPluginStats,
  };
}

export function usePlugin(id: string) {
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugin = async () => {
    try {
      setLoading(true);
      setError(null);
      const pluginData = await pluginService.getPlugin(id);
      setPlugin(pluginData);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch plugin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPlugin();
    }
  }, [id]);

  const refresh = () => {
    fetchPlugin();
  };

  const updateSettings = async (settings: Record<string, any>) => {
    try {
      const result = await pluginService.configurePlugin(id, settings);
      if (result.success && plugin) {
        setPlugin({
          ...plugin,
          settings: { ...plugin.settings, ...settings }
        });
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const activate = async () => {
    try {
      const result = await pluginService.activatePlugin(id);
      if (result.success && plugin) {
        setPlugin({ ...plugin, status: 'active' });
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const deactivate = async () => {
    try {
      const result = await pluginService.deactivatePlugin(id);
      if (result.success && plugin) {
        setPlugin({ ...plugin, status: 'inactive' });
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  return {
    plugin,
    loading,
    error,
    refresh,
    updateSettings,
    activate,
    deactivate,
  };
}