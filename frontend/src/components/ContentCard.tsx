import { ContentItem } from '../services/api';

interface ContentCardProps {
  content: ContentItem;
  onClick?: (content: ContentItem) => void;
}

export default function ContentCard({ content, onClick }: ContentCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 ${
        onClick ? 'cursor-pointer hover:border-blue-300' : ''
      }`}
      onClick={() => onClick?.(content)}
    >
      <div className="p-6">
        {/* Header with title and status */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
            {typeof content.title === 'string' ? content.title : 'Untitled'}
          </h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(content.status)}`}>
            {typeof content.status === 'string' ? content.status : 'unknown'}
          </span>
        </div>

        {/* Content preview */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {typeof content.content === 'string' 
            ? content.content 
            : typeof content.content === 'object' && content.content !== null
              ? JSON.stringify(content.content)
              : content.excerpt || 'No content preview available'
          }
        </p>

        {/* Metadata */}
        <div className="flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>ID: {typeof content.id === 'string' || typeof content.id === 'number' ? content.id : 'N/A'}</span>
            <span>•</span>
            <span>/{typeof content.slug === 'string' ? content.slug : 'no-slug'}</span>
          </div>
          <time dateTime={content.created_at}>
            {formatDate(content.created_at)}
          </time>
        </div>
      </div>

      {/* Action footer */}
      {onClick && (
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
          <div className="flex justify-end">
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View Details →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}