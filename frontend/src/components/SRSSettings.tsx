'use client';

import React, { useState, useEffect } from 'react';
import { SRSAlgorithmSettings, SRSSettingsManager, SRS_PRESETS, DEFAULT_SRS_SETTINGS } from '@/lib/srs-settings';

interface SRSSettingsProps {
  onClose?: () => void;
  onSettingsChange?: (settings: SRSAlgorithmSettings) => void;
}

export default function SRSSettings({ onClose, onSettingsChange }: SRSSettingsProps) {
  const [settings, setSettings] = useState<SRSAlgorithmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Helper function to get default value for a field
  const getDefaultValue = (field: keyof typeof DEFAULT_SRS_SETTINGS): number | string => {
    return DEFAULT_SRS_SETTINGS[field] as number | string;
  };

  // Helper function to check if a value is different from default
  const isDifferentFromDefault = (field: keyof typeof DEFAULT_SRS_SETTINGS, currentValue: number | string): boolean => {
    return currentValue !== getDefaultValue(field);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = await SRSSettingsManager.getSettings();
      setSettings(currentSettings);
      
      // Find matching preset
      const matchingPreset = SRS_PRESETS.find(preset => 
        preset.id === currentSettings.id
      );
      setSelectedPreset(matchingPreset?.id || 'custom');
    } catch (error) {
      console.error('Error loading SRS settings:', error);
      setErrors(['Failed to load SRS settings']);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SRSAlgorithmSettings, value: number | string) => {
    if (!settings) return;
    
    const updatedSettings = { ...settings, [field]: value };
    setSettings(updatedSettings);
    setSelectedPreset('custom'); // Mark as custom when manually edited
    
    // Clear errors when user makes changes
    setErrors([]);
  };

  const handlePresetChange = async (presetId: string) => {
    if (!presetId) return;
    
    try {
      setSelectedPreset(presetId);
      
      if (presetId === 'custom') {
        return; // Keep current settings
      }
      
      const preset = SRS_PRESETS.find(p => p.id === presetId);
      if (preset) {
        const presetSettings: SRSAlgorithmSettings = {
          ...preset.settings,
          id: settings?.id || 'default',
          name: preset.name,
          createdAt: settings?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setSettings(presetSettings);
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      setErrors(['Failed to apply preset']);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      setErrors([]);
      
      // Validate settings
      const validationErrors = SRSSettingsManager.validateSettings(settings);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      const savedSettings = await SRSSettingsManager.saveSettings(settings);
      setSettings(savedSettings);
      
      // Notify parent component
      if (onSettingsChange) {
        onSettingsChange(savedSettings);
      }
      
      // Show success message briefly
      setErrors(['Settings saved successfully!']);
      setTimeout(() => setErrors([]), 2000);
      
  // Thin client: no local algorithm cache to refresh anymore (removed refreshSettings call)
      
    } catch (error) {
      console.error('Error saving SRS settings:', error);
      setErrors(['Failed to save settings']);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all SRS settings to defaults? This cannot be undone.')) {
      return;
    }
    
    try {
      setSaving(true);
      const defaultSettings = await SRSSettingsManager.resetToDefaults();
      setSettings(defaultSettings);
      setSelectedPreset('supermemo2-default');
      setErrors(['Settings reset to defaults']);
      setTimeout(() => setErrors([]), 2000);
      
      if (onSettingsChange) {
        onSettingsChange(defaultSettings);
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      setErrors(['Failed to reset settings']);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading SRS settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load SRS settings</p>
        <button 
          onClick={loadSettings}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          SRS Algorithm Settings
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, index) => (
              <li key={index} className={error.includes('success') ? 'text-green-600' : 'text-red-600'}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preset Selection */}
      <div className="mb-6">
        <label htmlFor="preset-selection" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preset Configuration
        </label>
        <select
          id="preset-selection"
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="custom">Custom Settings</option>
          {SRS_PRESETS.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.name} - {preset.description}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
            Basic Settings
          </h3>

          <div>
            <label htmlFor="configuration-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Configuration Name
            </label>
            <input
              id="configuration-name"
              type="text"
              value={settings.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="initial-ease-factor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Ease Factor ({settings.initialEaseFactor})
              <span className="ml-2 text-xs text-gray-500">
                (Default: {getDefaultValue('initialEaseFactor')})
              </span>
            </label>
            <input
              id="initial-ease-factor"
              type="range"
              min="1.3"
              max="3.0"
              step="0.1"
              value={settings.initialEaseFactor}
              onChange={(e) => handleInputChange('initialEaseFactor', parseFloat(e.target.value))}
              className={`w-full ${isDifferentFromDefault('initialEaseFactor', settings.initialEaseFactor) ? 'accent-blue-500' : 'accent-gray-400'}`}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Hard (1.3)</span>
              <span>Default ({getDefaultValue('initialEaseFactor')})</span>
              <span>Easy (3.0)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="initial-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Interval (days)
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('initialInterval')})
                </span>
              </label>
              <input
                id="initial-interval"
                type="number"
                min="1"
                max="10"
                value={settings.initialInterval}
                onChange={(e) => handleInputChange('initialInterval', parseInt(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('initialInterval', settings.initialInterval) ? 'border-blue-500' : ''
                }`}
              />
            </div>
            <div>
              <label htmlFor="second-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Second Interval (days)
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('secondInterval')})
                </span>
              </label>
              <input
                id="second-interval"
                type="number"
                min="1"
                max="30"
                value={settings.secondInterval}
                onChange={(e) => handleInputChange('secondInterval', parseInt(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('secondInterval', settings.secondInterval) ? 'border-blue-500' : ''
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="min-ease-factor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Ease Factor
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('minEaseFactor')})
                </span>
              </label>
              <input
                id="min-ease-factor"
                type="number"
                min="1.0"
                max="2.0"
                step="0.1"
                value={settings.minEaseFactor}
                onChange={(e) => handleInputChange('minEaseFactor', parseFloat(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('minEaseFactor', settings.minEaseFactor) ? 'border-blue-500' : ''
                }`}
              />
            </div>
            <div>
              <label htmlFor="max-ease-factor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Maximum Ease Factor
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('maxEaseFactor')})
                </span>
              </label>
              <input
                id="max-ease-factor"
                type="number"
                min="2.0"
                max="5.0"
                step="0.1"
                value={settings.maxEaseFactor}
                onChange={(e) => handleInputChange('maxEaseFactor', parseFloat(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('maxEaseFactor', settings.maxEaseFactor) ? 'border-blue-500' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* Interval Limits */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
            Interval Limits
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="max-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Maximum Interval (days)
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('maxInterval')})
                </span>
              </label>
              <input
                id="max-interval"
                type="number"
                min="30"
                max="3650"
                value={settings.maxInterval}
                onChange={(e) => handleInputChange('maxInterval', parseInt(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('maxInterval', settings.maxInterval) ? 'border-blue-500' : ''
                }`}
              />
            </div>
            <div>
              <label htmlFor="graduation-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Graduation Interval (days)
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('graduationInterval')})
                </span>
              </label>
              <input
                id="graduation-interval"
                type="number"
                min="7"
                max="90"
                value={settings.graduationInterval}
                onChange={(e) => handleInputChange('graduationInterval', parseInt(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('graduationInterval', settings.graduationInterval) ? 'border-blue-500' : ''
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lapse-multiplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lapse Multiplier
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('lapseMultiplier')})
                </span>
              </label>
              <input
                id="lapse-multiplier"
                type="number"
                min="0.0"
                max="1.0"
                step="0.1"
                value={settings.lapseMultiplier}
                onChange={(e) => handleInputChange('lapseMultiplier', parseFloat(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('lapseMultiplier', settings.lapseMultiplier) ? 'border-blue-500' : ''
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">0.0 = Reset to minimum interval</p>
            </div>
            <div>
              <label htmlFor="lapse-min-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lapse Min Interval (days)
                <span className="ml-2 text-xs text-gray-500">
                  (Default: {getDefaultValue('lapseMinInterval')})
                </span>
              </label>
              <input
                id="lapse-min-interval"
                type="number"
                min="1"
                max="10"
                value={settings.lapseMinInterval}
                onChange={(e) => handleInputChange('lapseMinInterval', parseInt(e.target.value))}
                className={`w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  isDifferentFromDefault('lapseMinInterval', settings.lapseMinInterval) ? 'border-blue-500' : ''
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="mt-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 mb-4"
        >
          <span className={`mr-2 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Advanced Algorithm Parameters
        </button>

        {showAdvanced && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Easy Response Modifiers</h4>
                
                <div>
                  <label htmlFor="easy-bonus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Easy Bonus ({settings.easyBonus})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('easyBonus')})
                    </span>
                  </label>
                  <input
                    id="easy-bonus"
                    type="range"
                    min="0.05"
                    max="0.2"
                    step="0.01"
                    value={settings.easyBonus}
                    onChange={(e) => handleInputChange('easyBonus', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('easyBonus', settings.easyBonus) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="easy-penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Easy Penalty ({settings.easyPenalty})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('easyPenalty')})
                    </span>
                  </label>
                  <input
                    id="easy-penalty"
                    type="range"
                    min="0.05"
                    max="0.15"
                    step="0.01"
                    value={settings.easyPenalty}
                    onChange={(e) => handleInputChange('easyPenalty', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('easyPenalty', settings.easyPenalty) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="easy-penalty-multiplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Easy Penalty Multiplier ({settings.easyPenaltyMultiplier})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('easyPenaltyMultiplier')})
                    </span>
                  </label>
                  <input
                    id="easy-penalty-multiplier"
                    type="range"
                    min="0.01"
                    max="0.05"
                    step="0.001"
                    value={settings.easyPenaltyMultiplier}
                    onChange={(e) => handleInputChange('easyPenaltyMultiplier', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('easyPenaltyMultiplier', settings.easyPenaltyMultiplier) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Hard Response Modifiers</h4>
                
                <div>
                  <label htmlFor="hard-penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hard Penalty ({settings.hardPenalty})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('hardPenalty')})
                    </span>
                  </label>
                  <input
                    id="hard-penalty"
                    type="range"
                    min="0.4"
                    max="1.2"
                    step="0.1"
                    value={settings.hardPenalty}
                    onChange={(e) => handleInputChange('hardPenalty', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('hardPenalty', settings.hardPenalty) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="hard-penalty-linear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hard Penalty Linear ({settings.hardPenaltyLinear})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('hardPenaltyLinear')})
                    </span>
                  </label>
                  <input
                    id="hard-penalty-linear"
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.01"
                    value={settings.hardPenaltyLinear}
                    onChange={(e) => handleInputChange('hardPenaltyLinear', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('hardPenaltyLinear', settings.hardPenaltyLinear) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="hard-penalty-quadratic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hard Penalty Quadratic ({settings.hardPenaltyQuadratic})
                    <span className="ml-2 text-xs text-gray-500">
                      (Default: {getDefaultValue('hardPenaltyQuadratic')})
                    </span>
                  </label>
                  <input
                    id="hard-penalty-quadratic"
                    type="range"
                    min="0.01"
                    max="0.05"
                    step="0.001"
                    value={settings.hardPenaltyQuadratic}
                    onChange={(e) => handleInputChange('hardPenaltyQuadratic', parseFloat(e.target.value))}
                    className={`w-full ${
                      isDifferentFromDefault('hardPenaltyQuadratic', settings.hardPenaltyQuadratic) ? 'accent-blue-500' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-500">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}