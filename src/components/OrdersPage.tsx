import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Safe Non-Blocking Confirmation States
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Order[];
      
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    setStatusUpdatingId(id);
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.whatsapp_number.includes(searchQuery) ||
      order.product_details.toLowerCase().includes(searchLower) ||
      order.location.toLowerCase().includes(searchLower);

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

  const handleDeleteOrder = (id: string) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const id = orderToDelete;
    setOrderToDelete(null);
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Orders" />

      <main className="p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer" onClick={selectAll}>
              <input 
                type="checkbox" 
                checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                onChange={selectAll}
                className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Select All
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
          
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hidden lg:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Shipments Tracked
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
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-lg hidden sm:flex">
                          {order.customer_name.charAt(0)}
                        </div>
                        <div className="sm:hidden">
                           <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{order.customer_name}</h3>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                              getStatusColor(order.status)
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <a 
                              href={`https://wa.me/${order.whatsapp_number?.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-brand hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {order.whatsapp_number}
                            </a>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" />
                              {order.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand shrink-0 group-hover:scale-110 transition-transform">
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Details</p>
                            <p className="font-bold text-slate-800 text-sm">{order.product_details}</p>
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

                    <div className="flex flex-col items-end gap-4 min-w-[240px] w-full md:w-auto">
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end text-slate-400 mb-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {format(new Date(order.created_at), 'PPP p')}
                          </span>
                        </div>
                      </div>

                      <div className="w-full flex-col flex gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Update Status</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => updateStatus(order.id, 'processing')}
                            disabled={statusUpdatingId === order.id}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all transition-colors border",
                              order.status === 'processing' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                            )}
                          >
                            Processing
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, 'shipped')}
                            disabled={statusUpdatingId === order.id}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all transition-colors border",
                              order.status === 'shipped' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            )}
                          >
                            Shipped
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, 'delivered')}
                            disabled={statusUpdatingId === order.id}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all transition-colors border",
                              order.status === 'delivered' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            )}
                          >
                            Delivered
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            disabled={statusUpdatingId === order.id}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all transition-colors border",
                              order.status === 'cancelled' ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                            )}
                          >
                            Cancelled
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                          className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          {deletingId === order.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3.5 h-3.5" />}
                          Delete Permanent
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredOrders.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No active shipments found</p>
                <p className="text-sm">Real-time orders will appear here automatically.</p>
              </div>
            )}
          </div>
        )}
      </main>

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
              Yes, Delete
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
    </div>
  );
}
