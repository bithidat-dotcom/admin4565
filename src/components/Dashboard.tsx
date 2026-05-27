import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import Header from '../components/Header';
import { ShoppingBag, ShoppingCart, TrendingUp, Users, Loader2, Star, Trash2, ArrowRight, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Order } from '../types';
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
}

export default function Dashboard({ onViewChange }: DashboardProps) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalBanners: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    totalReviews: 0,
    totalUsers: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

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

    // Listen to users count
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalUsers: snapshot.size
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeBanners();
      unsubscribeReviews();
      unsubscribeUsers();
    };
  }, []);

  const statCards = [
    { label: 'DELIVERY REVENUE', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', change: 'Live from Firestore', changeColor: 'text-emerald-500' },
    { label: 'LIVE ORDERS', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-brand', bg: 'bg-indigo-50', change: `${stats.pendingOrders} pending confirmation`, changeColor: 'text-brand' },
    { label: 'STORE PRODUCTS', value: stats.totalProducts.toString(), icon: ShoppingBag, color: 'text-brand-dark', bg: 'bg-slate-100', change: 'Database Inventory', changeColor: 'text-blue-500' },
    { label: 'MEMBERS BASE', value: stats.totalUsers.toString(), icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50', change: 'Registered users', changeColor: 'text-indigo-500' },
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
                    {stat.label === 'MEMBERS BASE' && (
                      <button 
                        onClick={() => onViewChange?.('users')}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                      >
                        VIEW ALL
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</div>
                  <div className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{stat.value}</div>
                  <p className="text-[10px] font-bold text-slate-400 mt-4 flex items-center gap-1.5 uppercase tracking-wider">
                     {stat.change}
                  </p>
                </div>
              ))}
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
