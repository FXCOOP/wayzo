import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette,
  Database,
  Wifi,
  Save,
  RefreshCw
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

const Settings = () => {
  const { isConnected, refreshData } = useTrading();
  const [settings, setSettings] = useState({
    notifications: {
      newSignals: true,
      dailyArticles: true,
      priceAlerts: false,
      emailUpdates: false
    },
    display: {
      theme: 'dark',
      compactMode: false,
      showCharts: true,
      autoRefresh: true
    },
    trading: {
      riskTolerance: 'medium',
      maxSignals: 10,
      autoExecute: false,
      stopLossDefault: 5
    }
  });

  const [activeTab, setActiveTab] = useState('notifications');

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const handleSave = () => {
    // In a real app, you would save these settings to the backend
    console.log('Saving settings:', settings);
    // Show success message
  };

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'trading', label: 'Trading', icon: Shield },
    { id: 'system', label: 'System', icon: Database }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-dark-400 mt-2">
            Configure your trading preferences and system settings
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={refreshData}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="card">
        <div className="flex space-x-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-300 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">New Trading Signals</p>
                    <p className="text-sm text-dark-400">Get notified when new signals are generated</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.newSignals}
                      onChange={(e) => handleSettingChange('notifications', 'newSignals', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Daily Articles</p>
                    <p className="text-sm text-dark-400">Receive notifications for new market articles</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.dailyArticles}
                      onChange={(e) => handleSettingChange('notifications', 'dailyArticles', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Price Alerts</p>
                    <p className="text-sm text-dark-400">Get alerts when prices hit target levels</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.priceAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'priceAlerts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Email Updates</p>
                    <p className="text-sm text-dark-400">Receive daily summary emails</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailUpdates}
                      onChange={(e) => handleSettingChange('notifications', 'emailUpdates', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Display Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-dark-700 rounded-lg">
                  <label className="block text-sm font-medium text-white mb-2">Theme</label>
                  <select
                    value={settings.display.theme}
                    onChange={(e) => handleSettingChange('display', 'theme', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="p-4 bg-dark-700 rounded-lg">
                  <label className="block text-sm font-medium text-white mb-2">Risk Tolerance</label>
                  <select
                    value={settings.trading.riskTolerance}
                    onChange={(e) => handleSettingChange('trading', 'riskTolerance', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Compact Mode</p>
                    <p className="text-sm text-dark-400">Reduce spacing for more content</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.display.compactMode}
                      onChange={(e) => handleSettingChange('display', 'compactMode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Show Charts</p>
                    <p className="text-sm text-dark-400">Display interactive charts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.display.showCharts}
                      onChange={(e) => handleSettingChange('display', 'showCharts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Trading Tab */}
          {activeTab === 'trading' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Trading Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-dark-700 rounded-lg">
                  <label className="block text-sm font-medium text-white mb-2">Maximum Active Signals</label>
                  <input
                    type="number"
                    value={settings.trading.maxSignals}
                    onChange={(e) => handleSettingChange('trading', 'maxSignals', parseInt(e.target.value))}
                    className="input-field w-full"
                    min="1"
                    max="50"
                  />
                </div>

                <div className="p-4 bg-dark-700 rounded-lg">
                  <label className="block text-sm font-medium text-white mb-2">Default Stop Loss (%)</label>
                  <input
                    type="number"
                    value={settings.trading.stopLossDefault}
                    onChange={(e) => handleSettingChange('trading', 'stopLossDefault', parseFloat(e.target.value))}
                    className="input-field w-full"
                    min="1"
                    max="20"
                    step="0.5"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Auto-Execute Signals</p>
                    <p className="text-sm text-dark-400">Automatically execute high-confidence signals</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.autoExecute}
                      onChange={(e) => handleSettingChange('trading', 'autoExecute', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">System Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wifi className="w-4 h-4 text-dark-400" />
                    <span className="text-sm font-medium text-white">Connection Status</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                    <span className={`text-sm ${isConnected ? 'text-success-500' : 'text-danger-500'}`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Database className="w-4 h-4 text-dark-400" />
                    <span className="text-sm font-medium text-white">Data Source</span>
                  </div>
                  <span className="text-sm text-dark-300">AI Trading Signals API</span>
                </div>

                <div className="p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <RefreshCw className="w-4 h-4 text-dark-400" />
                    <span className="text-sm font-medium text-white">Update Frequency</span>
                  </div>
                  <span className="text-sm text-dark-300">Daily at 6:00 AM</span>
                </div>

                <div className="p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="w-4 h-4 text-dark-400" />
                    <span className="text-sm font-medium text-white">Security</span>
                  </div>
                  <span className="text-sm text-dark-300">HTTPS + WebSocket Secure</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;