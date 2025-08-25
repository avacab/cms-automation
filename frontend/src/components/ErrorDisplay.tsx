interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorDisplay({ 
  title = 'Something went wrong', 
  message, 
  onRetry 
}: ErrorDisplayProps) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="h-6 w-6 text-red-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="1.5" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" 
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {title}
          </h3>
          <p className="mt-2 text-sm text-red-700">
            {message}
          </p>
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-md bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}