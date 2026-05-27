import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductsPage from './components/ProductsPage';
import OrdersPage from './components/OrdersPage';
import BannersPage from './components/BannersPage';
import ReviewsPage from './components/ReviewsPage';
import LoginPage from './components/LoginPage';
import { View } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAdminAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAdminAuthenticated', 'true');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductsPage />;
      case 'orders':
        return <OrdersPage />;
      case 'banners':
        return <BannersPage />;
      case 'reviews':
        return <ReviewsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-light selection:text-brand-dark">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <div className="pl-64 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
