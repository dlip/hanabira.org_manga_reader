'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeSettings({ isOpen, onClose }: ThemeSettingsProps) {
  const { theme, toggleTheme, fontSize, setFontSize } = useTheme();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-800/75 backdrop-blur-sm transition-all" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Theme Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                  Dark Mode
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Switch between light and dark themes
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
            </div>

            {/* Font Size Adjustment */}
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Font Size
              </label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setFontSize(14)}
                  className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                    fontSize === 14
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>Small</span>
                </button>
                <button
                  onClick={() => setFontSize(16)}
                  className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                    fontSize === 16
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>Normal</span>
                </button>
                <button
                  onClick={() => setFontSize(18)}
                  className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                    fontSize === 18
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>Large</span>
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Preview
              </label>
              <p
                className="font-japanese text-gray-900 dark:text-gray-100"
                style={{ fontSize: `${fontSize}px` }}
              >
                こんにちは世界
              </p>
              <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                Hello World
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
