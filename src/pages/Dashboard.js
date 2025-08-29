import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  RefreshCw,
  Calendar,
  Clock
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { format } from 'date-fns';

const Dashboard = () => {
  const { 
    signals, 
    articles, 
    indicators, 
    loading, 
    lastUpdate, 
    refreshData 
  } = useTrading();

  const activeSignals = signals.filter(s => s.status === 'active');
  const buySignals = activeSignals.filter(s => s.signal_type === 'BUY');
  const sellSignals = activeSignals.filter(s => s.signal_type === 'SELL');

  const stats = [
    {
      title: 'Active Signals',
      value: activeSignals.length,
      change: '+12%',
      changeType: 'positive',
      icon: Activity,
      color: 'primary'
    },
    {
      title: 'Buy Signals',
      value: buySignals.length,
      change: '+8%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'success'
    },
    {
      title: 'Sell Signals',
      value: sellSignals.length,
      change: '-3%',
      changeType: 'negative',
      icon: TrendingDown,
      color: 'danger'
    },
    {
      title: 'Market Articles',
      value: articles.length,
      change: '+1',
      changeType: 'positive',
      icon: Calendar,
      color: 'warning'
    }
  ];

  const getColorClass = (color) => {
    const colors = {
      primary: 'text-primary-500',
      success: 'text-success-500',
      danger: 'text-danger-500',
      warning: 'text-warning-500'
    };
    return colors[color] || 'text-primary-500';
  };

  const getChangeColor = (changeType) => {
    return changeType === 'positive' ? 'text-success-500' : 'text-danger-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-2">
            AI-powered trading insights and market analysis
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-dark-400">Last Updated</p>
            <p className="text-sm text-white">
              {lastUpdate ? format(new Date(lastUpdate), 'MMM dd, HH:mm') : 'Never'}
            </p>
          </div>
          <button
            onClick={refreshData}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="card hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">{stat.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                <p className={`text-sm ${getChangeColor(stat.changeType)} mt-1`}>
                  {stat.change}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center ${getColorClass(stat.color)}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Trading Signals */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Trading Signals</h2>
            <span className="text-sm text-dark-400">{activeSignals.length} active</span>
          </div>
          <div className="space-y-3">
            {activeSignals.slice(0, 5).map((signal) => (
              <div key={signal.id} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    signal.signal_type === 'BUY' ? 'bg-success-500' : 
                    signal.signal_type === 'SELL' ? 'bg-danger-500' : 'bg-warning-500'
                  }`}></div>
                  <div>
                    <p className="font-medium text-white">{signal.symbol}</p>
                    <p className="text-sm text-dark-400">{signal.signal_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-mono">${signal.entry_price}</p>
                  <p className="text-sm text-dark-400">
                    {Math.round(signal.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
            ))}
            {activeSignals.length === 0 && (
              <p className="text-center text-dark-400 py-8">No active signals</p>
            )}
          </div>
        </div>

        {/* Latest Articles */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Latest Articles</h2>
            <span className="text-sm text-dark-400">{articles.length} total</span>
          </div>
          <div className="space-y-3">
            {articles.slice(0, 3).map((article) => (
              <div key={article.id} className="p-3 bg-dark-700 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    article.sentiment === 'bullish' ? 'bg-success-500' : 'bg-danger-500'
                  }`}></div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white text-sm line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-dark-400 mt-1">
                      {format(new Date(article.created_at), 'MMM dd')} • {article.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {articles.length === 0 && (
              <p className="text-center text-dark-400 py-8">No articles yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Market Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-8 h-8 text-success-500" />
            </div>
            <h3 className="font-semibold text-white">Bullish Sentiment</h3>
            <p className="text-2xl font-bold text-success-500 mt-2">
              {Math.round((buySignals.length / Math.max(activeSignals.length, 1)) * 100)}%
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingDown className="w-8 h-8 text-danger-500" />
            </div>
            <h3 className="font-semibold text-white">Bearish Sentiment</h3>
            <p className="text-2xl font-bold text-danger-500 mt-2">
              {Math.round((sellSignals.length / Math.max(activeSignals.length, 1)) * 100)}%
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="font-semibold text-white">Next Update</h3>
            <p className="text-lg font-medium text-primary-500 mt-2">6:00 AM</p>
            <p className="text-sm text-dark-400">Daily</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;