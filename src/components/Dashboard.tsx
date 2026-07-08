import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where, or } from 'firebase/firestore';
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
import { Storage } from '../lib/storage';
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
  userSession?: any;
}

export default function Dashboard({ onViewChange, defaultCategory = 'All', onCategoryFilterChange, userSession }: DashboardProps) {
  const isSeller = userSession?.role === 'seller';
  const currentSellerId = userSession?.sellerId || '';
  const currentSellerName = userSession?.name || '';

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
  const [isShowingGlobal, setIsShowingGlobal] = useState(false);
  const [boardNote, setBoardNote] = useState(() => Storage.getSmall('dashboard_define_note') || 'Welcome to the pbazar admin hub! Set daily target numbers, notice highlights, or custom operational parameters here.');
  const [isNoteEditing, setIsNoteEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const filteredRecentOrders = recentOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (order.product_name?.toLowerCase() || '').includes(searchLower) ||
      (order.customer_name?.toLowerCase() || '').includes(searchLower) ||
      (order.whatsapp_number || '').includes(searchTerm) ||
      (order.seller?.toLowerCase() || '').includes(searchLower) ||
      (order.seller_id?.toLowerCase() || '').includes(searchLower)
    );
  });

  useEffect(() => {
    // Helper to get stats from cache
    const loadCache = async () => {
      const cachedStats = Storage.getSmall<any>('dashboard_stats_cache');
      if (cachedStats) {
        setStats(cachedStats);
      }

      // Load large data from IndexedDB for instant display/offline fallback
      const cachedOrders = await Storage.getLarge<Order[]>('dashboard_orders_cache');
      if (cachedOrders) {
        setOrders(cachedOrders);
        setRecentOrders(cachedOrders.slice(0, 5));
      }

      const cachedProducts = await Storage.getLarge<Product[]>('dashboard_products_cache');
      if (cachedProducts) {
        setProductsList(cachedProducts);
      }
    };
    
    loadCache();

    // Listen to orders for revenue, total count, and recent list
    // Use a limit to avoid fetching thousands of documents if they exist
    let qOrders;
    if (isSeller && !isShowingGlobal) {
      qOrders = query(
        collection(db, 'orders'), 
        or(
          where('seller_id', '==', currentSellerId),
          where('seller', '==', currentSellerName)
        ),
        limit(200)
      );
    } else {
      qOrders = query(collection(db, 'orders'), limit(300));
    }

    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      let allOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as Order[];
      
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const revenue = allOrders.reduce((sum, order) => 
        sum + (['delivered', 'shipping', 'packing', 'completed'].includes(order.status) ? order.price : 0), 0
      );
      const pending = allOrders.filter(o => o.status === 'pending').length;

      setStats(prev => {
        const newStats = {
          ...prev,
          totalOrders: allOrders.length,
          totalRevenue: revenue,
          pendingOrders: pending
        };
        Storage.setSmall('dashboard_stats_cache', newStats);
        return newStats;
      });
      setOrders(allOrders);
      setRecentOrders(allOrders.slice(0, 5));
      Storage.setLarge('dashboard_orders_cache', allOrders);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // For products, banners, reviews, users, sellers:
    // We only need counts on the dashboard. Let's do one-time fetches with 1 document limit just to get size info if possible?
    // Actually Firestores snapshot.size doesn't care about limit for total count of the query.
    
    const productCol = collection(db, 'products');
    const qProducts = (isSeller && !isShowingGlobal) 
      ? query(productCol, or(where('seller_id', '==', currentSellerId), where('seller', '==', currentSellerName)), limit(300)) 
      : query(productCol, limit(500));

    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProductsList(pList);
      Storage.setLarge('dashboard_products_cache', pList);
      setStats(prev => {
        const updated = { ...prev, totalProducts: snapshot.size };
        Storage.setSmall('dashboard_stats_cache', updated);
        return updated;
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    // These don't need real-time updates for dashboard totals. One-time is enough to save quota.
    const fetchCounts = async () => {
      if (isSeller && !isShowingGlobal) return; // Only fetch global counts if requested or admin
      try {
        const [bannersSnap, reviewsSnap, usersSnap, sellersSnap] = await Promise.all([
          getDocs(collection(db, 'banners')),
          getDocs(collection(db, 'reviews')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'sellers'))
        ]);
        
        setStats(prev => {
          const updated = {
            ...prev,
            totalBanners: bannersSnap.size,
            totalReviews: reviewsSnap.size,
            totalUsers: usersSnap.size,
            totalSellers: sellersSnap.size
          };
          Storage.setSmall('dashboard_stats_cache', updated);
          return updated;
        });
      } catch (err) {
        console.warn("Failed one-time fetch of counts, might be quota issue:", err);
      }
    };
    fetchCounts();

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [isShowingGlobal, isSeller, currentSellerId]);

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
    { label: 'TOTAL SALES COUNT', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-brand', bg: 'bg-brand-light border border-brand/20', change: 'Total Orders Tracked', changeColor: 'text-brand' },
    { label: 'PAST EARN (REALIZED)', value: formatCurrency(pastEarn), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50/70 border border-emerald-100', change: 'Delivered or Completed', changeColor: 'text-emerald-500' },
    { label: 'FUTURE EARN (PENDING)', value: formatCurrency(futureEarn), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50/70 border border-amber-100', change: 'Awaiting Fulfillment', changeColor: 'text-amber-500' },
    { label: 'DELIVERY REVENUE', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50/75 border border-indigo-100', change: 'Active & complete', changeColor: 'text-indigo-550' },
    { label: 'PRODUCTS TOTAL', value: stats.totalProducts.toString(), icon: ShoppingBag, color: 'text-slate-700', bg: 'bg-slate-50 border border-slate-200/60', change: `${totalStock} in stock • ${totalSold} sold`, changeColor: 'text-slate-500' },
    !isSeller && { label: 'SELLERS BASE', value: stats.totalSellers.toString(), icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 border border-purple-100', change: `${stats.totalUsers} customers`, changeColor: 'text-purple-550' },
  ].filter(Boolean) as any[];

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
    <div className="flex-1 overflow-x-hidden pb-24 md:pb-0">
      <Header title="Dashboard" onSearch={setSearchTerm} />

      <main className="p-4 md:p-8 space-y-4 md:space-y-8 w-full max-w-[1600px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingDots />
          </div>
        ) : (
          <>
            {/* Logo Section */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
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

              {isSeller && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setIsShowingGlobal(false)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      !isShowingGlobal ? "bg-white text-brand shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    My Shop
                  </button>
                  <button
                    onClick={() => setIsShowingGlobal(true)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      isShowingGlobal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Global Market
                  </button>
                </div>
              )}
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

            {/* Dashboard Workspace / Definition Pen Tool Memo Board - Hidden on mobile */}
            <div className="hidden md:block bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
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
                      Storage.setSmall('dashboard_define_note', boardNote);
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

              {/* Stock Alerts & Inventory Value Card - Hidden on mobile */}
              <div className="hidden md:flex bg-white rounded-2xl border border-slate-200 overflow-hidden flex-col shadow-sm">
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
                  <div className="flex items-center gap-2 text-[10px] font-black text-white bg-brand px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-sm shadow-brand/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live Syncing
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Order ID</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client & Item</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Seller</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecentOrders.map((order, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-xs font-mono text-slate-400 hidden sm:table-cell">#{order.id.slice(0, 8)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">{order.customer_name || 'Generic Customer'}</div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              {order.whatsapp_number || 'No contact'}
                            </div>
                            <div className="text-[10px] text-brand font-black mt-1.5 uppercase tracking-widest">
                              {order.product_name || 'Product Info'}
                            </div>
                          </td>
                          <td className="px-5 py-4 hidden md:table-cell">
                            <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{order.seller || 'N/A'}</div>
                            {order.seller_id && <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest">ID: {order.seller_id}</div>}
                          </td>
                          <td className="px-5 py-4 text-sm font-black text-slate-900 text-right whitespace-nowrap">{formatCurrency(order.price)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0 inline-block",
                              order.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              order.status === 'completed' ? "bg-brand text-white border-brand" :
                              order.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              order.status === 'cancelled' ? "bg-red-50 text-red-600 border-red-100" :
                              "bg-indigo-50 text-indigo-600 border-indigo-100"
                            )}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredRecentOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm italic font-bold uppercase tracking-widest">
                            No matching orders detected in data stream.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar Modules */}
              <div className="space-y-6">
                {!isSeller && (
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
                )}

                {/* Cancellation Alerts - Hidden on mobile */}
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
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

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
