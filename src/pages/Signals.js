import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { format } from 'date-fns';

const Signals = () => {
  const { signals, updateSignalStatus } = useTrading();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSignals = signals.filter(signal => {
    const matchesFilter = filter === 'all' || signal.signal_type === filter;
    const matchesSearch = signal.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getSignalIcon = (type) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="w-5 h-5 text-success-500" />;
      case 'SELL':
        return <TrendingDown className="w-5 h-5 text-danger-500" />;
      case 'HOLD':
        return <Minus className="w-5 h-5 text-warning-500" />;
      default:
        return <Minus className="w-5 h-5 text-dark-400" />;
    }
  };

  const getSignalColor = (type) => {
    switch (type) {
      case 'BUY':
        return 'border-success-500 bg-success-500/10';
      case 'SELL':
        return 'border-danger-500 bg-danger-500/10';
      case 'HOLD':
        return 'border-warning-500 bg-warning-500/10';
      default:
        return 'border-dark-600 bg-dark-700';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-success-500';
    if (confidence >= 0.6) return 'text-warning-500';
    return 'text-danger-500';
  };

  const handleStatusUpdate = (signalId, newStatus) => {
    updateSignalStatus(signalId, newStatus);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Trading Signals</h1>
          <p className="text-dark-400 mt-2">
            AI-generated trading recommendations and market signals
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-dark-400">Total Signals</p>
          <p className="text-2xl font-bold text-white">{signals.length}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search symbols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {['all', 'BUY', 'SELL', 'HOLD'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                filter === filterType
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {filterType === 'all' ? 'All' : filterType}
            </button>
          ))}
        </div>
      </div>

      {/* Signals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSignals.map((signal) => (
          <div
            key={signal.id}
            className={`card border-l-4 ${getSignalColor(signal.signal_type)} hover:shadow-xl transition-all duration-300`}
          >
            {/* Signal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getSignalIcon(signal.signal_type)}
                <div>
                  <h3 className="text-xl font-bold text-white">{signal.symbol}</h3>
                  <p className="text-sm text-dark-400">{signal.signal_type}</p>
                </div>
              </div>
              <div className={`badge ${getConfidenceColor(signal.confidence)}`}>
                {Math.round(signal.confidence * 100)}% confidence
              </div>
            </div>

            {/* Price Information */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-dark-400">Entry</p>
                <p className="text-lg font-bold text-white font-mono">
                  ${parseFloat(signal.entry_price).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-dark-400">Target</p>
                <p className="text-lg font-bold text-success-500 font-mono">
                  ${parseFloat(signal.target_price).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-dark-400">Stop Loss</p>
                <p className="text-lg font-bold text-danger-500 font-mono">
                  ${parseFloat(signal.stop_loss).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Analysis */}
            <div className="mb-4">
              <p className="text-sm text-dark-400 mb-2">Analysis</p>
              <p className="text-sm text-white leading-relaxed">
                {signal.analysis}
              </p>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-sm text-dark-400">
                <Clock className="w-4 h-4" />
                <span>{format(new Date(signal.created_at), 'MMM dd, HH:mm')}</span>
              </div>
              <span className={`badge ${
                signal.status === 'active' ? 'badge-success' : 'badge-warning'
              }`}>
                {signal.status}
              </span>
            </div>

            {/* Actions */}
            {signal.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusUpdate(signal.id, 'executed')}
                  className="btn-success flex-1 flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Execute</span>
                </button>
                <button
                  onClick={() => handleStatusUpdate(signal.id, 'cancelled')}
                  className="btn-danger flex-1 flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}

            {/* Risk/Reward Ratio */}
            <div className="mt-4 pt-4 border-t border-dark-600">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Risk/Reward</span>
                <span className="text-white font-medium">
                  {((parseFloat(signal.target_price) - parseFloat(signal.entry_price)) / 
                    (parseFloat(signal.entry_price) - parseFloat(signal.stop_loss))).toFixed(2)}:1
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredSignals.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No signals found</h3>
          <p className="text-dark-400">
            {searchTerm || filter !== 'all' 
              ? 'Try adjusting your filters or search terms'
              : 'No trading signals available at the moment'
            }
          </p>
        </div>
      )}

      {/* Signal Statistics */}
      {signals.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Signal Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {signals.filter(s => s.signal_type === 'BUY').length}
              </p>
              <p className="text-sm text-dark-400">Buy Signals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {signals.filter(s => s.signal_type === 'SELL').length}
              </p>
              <p className="text-sm text-dark-400">Sell Signals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {signals.filter(s => s.signal_type === 'HOLD').length}
              </p>
              <p className="text-sm text-dark-400">Hold Signals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {signals.filter(s => s.status === 'active').length}
              </p>
              <p className="text-sm text-dark-400">Active</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signals;