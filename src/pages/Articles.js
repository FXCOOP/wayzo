import React, { useState } from 'react';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Clock,
  Search,
  Filter,
  BookOpen,
  Eye,
  XCircle
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { format } from 'date-fns';

const Articles = () => {
  const { articles } = useTrading();
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredArticles = articles.filter(article => {
    const matchesFilter = filter === 'all' || article.category === filter;
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const categories = ['all', ...Array.from(new Set(articles.map(a => a.category)))];

  const getSentimentIcon = (sentiment) => {
    return sentiment === 'bullish' ? 
      <TrendingUp className="w-5 h-5 text-success-500" /> : 
      <TrendingDown className="w-5 h-5 text-danger-500" />;
  };

  const getSentimentColor = (sentiment) => {
    return sentiment === 'bullish' ? 'text-success-500' : 'text-danger-500';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Market Analysis': 'bg-primary-500/20 text-primary-400',
      'Economic Review': 'bg-success-500/20 text-success-400',
      'Sector Focus': 'bg-warning-500/20 text-warning-400',
      'Global Markets': 'bg-purple-500/20 text-purple-400'
    };
    return colors[category] || 'bg-dark-600 text-dark-300';
  };

  const formatContent = (content) => {
    // Simple content formatting - in a real app you might use a markdown parser
    return content.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-4 text-dark-300 leading-relaxed">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Market Articles</h1>
          <p className="text-dark-400 mt-2">
            AI-generated market analysis and economic insights
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-dark-400">Total Articles</p>
          <p className="text-2xl font-bold text-white">{articles.length}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                filter === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <div
            key={article.id}
            className="card hover:shadow-xl transition-all duration-300 cursor-pointer"
            onClick={() => setSelectedArticle(article)}
          >
            {/* Article Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                  {article.title}
                </h3>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`badge ${getCategoryColor(article.category)}`}>
                    {article.category}
                  </span>
                  <div className="flex items-center space-x-1">
                    {getSentimentIcon(article.sentiment)}
                    <span className={`text-sm ${getSentimentColor(article.sentiment)}`}>
                      {article.sentiment}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <p className="text-sm text-dark-300 mb-4 line-clamp-3">
              {article.summary}
            </p>

            {/* Meta Information */}
            <div className="flex items-center justify-between text-sm text-dark-400">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(article.created_at), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>Read More</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No articles found</h3>
          <p className="text-dark-400">
            {searchTerm || filter !== 'all' 
              ? 'Try adjusting your filters or search terms'
              : 'No market articles available at the moment'
            }
          </p>
        </div>
      )}

      {/* Article Statistics */}
      {articles.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Article Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {articles.filter(a => a.sentiment === 'bullish').length}
              </p>
              <p className="text-sm text-dark-400">Bullish</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {articles.filter(a => a.sentiment === 'bearish').length}
              </p>
              <p className="text-sm text-dark-400">Bearish</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {Array.from(new Set(articles.map(a => a.category))).length}
              </p>
              <p className="text-sm text-dark-400">Categories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {articles.length > 0 ? format(new Date(articles[0].created_at), 'MMM dd') : 'N/A'}
              </p>
              <p className="text-sm text-dark-400">Latest</p>
            </div>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <span className={`badge ${getCategoryColor(selectedArticle.category)}`}>
                    {selectedArticle.category}
                  </span>
                  <div className="flex items-center space-x-2">
                    {getSentimentIcon(selectedArticle.sentiment)}
                    <span className={`text-sm ${getSentimentColor(selectedArticle.sentiment)}`}>
                      {selectedArticle.sentiment}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-dark-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Article Title */}
              <h1 className="text-2xl font-bold text-white mb-4">
                {selectedArticle.title}
              </h1>

              {/* Article Meta */}
              <div className="flex items-center space-x-4 text-sm text-dark-400 mb-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(selectedArticle.created_at), 'MMMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{format(new Date(selectedArticle.created_at), 'HH:mm')}</span>
                </div>
              </div>

              {/* Article Content */}
              <div className="prose prose-invert max-w-none">
                {formatContent(selectedArticle.content)}
              </div>

              {/* Article Summary */}
              <div className="mt-6 p-4 bg-dark-700 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Summary</h3>
                <p className="text-dark-300">{selectedArticle.summary}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Articles;