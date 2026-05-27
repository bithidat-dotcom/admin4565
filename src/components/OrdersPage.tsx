import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';
import Header from '../components/Header';
import Modal from './Modal';
import { Loader2, Phone, MapPin, Package, Clock, CheckCircle, Search, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Safe Non-Blocking Confirmation States
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    // REAL-TIME SUBSCRIPTION
    const channel = supabase
      .channel('orders_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            if (newOrder.status === 'pending' || newOrder.status === 'confirmed') {
              setOrders((prev) => [newOrder, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            if (updatedOrder.status === 'pending' || updatedOrder.status === 'confirmed') {
              setOrders((prev) => {
                const exists = prev.some((o) => o.id === updatedOrder.id);
                if (exists) {
                  return prev.map((order) => 
                    order.id === updatedOrder.id ? updatedOrder : order
                  );
                } else {
                  return [updatedOrder, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
              });
            } else {
              // Status changed to cancelled, completed or something else, filter it out from active order view
              setOrders((prev) => prev.filter((order) => order.id !== updatedOrder.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, currentStatus: 'pending' | 'confirmed') => {
    setStatusUpdatingId(id);
    const newStatus = currentStatus === 'pending' ? 'confirmed' : 'pending';
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) console.error(error);
      
      // Optimitic local update
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setStatusUpdatingId(null);
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

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedOrders(newSelection);
  };

  const selectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleCancelOrder = (id: string) => {
    setOrderToCancel(id);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    const id = orderToCancel;
    setOrderToCancel(null);
    setDeletingId(id);
    try {
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id);
      if (error) console.error(error);
      
      setOrders(orders.filter(o => o.id !== id));
      const newSelection = new Set(selectedOrders);
      newSelection.delete(id);
      setSelectedOrders(newSelection);
    } catch (err) {
      console.error('Error cancelling order:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteOrder = (id: string) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const id = orderToDelete;
    setOrderToDelete(null);
    setDeletingId(id);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      
      setOrders(orders.filter(o => o.id !== id));
      const newSelection = new Set(selectedOrders);
      newSelection.delete(id);
      setSelectedOrders(newSelection);
    } catch (err) {
      console.error('Error deleting order:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCompleteOrder = async (id: string) => {
    setProcessingId(id);
    console.log('Completing order:', id);
    try {
      const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', id);
      if (error) {
        console.error('Error in handleCompleteOrder:', error);
        throw error;
      }
      
      console.log('Order set to completed:', id);
      setOrders(orders.filter(o => o.id !== id));
      const newSelection = new Set(selectedOrders);
      newSelection.delete(id);
      setSelectedOrders(newSelection);
    } catch (err) {
      console.error('Error completing order:', err);
    } finally {
      setProcessingId(null);
      setConfirmCompleteId(null);
    }
  };

  const handleBulkComplete = async () => {
    if (selectedOrders.size === 0) return;
    if (!window.confirm(`Are you sure you want to move ${selectedOrders.size} selected orders to history?`)) return;
    
    setBulkProcessing(true);
    try {
      const idsToDelete = Array.from(selectedOrders);
      await supabase.from('orders').update({ status: 'completed' }).in('id', idsToDelete);
      
      setOrders(orders.filter(o => !selectedOrders.has(o.id)));
      setSelectedOrders(new Set());
    } catch (err) {
      console.error('Error bulk completing orders:', err);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Orders" />

      <main className="p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer block" onClick={selectAll}>
                <input 
                  type="checkbox" 
                  checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Select All
              </div>
              
              {selectedOrders.size > 0 && (
                <button 
                  onClick={handleBulkComplete}
                  disabled={bulkProcessing}
                  className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Complete {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest w-full"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-[10px] text-red-500 font-bold hover:underline ml-2">
                  CLEAR
                </button>
              )}
            </div>
            
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest w-full"
              />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync: Connected
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={order.id}
                  className={cn(
                    "bg-white rounded-xl border p-6 transition-all duration-300 relative",
                    selectedOrders.has(order.id) ? "border-brand shadow-sm shadow-brand/10 ring-1 ring-brand/10" : "border-slate-200 hover:shadow-sm"
                  )}
                >
                  <div className="absolute top-6 left-6 z-10 hidden sm:block">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleSelection(order.id)}
                    />
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-6 sm:pl-10">
                    <div className="flex-1 min-w-[300px]">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-lg sm:hidden">
                           <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                          />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-lg hidden sm:flex">
                          {order.customer_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{order.customer_name}</h3>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                              order.status === 'pending' 
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              {order.status}
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
                          <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand shrink-0 group-hover:scale-110 transition-transform">
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product</p>
                            <p className="font-bold text-slate-800 truncate">{order.product_name}</p>
                          </div>
                        </div>
                        <div className="bg-brand/5 rounded-xl p-4 border border-brand/10 flex items-center gap-4 group">
                           <div className="w-10 h-10 bg-white rounded-lg border border-brand/20 flex items-center justify-center text-brand shrink-0 group-hover:scale-110 transition-transform">
                            <span className="font-black text-sm">৳</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Total Price</p>
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

                      <div className="w-full flex-col flex gap-2">
                        {confirmCompleteId === order.id ? (
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Move to History?</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCompleteOrder(order.id)}
                                disabled={processingId === order.id}
                                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-md font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all flex items-center justify-center disabled:opacity-50"
                              >
                                {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin"/> : "Yes"}
                              </button>
                              <button
                                onClick={() => setConfirmCompleteId(null)}
                                disabled={processingId === order.id}
                                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-md font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 transition-all"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {order.status === 'pending' ? (
                              <div className="flex flex-col gap-2 w-full">
                                <button
                                  onClick={() => updateStatus(order.id, order.status)}
                                  disabled={statusUpdatingId === order.id}
                                  className="w-full px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 bg-brand text-white hover:bg-brand-dark shadow-lg shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                                >
                                  {statusUpdatingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />}
                                  Confirm Order
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={deletingId === order.id}
                                    className="px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    disabled={deletingId === order.id}
                                    className="px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 w-full">
                                <button
                                  onClick={() => setConfirmCompleteId(order.id)}
                                  className="w-full px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100 cursor-pointer"
                                >
                                  Complete Order & Save
                                </button>
                                <div className="grid grid-cols-3 gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(order.id, order.status)}
                                    disabled={statusUpdatingId === order.id}
                                    className="px-2 py-2 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer text-center"
                                  >
                                    {statusUpdatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin shrink-0"/> : null}
                                    Pending
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={deletingId === order.id}
                                    className="px-2 py-2 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer text-center"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    disabled={deletingId === order.id}
                                    className="px-2 py-2 rounded-lg font-bold text-red-500 transition-all bg-red-50 hover:bg-red-100 flex items-center justify-center disabled:opacity-50 cursor-pointer"
                                    title="Delete Order"
                                  >
                                    {deletingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredOrders.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No orders found</p>
                <p className="text-sm">New orders will appear here automatically.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Modals to avoid window.confirm failures */}
      <Modal
        isOpen={orderToDelete !== null}
        onClose={() => setOrderToDelete(null)}
        title="Delete Order Permanently?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you absolutely sure you want to permanently delete this order? This action cannot be undone.
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmDeleteOrder}
              className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-100 cursor-pointer"
            >
              Yes, Delete Permanently
            </button>
            <button
              onClick={() => setOrderToDelete(null)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={orderToCancel !== null}
        onClose={() => setOrderToCancel(null)}
        title="Cancel Order?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you sure you want to change the status of this order as cancelled?
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmCancelOrder}
              className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-100 cursor-pointer"
            >
              Yes, Cancel Order
            </button>
            <button
              onClick={() => setOrderToCancel(null)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              No, Keep Active
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
