import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductsPage from './components/ProductsPage';
import OrdersPage from './components/OrdersPage';
import BannersPage from './components/BannersPage';
import ReviewsPage from './components/ReviewsPage';
import UsersPage from './components/UsersPage';
import SellersPage from './components/SellersPage';
import LoginPage from './components/LoginPage';
import LinkConverterModal from './components/LinkConverterModal';
import PopupAd from './components/PopupAd';
import { View } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, where, getDocs, updateDoc, doc, limit, orderBy } from 'firebase/firestore';                

export interface UserSession {
  role: 'admin' | 'seller';
  name?: string;
  sellerId?: string;
}

export default function App() {                
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [isGlobalConverterOpen, setIsGlobalConverterOpen] = useState(false);

  useEffect(() => {
    // Only run stock synchronization if admin is logged in (to prevent seller quota use/interception)
    if (!isAuthenticated || userSession?.role !== 'admin') return;
    
    // Background listener to automatically adjust product stock in real-time when orders are placed or cancelled
    // Limited to recent 50 orders to save quota and only handle active business flow
    const qBackground = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(qBackground, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const orderId = change.doc.id;
        const orderData = change.doc.data();
        const status = orderData.status;
        const productName = orderData.product_name;
        const quantity = Number(orderData.quantity) || 1;
        const isAdjusted = orderData.stock_adjusted === true;

        if (!productName) continue;

        // Is it created very recently (e.g. within last 1 hour) or is it a modification of status?
        const orderTime = orderData.created_at?.toDate?.() || new Date(orderData.created_at || Date.now());
        const isRecent = (Date.now() - orderTime.getTime()) < 60 * 60 * 1000; // 1 hour threshold

        // Case 1: Subtract stock on a fresh order placement (must be a recent order, or actively added/modified)
        if (status !== 'cancelled' && !isAdjusted && (change.type === 'added' ? isRecent : change.type === 'modified')) {
          try {
            const pQuery = query(collection(db, 'products'), where('name', '==', productName));
            const pSnap = await getDocs(pQuery);
            if (!pSnap.empty) {
              const pDoc = pSnap.docs[0];
              const pData = pDoc.data();
              const currentStock = Number(pData.stock) || 0;
              const currentQty = Number(pData.quantity) || Number(pData.qty) || 0;
              const currentSold = Number(pData.sold) || 0;

              await updateDoc(pDoc.ref, {
                stock: Math.max(0, currentStock - quantity),
                quantity: Math.max(0, currentQty - quantity),
                qty: Math.max(0, currentQty - quantity),
                sold: currentSold + quantity
              });
              
              await updateDoc(doc(db, 'orders', orderId), {
                stock_adjusted: true
              });
              console.log(`Auto-adjusted stock for product [${productName}] on order placement: -${quantity}`);
            } else {
              // mark handled anyway so we don't keep retrying
              await updateDoc(doc(db, 'orders', orderId), {
                stock_adjusted: true
              });
            }
          } catch (e) {
            console.error("Error auto-adjusting stock on order placement:", e);
          }
        }
        
        // Case 2: Restore stock if the order gets cancelled (can be any historical edit)
        else if (status === 'cancelled' && isAdjusted && change.type === 'modified') {
          try {
            const pQuery = query(collection(db, 'products'), where('name', '==', productName));
            const pSnap = await getDocs(pQuery);
            if (!pSnap.empty) {
              const pDoc = pSnap.docs[0];
              const pData = pDoc.data();
              const currentStock = Number(pData.stock) || 0;
              const currentQty = Number(pData.quantity) || Number(pData.qty) || 0;
              const currentSold = Number(pData.sold) || 0;

              await updateDoc(pDoc.ref, {
                stock: currentStock + quantity,
                quantity: currentQty + quantity,
                qty: currentQty + quantity,
                sold: Math.max(0, currentSold - quantity)
              });
              
              await updateDoc(doc(db, 'orders', orderId), {
                stock_adjusted: false
              });
              console.log(`Restored stock for product [${productName}] on order cancellation: +${quantity}`);
            } else {
              await updateDoc(doc(db, 'orders', orderId), {
                stock_adjusted: false
              });
            }
          } catch (e) {
            console.error("Error restoring stock on order cancellation:", e);
          }
        }
      }
    }, (error) => {
      console.error("Background orders listener error:", error);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAdminAuthenticated');
    const sessionStr = localStorage.getItem('userSession');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      if (sessionStr) {
        setUserSession(JSON.parse(sessionStr));
      } else {
        setUserSession({ role: 'admin' });
      }
    }
  }, []);

  useEffect(() => {
    const handleOpenSidebar = () => setIsSidebarOpen(true);
    window.addEventListener('open-sidebar', handleOpenSidebar);
    return () => window.removeEventListener('open-sidebar', handleOpenSidebar);
  }, []);

  useEffect(() => {
    const handleOpenConverter = () => setIsGlobalConverterOpen(true);
    window.addEventListener('open-link-converter', handleOpenConverter);
    return () => window.removeEventListener('open-link-converter', handleOpenConverter);
  }, []);

  const handleLogin = (session: UserSession) => {
    setIsAuthenticated(true);
    setUserSession(session);
    localStorage.setItem('isAdminAuthenticated', 'true');
    localStorage.setItem('userSession', JSON.stringify(session));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserSession(null);
    localStorage.removeItem('isAdminAuthenticated');
    localStorage.removeItem('userSession');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderView = () => {
    const isSeller = userSession?.role === 'seller';
    
    // Auto-redirect sellers to products if they try to access prohibited areas
    if (isSeller && ['workers', 'banners', 'settings', 'users', 'reviews', 'sellers'].includes(currentView)) {
      return (
        <ProductsPage 
            defaultCategory={filterCategory}
            onCategoryFilterChange={setFilterCategory}
            onViewChange={setCurrentView}
            userSession={userSession}
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            onViewChange={setCurrentView} 
            defaultCategory={filterCategory}
            onCategoryFilterChange={(cat) => {
              setFilterCategory(cat);
              setCurrentView('products');
            }}
            userSession={userSession}
          />
        );
      case 'products':
        return (
          <ProductsPage 
            defaultCategory={filterCategory}
            onCategoryFilterChange={setFilterCategory}
            onViewChange={setCurrentView}
            userSession={userSession}
          />
        );
      case 'orders':
        return <OrdersPage userSession={userSession} />;
      case 'banners':
        return <BannersPage />;
      case 'reviews':
        return <ReviewsPage />;
      case 'users':
        return <UsersPage onViewChange={setCurrentView} />;
      case 'sellers':
        return <SellersPage />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-light selection:text-brand-dark">
      <PopupAd />                
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
        userSession={userSession}
      />
      
      <div className="md:pl-64 pl-0 min-h-screen flex flex-col">
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

      <LinkConverterModal 
        isOpen={isGlobalConverterOpen} 
        onClose={() => setIsGlobalConverterOpen(false)} 
      />
    </div>
  );
}
