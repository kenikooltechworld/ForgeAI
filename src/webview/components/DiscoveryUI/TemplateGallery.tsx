import React from 'react';

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface TemplateGalleryProps {
  templates: TemplateItem[];
  onSelect: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  CRUD: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Auth: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  Dashboard: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  API: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'E-commerce': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  Other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ templates, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800"
          onClick={() => onSelect(template.id)}
          role="button"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-base">{template.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                CATEGORY_COLORS[template.category] || CATEGORY_COLORS.Other
              }`}
            >
              {template.category}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{template.description}</p>
          <div className="mt-3 flex justify-end">
            <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Use this template
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
