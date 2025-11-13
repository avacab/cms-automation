import { useState, ReactNode } from 'react'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

interface TooltipProps {
  content: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ content, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
  }

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors p-0 border-0 bg-transparent"
        aria-label="More information"
      >
        <QuestionMarkCircleIcon className="w-4 h-4" />
      </button>

      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]} w-72`}>
          <div className="bg-gray-900 text-white text-sm rounded-lg shadow-lg p-4">
            {content}
          </div>
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  )
}

interface FieldTooltipProps {
  title: string
  description: string
  choices?: string[]
  example?: string
  note?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function FieldTooltip({ title, description, choices, example, note, position = 'top' }: FieldTooltipProps) {
  const content = (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300 flex items-center">
        <span className="mr-1">📌</span>
        {title}
      </div>

      <p className="text-gray-200 leading-relaxed">
        {description}
      </p>

      {choices && choices.length > 0 && (
        <div>
          <div className="font-medium text-gray-300 text-xs uppercase tracking-wider mb-1">
            Choices:
          </div>
          <ul className="space-y-1">
            {choices.map((choice, index) => (
              <li key={index} className="text-gray-200 text-sm flex items-start">
                <span className="mr-2">•</span>
                <span>{choice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {example && (
        <div>
          <div className="font-medium text-gray-300 text-xs uppercase tracking-wider mb-1">
            Example:
          </div>
          <div className="bg-gray-800 rounded px-2 py-1 text-green-300 font-mono text-xs">
            {example}
          </div>
        </div>
      )}

      {note && (
        <p className="text-gray-300 text-xs italic border-t border-gray-700 pt-2">
          {note}
        </p>
      )}
    </div>
  )

  return <Tooltip content={content} position={position} />
}
