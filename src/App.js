import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Signals from './pages/Signals';
import Articles from './pages/Articles';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { TradingProvider } from './context/TradingContext';

function App() {
  return (
    <TradingProvider>
      <Router>
        <div className="flex h-screen bg-dark-900">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-dark-900">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/signals" element={<Signals />} />
                <Route path="/articles" element={<Articles />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
            },
          }}
        />
      </Router>
    </TradingProvider>
  );
}

export default App;