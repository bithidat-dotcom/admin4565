import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import Header from '../components/Header';
import { ShoppingBag, ShoppingCart, TrendingUp, Users, Loader2, Star } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Order } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalBanners: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    totalReviews: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to orders for revenue, total count, and recent list
    const qOrders = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      const revenue = orders.reduce((sum, order) => 
        sum + (['delivered', 'shipped', 'processing'].includes(order.status) ? order.price : 0), 0
      );
      const pending = orders.filter(o => o.status === 'pending').length;

      setStats(prev => ({
        ...prev,
        totalOrders: orders.length,
        totalRevenue: revenue,
        pendingOrders: pending
      }));
      setRecentOrders(orders.slice(0, 5));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Listen to products count
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalProducts: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    // Listen to banners count
    const unsubscribeBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalBanners: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    // Listen to reviews count
    const unsubscribeReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalReviews: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reviews'));

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeBanners();
      unsubscribeReviews();
    };
  }, []);

  const statCards = [
    { label: 'DELIVERY REVENUE', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', change: 'Live from Firestore', changeColor: 'text-emerald-500' },
    { label: 'LIVE ORDERS', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-brand', bg: 'bg-indigo-50', change: `${stats.pendingOrders} pending confirmation`, changeColor: 'text-brand' },
    { label: 'STORE PRODUCTS', value: stats.totalProducts.toString(), icon: ShoppingBag, color: 'text-brand-dark', bg: 'bg-slate-100', change: 'Database Inventory', changeColor: 'text-blue-500' },
    { label: 'CUSTOMER REVIEWS', value: stats.totalReviews.toString(), icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', change: 'Feedback received', changeColor: 'text-amber-500' },
  ];

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Dashboard" />

      <main className="p-8 space-y-8 max-w-[1240px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-2.5 rounded-xl transition-colors duration-300", stat.bg, "group-hover:bg-slate-900 group-hover:text-white")}>
                      <stat.icon className={cn("w-5 h-5", stat.color, "group-hover:text-white")} />
                    </div>
                    <div className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md", stat.changeColor, "bg-slate-50")}>
                      STATUS
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</div>
                  <div className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{stat.value}</div>
                  <p className="text-[10px] font-bold text-slate-400 mt-4 flex items-center gap-1.5 uppercase tracking-wider">
                     {stat.change}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Feed */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">Real-time Orders Feed</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global stream activity from Firestore</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-brand bg-slate-900 px-3 py-1.5 rounded-lg uppercase tracking-wider text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Syncing
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order ID</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Customer</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentOrders.map((order, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-xs font-mono text-slate-400">#{order.id.slice(0, 8)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-bold text-slate-900">{order.customer_name}</div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              {order.whatsapp_number}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm font-black text-slate-900 text-right">{formatCurrency(order.price)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                              order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                              order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                              order.status === 'cancelled' ? "bg-red-100 text-red-700" :
                              "bg-indigo-100 text-indigo-700"
                            )}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-sm italic font-bold uppercase tracking-widest">
                            No orders detected in data stream.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar Modules */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Infrastructure Status</h3>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Firestore Status</span>
                         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Operational
                         </span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Rules</span>
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Enforced</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Region</span>
                         <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Multi-Region</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
