import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Activity,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

const Analytics = () => {
  const { signals, articles } = useTrading();

  const activeSignals = signals.filter(s => s.status === 'active');
  const executedSignals = signals.filter(s => s.status === 'executed');
  const cancelledSignals = signals.filter(s => s.status === 'cancelled');

  const signalPerformance = {
    total: signals.length,
    active: activeSignals.length,
    executed: executedSignals.length,
    cancelled: cancelledSignals.length,
    successRate: executedSignals.length > 0 ? (executedSignals.length / signals.length * 100).toFixed(1) : 0
  };

  const categoryBreakdown = articles.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1;
    return acc;
  }, {});

  const sentimentBreakdown = articles.reduce((acc, article) => {
    acc[article.sentiment] = (acc[article.sentiment] || 0) + 1;
    return acc;
  }, {});

  const getSignalTypeStats = () => {
    const stats = signals.reduce((acc, signal) => {
      acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1;
      return acc;
    }, {});
    
    return [
      { type: 'BUY', count: stats.BUY || 0, color: 'text-success-500', bgColor: 'bg-success-500/20' },
      { type: 'SELL', count: stats.SELL || 0, color: 'text-danger-500', bgColor: 'bg-danger-500/20' },
      { type: 'HOLD', count: stats.HOLD || 0, color: 'text-warning-500', bgColor: 'bg-warning-500/20' }
    ];
  };

  const getConfidenceDistribution = () => {
    const distribution = {
      high: signals.filter(s => s.confidence >= 0.8).length,
      medium: signals.filter(s => s.confidence >= 0.6 && s.confidence < 0.8).length,
      low: signals.filter(s => s.confidence < 0.6).length
    };
    return distribution;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-dark-400 mt-2">
            Performance metrics and trading signal analysis
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-dark-400">Success Rate</p>
          <p className="text-2xl font-bold text-success-500">{signalPerformance.successRate}%</p>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Signals</p>
              <p className="text-2xl font-bold text-white">{signalPerformance.total}</p>
            </div>
            <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary-500" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Active Signals</p>
              <p className="text-2xl font-bold text-white">{signalPerformance.active}</p>
            </div>
            <div className="w-12 h-12 bg-success-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-success-500" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Executed</p>
              <p className="text-2xl font-bold text-white">{signalPerformance.executed}</p>
            </div>
            <div className="w-12 h-12 bg-success-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success-500" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Cancelled</p>
              <p className="text-2xl font-bold text-white">{signalPerformance.cancelled}</p>
            </div>
            <div className="w-12 h-12 bg-danger-500/20 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-danger-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signal Type Distribution */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Signal Type Distribution</h2>
          <div className="space-y-4">
            {getSignalTypeStats().map((stat) => (
              <div key={stat.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${stat.bgColor}`}></div>
                  <span className="text-white font-medium">{stat.type}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-dark-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${stat.bgColor.replace('/20', '')}`}
                      style={{ width: `${(stat.count / Math.max(signals.length, 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className={`font-mono ${stat.color}`}>{stat.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Confidence Distribution</h2>
          <div className="space-y-4">
            {Object.entries(getConfidenceDistribution()).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <span className="text-white font-medium capitalize">{level} Confidence</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-dark-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        level === 'high' ? 'bg-success-500' : 
                        level === 'medium' ? 'bg-warning-500' : 'bg-danger-500'
                      }`}
                      style={{ width: `${(count / Math.max(signals.length, 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-mono">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Article Categories */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Article Categories</h2>
          <div className="space-y-3">
            {Object.entries(categoryBreakdown).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <span className="text-white font-medium">{category}</span>
                <span className="text-primary-500 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Analysis */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Market Sentiment</h2>
          <div className="space-y-3">
            {Object.entries(sentimentBreakdown).map(([sentiment, count]) => (
              <div key={sentiment} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    sentiment === 'bullish' ? 'bg-success-500' : 'bg-danger-500'
                  }`}></div>
                  <span className="text-white font-medium capitalize">{sentiment}</span>
                </div>
                <span className={`font-mono ${
                  sentiment === 'bullish' ? 'text-success-500' : 'text-danger-500'
                }`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-10 h-10 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Success Rate</h3>
            <p className="text-3xl font-bold text-success-500">{signalPerformance.successRate}%</p>
            <p className="text-sm text-dark-400 mt-1">of signals executed</p>
          </div>
          
          <div className="text-center">
            <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-10 h-10 text-primary-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Active Signals</h3>
            <p className="text-3xl font-bold text-primary-500">{signalPerformance.active}</p>
            <p className="text-sm text-dark-400 mt-1">currently tracking</p>
          </div>
          
          <div className="text-center">
            <div className="w-20 h-20 bg-warning-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-warning-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Daily Articles</h3>
            <p className="text-3xl font-bold text-warning-500">{articles.length}</p>
            <p className="text-sm text-dark-400 mt-1">market insights</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;