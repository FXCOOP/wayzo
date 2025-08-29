import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const TradingContext = createContext();

const initialState = {
  signals: [],
  articles: [],
  indicators: [],
  loading: false,
  error: null,
  lastUpdate: null,
  isConnected: false,
};

function tradingReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SIGNALS':
      return { ...state, signals: action.payload, lastUpdate: new Date() };
    case 'SET_ARTICLES':
      return { ...state, articles: action.payload, lastUpdate: new Date() };
    case 'SET_INDICATORS':
      return { ...state, indicators: action.payload, lastUpdate: new Date() };
    case 'ADD_SIGNAL':
      return { ...state, signals: [action.payload, ...state.signals] };
    case 'ADD_ARTICLE':
      return { ...state, articles: [action.payload, ...state.articles] };
    case 'UPDATE_SIGNAL':
      return {
        ...state,
        signals: state.signals.map(signal =>
          signal.id === action.payload.id ? { ...signal, ...action.payload } : signal
        ),
      };
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    default:
      return state;
  }
}

export function TradingProvider({ children }) {
  const [state, dispatch] = useReducer(tradingReducer, initialState);
  const wsRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:3002');
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        };
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'daily_update':
        if (data.article) {
          dispatch({ type: 'ADD_ARTICLE', payload: data.article });
          toast.success('New daily article published!');
        }
        if (data.signals && data.signals.length > 0) {
          data.signals.forEach(signal => {
            dispatch({ type: 'ADD_SIGNAL', payload: signal });
          });
          toast.success(`${data.signals.length} new trading signals available!`);
        }
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [signalsRes, articlesRes, indicatorsRes] = await Promise.all([
        axios.get('/api/signals'),
        axios.get('/api/articles'),
        axios.get('/api/indicators'),
      ]);
      
      dispatch({ type: 'SET_SIGNALS', payload: signalsRes.data });
      dispatch({ type: 'SET_ARTICLES', payload: articlesRes.data });
      dispatch({ type: 'SET_INDICATORS', payload: indicatorsRes.data });
    } catch (error) {
      console.error('Error fetching initial data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch data' });
      toast.error('Failed to load data');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateSignalStatus = async (signalId, status) => {
    try {
      await axios.post(`/api/signals/${signalId}/update`, { status });
      dispatch({ type: 'UPDATE_SIGNAL', payload: { id: signalId, status } });
      toast.success('Signal status updated');
    } catch (error) {
      console.error('Error updating signal:', error);
      toast.error('Failed to update signal');
    }
  };

  const refreshData = () => {
    fetchInitialData();
  };

  const value = {
    ...state,
    updateSignalStatus,
    refreshData,
    isConnected: state.isConnected,
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}