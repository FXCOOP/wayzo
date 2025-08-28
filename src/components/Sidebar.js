import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  TrendingUp, 
  FileText, 
  BarChart3, 
  Settings, 
  Zap,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

const Sidebar = () => {
  const { isConnected } = useTrading();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/signals', icon: TrendingUp, label: 'Trading Signals' },
    { path: '/articles', icon: FileText, label: 'Market Articles' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
      {/* Logo and Header */}
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-success-500 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">AI Trading</h1>
            <p className="text-sm text-dark-400">Signals & Analysis</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Live Updates</span>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-success-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-danger-500" />
            )}
            <span className={`text-xs ${isConnected ? 'text-success-500' : 'text-danger-500'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-700">
        <div className="text-center">
          <p className="text-xs text-dark-400">
            Powered by AI
          </p>
          <p className="text-xs text-dark-500 mt-1">
            Real-time market intelligence
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;