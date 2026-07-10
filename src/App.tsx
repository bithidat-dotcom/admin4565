import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductsPage from './components/ProductsPage';
import OrdersPage from './components/OrdersPage';
import BannersPage from './components/BannersPage';
import ReviewsPage from './components/ReviewsPage';
import UsersPage from './components/UsersPage';
import SellersPage from './components/SellersPage';
import SettingsPage from './components/SettingsPage';
import LoginPage from './components/LoginPage';
import LinkConverterModal from './components/LinkConverterModal';
import PopupAd from './components/PopupAd';
import MobileNav from './components/MobileNav';
import { View } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from './lib/firebase';
import { Storage } from './lib/storage';
import { AlertCircle, WifiOff, X } from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs, updateDoc, doc, limit, orderBy } from 'firebase/firestore';
import { cn } from './lib/utils';

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
  const [theme, setTheme] = useState<'light' | 'soft' | 'slate'>('light');
  const [quotaError, setQuotaError] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('firestore_quota_exceeded_date') === new Date().toDateString()) {
      setQuotaError(true);
    }

    const handleQuotaExceeded = () => setQuotaError(true);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') as any;
    if (savedTheme) setTheme(savedTheme || 'light');

    const handleThemeChange = () => {
      const newTheme = localStorage.getItem('app-theme') as any;
      if (newTheme) setTheme(newTheme);
    };

    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || quotaError || isQuotaExceeded()) return;
    
    // Background listener only for Admin to centralize heavy operations
    if (userSession?.role !== 'admin') return;
    
    // Background listener to automatically adjust product stock and repair missing seller data
    // Limited to recent 20 orders to save quota
    const qBackground = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(20));
    const unsubscribe = onSnapshot(qBackground, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const orderId = change.doc.id;
        const orderData = change.doc.data();
        const status = orderData.status;
        const productName = orderData.product_name;
        const quantity = Number(orderData.quantity) || 1;
        const isAdjusted = orderData.stock_adjusted === true;

        if (!productName) continue;

        // --- 1. FORCE CORRECT SELLER_ID ---
        // Lookup from product and fix it, in case the frontend missed it or sent the wrong one
        if (!orderData.seller_id) {
          try {
            const pQuery = query(collection(db, 'products'), where('name', '==', productName));
            const pSnap = await getDocs(pQuery);
            if (!pSnap.empty) {
              const pData = pSnap.docs[0].data();
              if (pData.seller_id && pData.seller_id !== orderData.seller_id) {
                await updateDoc(doc(db, 'orders', orderId), {
                  seller_id: pData.seller_id,
                  seller: pData.seller || 'N/A'
                });
                console.log(`Forced seller_id for order ${orderId} -> ${pData.seller_id}`);
              }
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, 'products'); console.error("Error repairing seller_id:", e);
          }
        }

        // --- 2. STOCK ADJUSTMENT ---
        // Only proceed with adjustment logic if we are Admin OR the owner of the order
        const isAdmin = userSession?.role === 'admin';
        const isOwner = userSession?.sellerId && (orderData.seller_id === userSession.sellerId || orderData.seller === userSession.name);
        
        if (isAdmin || isOwner) {
          // Case 1: Subtract stock on a fresh order placement
          const orderTime = orderData.created_at?.toDate?.() || new Date(orderData.created_at || Date.now());
          const isRecent = (Date.now() - orderTime.getTime()) < 60 * 60 * 1000;

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
                await updateDoc(doc(db, 'orders', orderId), {
                  stock_adjusted: true
                });
              }
            } catch (e) {
              console.error("Error auto-adjusting stock on order placement:", e);
            }
          }
          
          // Case 2: Restore stock if the order gets cancelled
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
              handleFirestoreError(e, OperationType.UPDATE, 'products'); console.error("Error restoring stock on order cancellation:", e);
            }
          }
        }
      }
    }, (error) => {
      
      handleFirestoreError(error, OperationType.LIST, 'orders');
      console.error("Background orders listener error:", error);
    });

    return () => unsubscribe();
  }, [isAuthenticated, userSession]);

  useEffect(() => {
    const authStatus = Storage.getSmall<string>('isAdminAuthenticated');
    const sessionStr = Storage.getSmall<string>('userSession');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      if (sessionStr) {
        try {
          setUserSession(typeof sessionStr === 'string' ? JSON.parse(sessionStr) : sessionStr);
        } catch {
          setUserSession({ role: 'admin' });
        }
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
    Storage.setSmall('isAdminAuthenticated', 'true');
    Storage.setSmall('userSession', JSON.stringify(session));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserSession(null);
    Storage.removeSmall('isAdminAuthenticated');
    Storage.removeSmall('userSession');
  };

  const renderView = () => {
    const isSeller = userSession?.role === 'seller';
    
    // Auto-redirect sellers to products if they try to access prohibited areas
    if (isSeller && ['workers', 'banners', 'settings', 'users', 'reviews'].includes(currentView)) {
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
        return <SellersPage userSession={userSession} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  const renderMainContent = () => {
    if (!isAuthenticated) {
      return <LoginPage onLogin={handleLogin} />;
    }

    const themeClasses = {
      light: 'bg-slate-50',
      soft: 'bg-orange-50/30',
      slate: 'bg-slate-100'
    };

    return (
      <div className={cn("min-h-screen font-sans text-slate-900 selection:bg-brand-light selection:text-brand-dark transition-colors duration-500", themeClasses[theme])}>
        <PopupAd />                
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogout}
          userSession={userSession}
        />
        
        <div className="md:pl-64 pl-0 min-h-screen flex flex-col pb-20 md:pb-0">
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

        <MobileNav currentView={currentView} onViewChange={setCurrentView} />

        <LinkConverterModal 
          isOpen={isGlobalConverterOpen} 
          onClose={() => setIsGlobalConverterOpen(false)} 
        />
      </div>
    );
  };

  return (
    <>
      {renderMainContent()}
    </>
  );
}
