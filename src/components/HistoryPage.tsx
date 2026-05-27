import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Order, ProductHistoryEntry } from '../types';
import Header from '../components/Header';
import { Loader2, Phone, MapPin, Package, Clock, History, Calendar, Trash2, Layers, ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [productHistory, setProductHistory] = useState<ProductHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchProductHistory();

    const ordersChannel = supabase
      .channel('history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new.status === 'completed') {
              setOrders((prev) => [payload.new as Order, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'completed') {
               // Check if it already exists, if not, add it
               setOrders((prev) => {
                 const exists = prev.find(o => o.id === payload.new.id);
                 if (exists) {
                   return prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new as Order } : o);
                 } else {
                   return [payload.new as Order, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                 }
               });
            } else {
              setOrders((prev) => prev.filter((order) => order.id !== payload.new.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const productsHistoryChannel = supabase
      .channel('products_history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products_history' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProductHistory((prev) => [payload.new as ProductHistoryEntry, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setProductHistory((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsHistoryChannel);
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      if (activeTab === 'orders') setLoading(false);
    }
  };

  const fetchProductHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('products_history')
        .select('*')
        .order('changed_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch products_history logs. Running fine without it.', error);
        return;
      }
      setProductHistory(data || []);
    } catch (err) {
      console.warn('Error fetching product history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this order from history?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) console.error(error);
      
      setOrders(orders.filter(o => o.id !== id));
    } catch (err) {
      console.error('Error deleting history order:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteHistoryLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log entry?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('products_history').delete().eq('id', id);
      if (error) throw error;
      setProductHistory(productHistory.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting history log:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.whatsapp.includes(searchQuery) ||
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = dateFilter 
      ? isSameDay(new Date(order.created_at), new Date(dateFilter))
      : true;

    return matchesSearch && matchesDate;
  });

  const filteredProductLogs = productHistory.filter(log => {
    const matchesSearch = 
      log.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.changed_data.type && log.changed_data.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.changed_data.seller && log.changed_data.seller.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDate = dateFilter 
      ? isSameDay(new Date(log.changed_at), new Date(dateFilter))
      : true;

    return matchesSearch && matchesDate;
  });

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Auditing Logs & History" />

      <main className="p-8 max-w-7xl mx-auto">
        {/* Toggle Nav */}
        <div className="flex border-b border-slate-100 mb-8 max-w-md">
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest border-b-2 text-center transition-all flex items-center justify-center gap-2",
              activeTab === 'orders' ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            Order History
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest border-b-2 text-center transition-all flex items-center justify-center gap-2",
              activeTab === 'products' ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <Layers className="w-4 h-4" />
            Product Audits
          </button>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-[10px] text-red-500 font-bold hover:underline ml-2">
                  CLEAR
                </button>
              )}
            </div>
            
            <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
              <input
                type="text"
                placeholder={activeTab === 'orders' ? "Search phone or name..." : "Search action or product..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest"
              />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hidden sm:flex">
            <History className="w-4 h-4 text-brand" />
            {activeTab === 'orders' ? filteredOrders.length : filteredProductLogs.length} Records Found
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={order.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-sm transition-all duration-300 opacity-75 hover:opacity-100 grayscale hover:grayscale-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex-1 min-w-[300px]">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-lg">
                          {order.customer_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{order.customer_name}</h3>
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                              Completed
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <a 
                              href={`https://wa.me/${order.whatsapp?.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-brand hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {order.whatsapp}
                            </a>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" />
                              {order.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product</p>
                            <p className="font-bold text-slate-800 truncate">{order.product_name}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center gap-4 group">
                           <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand shrink-0">
                            <span className="font-black text-sm">৳</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Price</p>
                            <p className="font-black text-slate-900 leading-none">{formatCurrency(order.price)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-4 min-w-[200px]">
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end text-slate-400 mb-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {format(new Date(order.created_at), 'PPP p')}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(order.id)}
                        disabled={deletingId === order.id}
                        className="mt-auto px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        {deletingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete Record
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredOrders.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No order history found</p>
                <p className="text-sm">Modify search or date filter to see more items.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredProductLogs.map((log) => {
                const isCreated = log.action === 'CREATED';
                const isUpdated = log.action === 'UPDATED';
                const isDeleted = log.action === 'DELETED';
                
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    key={log.id}
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-sm transition-all duration-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-6">
                      <div className="flex-1 min-w-[300px]">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-center min-w-[100px]",
                            isCreated && "bg-emerald-50 text-emerald-600",
                            isUpdated && "bg-indigo-50 text-indigo-600",
                            isDeleted && "bg-red-50 text-red-600"
                          )}>
                            {log.action}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{log.product_name}</h4>
                            <p className="text-slate-400 text-[10px] uppercase font-bold mt-1">PRODUCT ID: {log.product_id}</p>
                          </div>
                        </div>

                        {/* Changed Data View */}
                        <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 max-w-2xl text-xs space-y-2">
                          {isCreated && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600 font-medium">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Price</span>
                                {formatCurrency(log.changed_data.price || 0)}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Type</span>
                                {log.changed_data.type || 'N/A'}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Seller</span>
                                {log.changed_data.seller || 'N/A'}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Discount</span>
                                {log.changed_data.discount || 0}%
                              </div>
                            </div>
                          )}

                          {isUpdated && (
                            <div className="space-y-1.5">
                              {log.changed_data.old_price !== log.changed_data.new_price && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase w-20">Price:</span>
                                  <span className="font-bold text-slate-500 line-through">{formatCurrency(log.changed_data.old_price || 0)}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-bold text-indigo-600">{formatCurrency(log.changed_data.new_price || 0)}</span>
                                </div>
                              )}
                              {log.changed_data.old_type !== log.changed_data.new_type && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase w-20">Type:</span>
                                  <span className="font-semibold text-slate-500">{log.changed_data.old_type || 'N/A'}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-bold text-indigo-600">{log.changed_data.new_type || 'N/A'}</span>
                                </div>
                              )}
                              {log.changed_data.old_seller !== log.changed_data.new_seller && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase w-20">Seller:</span>
                                  <span className="font-semibold text-slate-500">{log.changed_data.old_seller || 'N/A'}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-bold text-indigo-600">{log.changed_data.new_seller || 'N/A'}</span>
                                </div>
                              )}
                              {log.changed_data.old_discount !== log.changed_data.new_discount && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase w-20">Discount:</span>
                                  <span className="font-semibold text-slate-500">{log.changed_data.old_discount || 0}%</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-bold text-indigo-600">{log.changed_data.new_discount || 0}%</span>
                                </div>
                              )}
                            </div>
                          )}

                          {isDeleted && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600 font-medium">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Final Price</span>
                                {formatCurrency(log.changed_data.price || 0)}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Type</span>
                                {log.changed_data.type || 'N/A'}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Seller</span>
                                {log.changed_data.seller || 'N/A'}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Discount</span>
                                {log.changed_data.discount || 0}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 min-w-[200px]">
                        <div className="flex items-center gap-2 justify-end text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {format(new Date(log.changed_at), 'PPP p')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteHistoryLog(log.id)}
                          disabled={deletingId === log.id}
                          className="px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 text-[10px] font-bold uppercase rounded-lg tracking-widest aspect-auto flex items-center gap-1 cursor-pointer"
                        >
                          {deletingId === log.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>}
                          Delete Log
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredProductLogs.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-20 text-brand" />
                <p className="font-medium">No product history logs found</p>
                <p className="text-sm">Make sure you have run the custom table from supabase_schema.sql in your Supabase SQL editor!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
