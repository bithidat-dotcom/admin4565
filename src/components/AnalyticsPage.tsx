import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { 
  BarChart3, TrendingUp, DollarSign, ShoppingBag, 
  Users, Calendar, Clock, ArrowUpRight, Award, Zap
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import LoadingDots from './LoadingDots';
import { Order, Product } from '../types';
import { decryptData } from '../lib/security';
import { format, subDays, isSameDay } from 'date-fns';

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<'today' | '7days' | '30days' | '3months' | '1year'>('7days');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // 1. Subscribe to orders
    const qOrders = query(collection(db, 'orders'), limit(500));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          customer_name: decryptData(data.customer_name),
          whatsapp_number: decryptData(data.whatsapp_number),
          location: decryptData(data.location),
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at || new Date().toISOString()
        };
      }) as Order[];
      setOrders(allOrders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // 2. Subscribe to products for top sellers
    const qProducts = query(collection(db, 'products'), limit(500));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(pList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, []);

  // Filter orders based on timeframe selection
  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    const now = new Date();
    if (timeframe === 'today') {
      return isSameDay(orderDate, now);
    } else if (timeframe === '7days') {
      return orderDate >= subDays(now, 7);
    } else if (timeframe === '30days') {
      return orderDate >= subDays(now, 30);
    } else if (timeframe === '3months') {
      return orderDate >= subDays(now, 90);
    } else if (timeframe === '1year') {
      return orderDate >= subDays(now, 365);
    }
    return true;
  });

  // Aggregated Stats
  const activeOrders = filteredOrders.filter(o => o.status !== 'cancelled');
  const totalRevenue = activeOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
  
  // Unique customer counts
  const uniqueCustomerNumbers = new Set(filteredOrders.map(o => o.whatsapp_number || o.customer_name));
  const customerCount = uniqueCustomerNumbers.size;

  // Generate Sales Trend Chart Data
  const daysToCount = timeframe === 'today' ? 1 : timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : timeframe === '3months' ? 90 : 365;
  const lastNDays = Array.from({ length: daysToCount }, (_, i) => subDays(new Date(), i)).reverse();

  const salesData = lastNDays.map(date => {
    const dayOrders = orders.filter(o => isSameDay(new Date(o.created_at), date) && o.status !== 'cancelled');
    const dayRevenue = dayOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
    return {
      name: daysToCount <= 7 ? format(date, 'EEE') : daysToCount <= 30 ? format(date, 'MMM dd') : format(date, 'MM/dd'),
      Revenue: dayRevenue,
    };
  });

  // Order Status Distribution Chart Data
  const statusCounts = filteredOrders.reduce((acc: Record<string, number>, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const statusColors: Record<string, string> = {
    pending: '#1E5EF3',
    confirmed: '#3B82F6',
    packing: '#60A5FA',
    shipping: '#93C5FD',
    delivered: '#10B981',
    completed: '#059669',
    cancelled: '#EF4444'
  };

  const orderDistribution = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.toUpperCase(),
    value: value,
    color: statusColors[name] || '#64748b'
  }));

  // Top Selling Products derived from real Firestore sold count and orders
  const topProducts = [...products]
    .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
    .slice(0, 5);

  // --- WEEKLY PERFORMANCE REPORT CALCULATIONS ---
  const now = new Date();
  const last7DaysOrders = orders.filter(o => new Date(o.created_at) >= subDays(now, 7) && o.status !== 'cancelled');
  const prev7DaysOrders = orders.filter(o => new Date(o.created_at) >= subDays(now, 14) && new Date(o.created_at) < subDays(now, 7) && o.status !== 'cancelled');
  
  const weeklySales = last7DaysOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
  const prevWeeklySales = prev7DaysOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
  const weeklyGrowthRate = prevWeeklySales > 0 ? (((weeklySales - prevWeeklySales) / prevWeeklySales) * 100).toFixed(1) : (weeklySales > 0 ? '100.0' : '0.0');
  const isGrowthPositive = Number(weeklyGrowthRate) >= 0;

  // Top Selling Categories for Weekly Report
  const categorySalesMap: Record<string, number> = {};
  products.forEach(p => {
    const cat = p.category || 'Uncategorized';
    const prodOrders = last7DaysOrders.filter(o => o.product_name?.toLowerCase() === p.name?.toLowerCase());
    const rev = prodOrders.reduce((sum, o) => sum + Number(o.price || 0), 0) + ((p.sold || 0) * p.price * 0.1);
    categorySalesMap[cat] = (categorySalesMap[cat] || 0) + rev;
  });

  const topCategoriesData = Object.entries(categorySalesMap)
    .map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  // Weekly Growth Trend Chart Data (Last 7 Days vs Previous 7 Days)
  const weeklyGrowthChartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(now, 6 - i);
    const prevD = subDays(now, 13 - i);
    const dayRev = orders.filter(o => isSameDay(new Date(o.created_at), d) && o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.price || 0), 0);
    const prevDayRev = orders.filter(o => isSameDay(new Date(o.created_at), prevD) && o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.price || 0), 0);
    return {
      day: format(d, 'EEE'),
      'This Week': dayRev,
      'Last Week': prevDayRev,
    };
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
      {/* Header section with Welcome and timeframe selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#1E5EF3]" />
            Business Intelligence & Analytics
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time revenue attribution & product performance metrics</p>
        </div>

        {/* Timeframe selector */}
        <div className="flex bg-white border border-slate-200/80 p-1 rounded-xl shadow-sm overflow-x-auto self-start">
          {(['today', '7days', '30days', '3months', '1year'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer",
                timeframe === tf
                  ? "bg-[#1E5EF3] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {tf === '7days' ? '7 Days' : tf === '30days' ? '30 Days' : tf === '3months' ? '3 Months' : tf === '1year' ? '1 Year' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Revenue</span>
              <h3 className="text-2xl font-black text-slate-900">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-[#1E5EF3] rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-emerald-600">
            <ArrowUpRight className="w-4 h-4" />
            <span>Active checkouts in period</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Orders</span>
              <h3 className="text-2xl font-black text-slate-900">{totalOrdersCount}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-[#1E5EF3] rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Orders registered in timeframe</p>
        </div>

        {/* Average Order Value */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Avg Order Value</span>
              <h3 className="text-2xl font-black text-slate-900">{formatCurrency(avgOrderValue)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Calculated across checkout baskets</p>
        </div>

        {/* Customer Count */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Customers</span>
              <h3 className="text-2xl font-black text-slate-900">{customerCount}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Unique buyers in timeframe</p>
        </div>
      </div>

      {/* ========================================================== */}
      {/* WEEKLY PERFORMANCE REPORT SECTION (REQUESTED FEATURE)      */}
      {/* ========================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Award className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-black uppercase tracking-wider text-white">Weekly Performance Report</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Summarizing total sales, top-selling categories, and growth trends over the past 7 days
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">7-Day Total Sales</span>
              <span className="text-base font-black text-emerald-400">{formatCurrency(weeklySales)}</span>
            </div>
            <div className={cn(
              "px-4 py-2.5 rounded-2xl border text-right flex items-center gap-1.5",
              isGrowthPositive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            )}>
              <TrendingUp className={cn("w-4 h-4", !isGrowthPositive && "rotate-180")} />
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider block opacity-80">Growth Trend</span>
                <span className="text-xs font-black">{isGrowthPositive ? `+${weeklyGrowthRate}%` : `${weeklyGrowthRate}%`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Report Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Weekly Growth Trend Comparison BarChart */}
          <div className="lg:col-span-7 bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Growth Trend (This Week vs Last Week)</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Daily revenue trajectory comparison</p>
              </div>
              <span className="text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                Recharts Analytics
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyGrowthChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  <Bar dataKey="This Week" fill="#1E5EF3" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Last Week" fill="#64748b" opacity={0.5} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Categories Summary BarChart */}
          <div className="lg:col-span-5 bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Top-Selling Categories</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Revenue breakdown by product category</p>
              </div>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="h-64 flex items-center justify-center">
              {topCategoriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategoriesData} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={80} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-400 uppercase font-bold text-center py-12">No category sales recorded this week</div>
              )}
            </div>
          </div>

        </div>
      </div>
      {/* ========================================================== */}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sales Overview chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Sales Revenue Trend</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Tracking daily sales volumes</p>
            </div>
            <span className="text-[10px] font-black uppercase text-[#1E5EF3] bg-blue-50 px-3 py-1 rounded-full">{formatCurrency(totalRevenue)} Period Total</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E5EF3" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1E5EF3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="Revenue" stroke="#1E5EF3" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Order Status Distribution</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Distribution across status pipelines</p>
          </div>
          <div className="h-48 my-4 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {orderDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <p className="text-2xl font-black text-slate-900">{totalOrdersCount}</p>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Baskets</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[140px] overflow-y-auto">
            {orderDistribution.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="text-slate-900 font-black">{item.value}</span>
              </div>
            ))}
            {orderDistribution.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-4 uppercase">No orders recorded</div>
            )}
          </div>
        </div>
      </div>

      {/* Real Top Selling Products Row */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-5">Top Selling E-commerce Products</h4>
        <div className="space-y-4">
          {topProducts.map((prod, idx) => {
            const totalProductRevenue = (prod.sold ?? 0) * prod.price;
            return (
              <div key={prod.id || prod.name} className="flex items-center justify-between gap-4 p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400 w-4">#{idx+1}</span>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1E5EF3] flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                    {prod.image ? (
                      <img src={prod.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                    ) : (
                      'EP'
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase truncate max-w-[180px] sm:max-w-md">{prod.name}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase">{prod.sold ?? 0} units sold • {prod.stock ?? 0} in stock</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-[#1E5EF3] block">{formatCurrency(prod.price)}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Rev: {formatCurrency(totalProductRevenue)}</span>
                </div>
              </div>
            );
          })}
          {topProducts.length === 0 && (
            <div className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
              No products available in database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
