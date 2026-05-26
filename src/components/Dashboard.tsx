import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import { ShoppingBag, ShoppingCart, Image as ImageIcon, TrendingUp, ArrowUpRight, Users, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalBanners: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('dashboard_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchStats(); // Just refetch all stats when orders changes
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [productsRes, ordersRes, bannersRes] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('banners').select('*', { count: 'exact', head: true })
      ]);

      const orders = ordersRes.data || [];
      const revenue = orders.reduce((sum, order) => sum + ((order.status === 'confirmed' || order.status === 'completed') ? order.price : 0), 0);
      const pending = orders.filter(o => o.status === 'pending').length;

      setStats({
        totalProducts: productsRes.count || 0,
        totalOrders: orders.length,
        totalBanners: bannersRes.count || 0,
        totalRevenue: revenue,
        pendingOrders: pending
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'TOTAL SALES', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', change: '↑ 12% vs last month', changeColor: 'text-emerald-500' },
    { label: 'LIVE ORDERS', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-brand', bg: 'bg-indigo-50', change: `${stats.pendingOrders} pending confirm`, changeColor: 'text-brand' },
    { label: 'TOTAL PRODUCTS', value: stats.totalProducts.toString(), icon: ShoppingBag, color: 'text-brand-dark', bg: 'bg-slate-100', change: '8 low on stock', changeColor: 'text-amber-500' },
    { label: 'AVG. VALUE', value: formatCurrency(stats.totalRevenue > 0 ? stats.totalRevenue / (stats.totalOrders || 1) : 0), icon: Users, color: 'text-slate-500', bg: 'bg-slate-50', change: 'Flat since Jan', changeColor: 'text-slate-400' },
  ];

  // Dummy chart data related to order dates could be built if we have real data
  const chartData = [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 5000 },
    { name: 'Thu', sales: 2780 },
    { name: 'Fri', sales: 1890 },
    { name: 'Sat', sales: 2390 },
    { name: 'Sun', sales: 3490 },
  ];

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Dashboard" />

      <main className="p-8 space-y-8 max-w-[1240px]">
        {/* Stat Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-xl transition-colors duration-300", stat.bg, "group-hover:bg-slate-900 group-hover:text-white")}>
                  <stat.icon className={cn("w-5 h-5", stat.color, "group-hover:text-white")} />
                </div>
                <div className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md", stat.changeColor, "bg-slate-50")}>
                  {stat.change.split(' ')[0]}
                </div>
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</div>
              <div className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">Real-time Orders Feed</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global stream activity</p>
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
                        <a 
                          href={`https://wa.me/${order.whatsapp?.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-brand hover:underline font-bold"
                        >
                          {order.whatsapp}
                        </a>
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-slate-900 text-right">{formatCurrency(order.price)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          order.status === 'confirmed' 
                            ? "bg-emerald-100 text-emerald-700" 
                            : order.status === 'completed'
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-700"
                        )}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-sm italic">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar Modules */}
          <div className="space-y-6">
            {/* Banner Module */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-black text-slate-900 mb-4">Banner Sync</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="aspect-video bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  Slot 1
                </div>
                <div className="aspect-video bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 opacity-20" />
                  <span className="text-[10px] font-bold text-brand z-10">Active</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 flex items-center justify-between">
                   <div className="text-[10px] font-bold text-slate-400">PROMO_BANNER_01.JPG</div>
                   <button className="text-red-500 text-xs px-1 font-black">×</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
