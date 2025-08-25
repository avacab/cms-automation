import { Plugin } from '../services/api';

interface PluginCardProps {
  plugin: Plugin;
  onClick?: (plugin: Plugin) => void;
}

export default function PluginCard({ plugin, onClick }: PluginCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'integration':
        return 'bg-blue-100 text-blue-800';
      case 'authentication':
        return 'bg-purple-100 text-purple-800';
      case 'storage':
        return 'bg-orange-100 text-orange-800';
      case 'workflow':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 ${
        onClick ? 'cursor-pointer hover:border-blue-300' : ''
      }`}
      onClick={() => onClick?.(plugin)}
    >
      <div className="p-6">
        {/* Header with name and status */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
              {plugin.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">v{plugin.version}</p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plugin.status)}`}>
              {plugin.status}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(plugin.type)}`}>
              {plugin.type}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {plugin.description}
        </p>

        {/* Features */}
        {plugin.features && plugin.features.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Features</h4>
            <div className="flex flex-wrap gap-1">
              {plugin.features.slice(0, 3).map((feature, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                >
                  {feature}
                </span>
              ))}
              {plugin.features.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-500 text-xs">
                  +{plugin.features.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex justify-between items-center text-sm text-gray-500 mt-4">
          <div className="flex items-center space-x-4">
            <span>ID: {plugin.id}</span>
            {plugin.author && (
              <>
                <span>•</span>
                <span>by {plugin.author}</span>
              </>
            )}
          </div>
          {plugin.installed_at && (
            <time dateTime={plugin.installed_at}>
              {formatDate(plugin.installed_at)}
            </time>
          )}
        </div>
      </div>

      {/* Configuration footer */}
      {plugin.config_url && (
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {plugin.endpoints ? `${plugin.endpoints.length} endpoints` : 'Configuration available'}
            </span>
            {onClick && (
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Configure →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}