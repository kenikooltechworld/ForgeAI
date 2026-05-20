import React, { useState } from 'react';

export interface OptionData {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  references?: string[];
}

interface OptionCardProps {
  option: OptionData;
  selected?: boolean;
  onSelect: (id: string) => void;
  onCustomize?: (id: string, customization: string) => void;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  option,
  selected = false,
  onSelect,
  onCustomize,
}) => {
  const [customizing, setCustomizing] = useState(false);
  const [customText, setCustomText] = useState('');

  return (
    <div
      className={`
        border rounded-lg p-4 transition-all cursor-pointer
        ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
      `}
      onClick={() => onSelect(option.id)}
      role="button"
      aria-pressed={selected}
    >
      <h3 className="text-lg font-semibold mb-2">{option.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{option.description}</p>

      <div className="mb-3">
        <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
          Pros
        </span>
        <ul className="mt-1 space-y-1">
          {option.pros.map((pro, i) => (
            <li key={i} className="text-sm flex items-start">
              <span className="mr-2 text-green-500">+</span>
              {pro}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
          Cons
        </span>
        <ul className="mt-1 space-y-1">
          {option.cons.map((con, i) => (
            <li key={i} className="text-sm flex items-start">
              <span className="mr-2 text-red-500">-</span>
              {con}
            </li>
          ))}
        </ul>
      </div>

      {option.references && option.references.length > 0 && (
        <div className="text-xs text-gray-400 mb-3">
          References: {option.references.join(', ')}
        </div>
      )}

      {selected && onCustomize && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {!customizing ? (
            <button
              className="text-sm text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setCustomizing(true);
              }}
            >
              Customize this option
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full text-sm p-2 border rounded dark:bg-gray-800 dark:border-gray-600"
                rows={2}
                placeholder="Describe your customization..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2">
                <button
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCustomize(option.id, customText);
                    setCustomizing(false);
                  }}
                >
                  Save
                </button>
                <button
                  className="text-sm px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomizing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
