import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import Header from '../components/Header';
import LoadingDots from './LoadingDots';
import { 
  ShoppingBag, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Loader2, 
  Star, 
  Trash2, 
  ArrowRight, 
  BarChart3, 
  PieChart as PieChartIcon,
  Sparkles, 
  Utensils, 
  Shirt, 
  Smartphone, 
  Cpu, 
  Monitor, 
  Layers, 
  Trophy, 
  ShoppingBasket,
  PenTool,
  Check
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Order, Product } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';

interface DashboardProps {
  onViewChange?: (view: any) => void;
  defaultCategory?: string;
  onCategoryFilterChange?: (category: string) => void;
}

export default function Dashboard({ onViewChange, defaultCategory = 'All', onCategoryFilterChange }: DashboardProps) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalBanners: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    totalReviews: 0,
    totalUsers: 0,
    totalSellers: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [boardNote, setBoardNote] = useState(() => localStorage.getItem('dashboard_define_note') || 'Welcome to the pbazar admin hub! Set daily target numbers, notice highlights, or custom operational parameters here.');
  const [isNoteEditing, setIsNoteEditing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Listen to orders for revenue, total count, and recent list
    const qOrders = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as Order[];
      
      const revenue = allOrders.reduce((sum, order) => 
        sum + (['delivered', 'shipping', 'packing', 'completed'].includes(order.status) ? order.price : 0), 0
      );
      const pending = allOrders.filter(o => o.status === 'pending').length;

      setStats(prev => ({
        ...prev,
        totalOrders: allOrders.length,
        totalRevenue: revenue,
        pendingOrders: pending
      }));
      setOrders(allOrders);
      setRecentOrders(allOrders.slice(0, 5));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Listen to products list and count
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProductsList(pList);
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

    // Listen to users count
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalUsers: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Listen to sellers count
    const unsubscribeSellers = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalSellers: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sellers'));

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeBanners();
      unsubscribeReviews();
      unsubscribeUsers();
      unsubscribeSellers();
    };
  }, []);

  const totalStock = productsList.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const totalSold = productsList.reduce((sum, p) => sum + (p.sold ?? 0), 0);
  const totalInventoryValue = productsList.reduce((sum, p) => sum + ((p.stock ?? 0) * p.price), 0);

  const pastEarn = orders.reduce((sum, order) => 
    sum + (['delivered', 'completed'].includes(order.status) ? Number(order.price || 0) : 0), 0
  );

  const futureEarn = orders.reduce((sum, order) => 
    sum + (['pending', 'packing', 'shipping'].includes(order.status) ? Number(order.price || 0) : 0), 0
  );

  const statCards = [
    { label: 'PAST EARN (REALIZED)', value: formatCurrency(pastEarn), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50/70 border border-emerald-100', change: 'Delivered or Completed', changeColor: 'text-emerald-500' },
    { label: 'FUTURE EARN (PENDING)', value: formatCurrency(futureEarn), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50/70 border border-amber-100', change: 'Awaiting Fulfillment', changeColor: 'text-amber-500' },
    { label: 'DELIVERY REVENUE', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50/75 border border-indigo-100', change: 'Active & complete', changeColor: 'text-indigo-550' },
    { label: 'LIVE ORDERS', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-brand', bg: 'bg-indigo-50/70 border border-indigo-100', change: `${stats.pendingOrders} pending check`, changeColor: 'text-brand' },
    { label: 'PRODUCTS TOTAL', value: stats.totalProducts.toString(), icon: ShoppingBag, color: 'text-slate-700', bg: 'bg-slate-50 border border-slate-200/60', change: `${totalStock} in stock • ${totalSold} sold`, changeColor: 'text-slate-500' },
    { label: 'SELLERS BASE', value: stats.totalSellers.toString(), icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 border border-purple-100', change: `${stats.totalUsers} customers`, changeColor: 'text-purple-550' },
  ];

  const cancelledOrders = recentOrders.filter(o => o.status === 'cancelled').slice(0, 3);

  // Prepare chart data
  const statusCounts = orders.reduce((acc: any, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ 
    name: name.toUpperCase(), 
    value 
  }));

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#64748b', '#0f172a'];

  // Last 7 days order frequency
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
  const barData = last7Days.map(date => {
    const count = orders.filter(o => isSameDay(new Date(o.created_at), date)).length;
    return {
      date: format(date, 'MMM dd'),
      orders: count
    };
  });

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Dashboard" />

      <main className="p-4 md:p-8 space-y-4 md:space-y-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingDots />
          </div>
        ) : (
          <>
            {/* Logo Section */}
            <div className="mb-6 flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-2 relative group overflow-hidden">
                <img src="https://i.postimg.cc/KvqR53hq/download-(1).png" alt="pbazar" className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-brand/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                  pbazar <span className="text-brand">Admin Area</span>
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                  Official Commerce Hub • DHAKA, BD
                </p>
              </div>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {statCards.map((stat, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("p-2 rounded-xl transition-colors duration-300", stat.bg, "group-hover:bg-slate-100 group-hover:text-slate-800")}>
                        <stat.icon className={cn("w-4.5 h-4.5", stat.color)} />
                      </div>
                      {stat.label === 'SELLERS BASE' && (
                        <button 
                          onClick={() => onViewChange?.('users')}
                          className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                        >
                          VIEW
                        </button>
                      )}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 line-clamp-1">{stat.label}</div>
                    <div className="text-xl font-black text-slate-900 leading-none tracking-tighter truncate">{stat.value}</div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-3 flex items-center gap-1.5 uppercase tracking-wider truncate">
                     {stat.change}
                  </p>
                </div>
              ))}
            </div>

            {/* Dashboard Workspace / Definition Pen Tool Memo Board */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50/60 border border-indigo-100/40 text-indigo-600 rounded-2xl">
                    <PenTool className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Dashboard Definition Pad</h2>
                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">Set workspace guidelines and metrics</p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (isNoteEditing) {
                      localStorage.setItem('dashboard_define_note', boardNote);
                    }
                    setIsNoteEditing(!isNoteEditing);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-sm"
                >
                  {isNoteEditing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Save Definition
                    </>
                  ) : (
                    <>
                      <PenTool className="w-3.5 h-3.5 text-slate-500" />
                      Edit Pad
                    </>
                  )}
                </button>
              </div>

              {isNoteEditing ? (
                <textarea
                  value={boardNote}
                  onChange={(e) => setBoardNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/55 focus:outline-none rounded-2xl p-4 text-xs font-bold leading-relaxed text-slate-700 uppercase"
                  rows={3}
                  placeholder="Define targets, guidelines, or notice content for this dashboard session..."
                />
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono leading-relaxed text-slate-600 uppercase tracking-wide">
                  {boardNote}
                </div>
              )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand" />
                      Order Velocity
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Transaction frequency last 7 days</p>
                  </div>
                </div>
                <div className="relative h-[250px] w-full">
                  {mounted && (
                    <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #f1f5f9', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-brand" />
                      Order Status Mix
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Global status distribution</p>
                  </div>
                </div>
                <div className="relative h-[250px] w-full">
                  {mounted && (
                    <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #f1f5f9', 
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36} 
                          iconType="circle"
                          formatter={(value) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Best Sellers and Inventory Control */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Products Card */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base uppercase tracking-tight flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Top Selling Registry
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Highly requested products by customers</p>
                  </div>
                </div>
                <div className="p-6 flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[350px]">
                  {productsList.length > 0 ? (
                    [...productsList]
                      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
                      .slice(0, 5)
                      .map((p) => {
                        const totalProductRevenue = (p.sold ?? 0) * p.price;
                        return (
                          <div key={p.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                              {p.image ? (
                                <img src={p.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-slate-400 text-lg">P</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">{p.category || 'General'}</span>
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{p.sold ?? 0} Sold</span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 truncate mt-0.5 uppercase">{p.name}</h4>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-slate-900">{formatCurrency(p.price)}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">Rev: {formatCurrency(totalProductRevenue)}</div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      No product sales tracked yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Stock Alerts & Inventory Value Card */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base uppercase tracking-tight flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      Critical Stock Board
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Inventory shortages and depletion warnings</p>
                  </div>
                </div>
                <div className="p-6 flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[350px]">
                  {productsList.length > 0 ? (
                    (() => {
                      const lowStockProducts = productsList.filter(p => (p.stock ?? 0) <= 5);
                      if (lowStockProducts.length === 0) {
                        return (
                          <div className="py-12 text-center text-emerald-600 font-bold text-xs uppercase tracking-wider flex flex-col items-center justify-center h-full">
                            🎉 All products are fully stocked!
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">No warnings to report currently</span>
                          </div>
                        );
                      }
                      return lowStockProducts.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {p.image ? (
                              <img src={p.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-black text-slate-400 text-lg">P</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                                (p.stock ?? 0) === 0 ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                              )}>
                                {(p.stock ?? 0) === 0 ? "OUT OF STOCK" : "LOW STOCK"}
                              </span>
                              <span className="text-xs font-black text-slate-800">{p.stock ?? 0} left</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 truncate mt-0.5 uppercase">{p.name}</h4>
                          </div>
                          <div className="text-right shrink-0 font-bold text-xs text-slate-900">
                            {formatCurrency(p.price)}
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      No products registered.
                    </div>
                  )}
                </div>
              </div>
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
                            <div className="text-sm font-bold text-slate-900">{order.customer_name || 'Generic Customer'}</div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              {order.whatsapp_number || 'No contact'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm font-black text-slate-900 text-right">{formatCurrency(order.price)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                              order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                              order.status === 'completed' ? "bg-slate-900 text-white" :
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
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    Cancellation Alerts
                  </h3>
                  <div className="space-y-4">
                    {cancelledOrders.length > 0 ? cancelledOrders.map(order => (
                      <div key={order.id} className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-col gap-2 group transition-all hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            {order.cancelled_by === 'user' ? 'Customer Cancelled' : 'Admin Cancelled'}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">#{order.id.slice(0, 6)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-red-200 flex items-center justify-center text-red-500 font-black text-xs">
                            !
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 truncate">{order.customer_name || 'Generic'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{order.whatsapp_number}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-400">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <ShoppingCart className="w-5 h-5 opacity-20" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Global Healthy Stream</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:border-brand/40 transition-all" onClick={() => onViewChange?.('users')}>
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                      <Users className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-brand group-hover:translate-x-1 transition-all" />
                  </div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight uppercase">User Directory</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 mb-4">Registered customer base</p>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    View and manage all registered customers who signed in from the frontend application.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
