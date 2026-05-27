import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, where, getDocs, limit } from 'firebase/firestore';
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

  const syncUserStats = async (whatsappNumber: string) => {
    if (!whatsappNumber) return;
    try {
      // 1. Fetch user by whatsapp_number
      const usersQuery = query(
        collection(db, 'users'), 
        where('whatsapp_number', '==', whatsappNumber), 
        limit(1)
      );
      const userSnap = await getDocs(usersQuery);
      if (userSnap.empty) {
        console.log("No registered customer profile found for whatsapp number:", whatsappNumber);
        return;
      }
      const userDoc = userSnap.docs[0];
      const userId = userDoc.id;

      // 2. Fetch all orders for this WhatsApp number
      const ordersQuery = query(
        collection(db, 'orders'),
        where('whatsapp_number', '==', whatsappNumber)
      );
      const ordersSnap = await getDocs(ordersQuery);
      
      const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as Order);
      
      // Calculate stats based ONLY on completed orders
      const completedOrders = allOrders.filter(o => o.status === 'completed');
      const totalOrdersCount = completedOrders.length;
      const totalSpentAmount = completedOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
      
      // 10% Cashback earned on all completed orders!
      const rewardWalletBalance = Math.round(totalSpentAmount * 0.10); 

      await updateDoc(doc(db, 'users', userId), {
        total_orders: totalOrdersCount,
        total_spent: totalSpentAmount,
        wallet_balance: rewardWalletBalance
      });
    } catch (err) {
      console.error("Error syncing customer stats:", err);
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    setStatusUpdatingId(id);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'cancelled') {
        updates.cancelled_by = 'admin';
      }
      await updateDoc(doc(db, 'orders', id), updates);

      // Sync stats of the user
      const updatedOrder = orders.find(o => o.id === id);
      if (updatedOrder && updatedOrder.whatsapp_number) {
        setTimeout(() => {
          syncUserStats(updatedOrder.whatsapp_number);
        }, 500);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (order.customer_name?.toLowerCase() || '').includes(searchLower) ||
      (order.whatsapp_number || '').includes(searchQuery) ||
      (order.product_details?.toLowerCase() || '').includes(searchLower) ||
      (order.location?.toLowerCase() || '').includes(searchLower);

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
      const orderToDeleteDoc = orders.find(o => o.id === id);
      const whatsappNumber = orderToDeleteDoc?.whatsapp_number;

      await deleteDoc(doc(db, 'orders', id));

      if (whatsappNumber) {
        setTimeout(() => {
          syncUserStats(whatsappNumber);
        }, 500);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'packing': return 'bg-blue-100 text-blue-700';
      case 'shipping': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'completed': return 'bg-slate-900 text-white';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Orders" />

      <main className="p-4 md:p-8">
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

                  <div className="flex flex-col lg:flex-row items-start justify-between gap-8 sm:pl-10">
                    <div className="flex-1 w-full lg:w-auto">
                      <div className="flex items-start gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-2xl hidden sm:flex shrink-0">
                          {order.customer_name?.charAt(0) || '?'}
                        </div>
                        <div className="sm:hidden shrink-0 mt-1">
                           <input 
                            type="checkbox" 
                            className="w-6 h-6 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-1">
                            <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">{order.customer_name || 'Generic Customer'}</h3>
                            <span className={cn(
                              "px-3 py-1 rounded text-[10px] font-black uppercase tracking-[0.15em] shadow-sm",
                              getStatusColor(order.status)
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Contact Hub:</span>
                              <span>{order.whatsapp_number}</span>
                            </div>
                            <span className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              {order.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 group">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-brand shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Package Payload & Quantity</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-inner">
                            {(order.product_name || order.quantity) && (
                              <div className="mb-4 pb-4 border-b border-slate-50">
                                {order.product_name && (
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name</span>
                                    <span className="font-black text-slate-900 text-sm">{order.product_name}</span>
                                  </div>
                                )}
                                {order.quantity && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</span>
                                    <span className="font-black text-brand text-sm">{order.quantity} Units</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex flex-col gap-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description / Special Instructions</p>
                              <p className="font-bold text-slate-800 text-base whitespace-pre-wrap leading-relaxed">
                                {order.product_details || 'No additional details specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-brand/5 rounded-2xl p-6 border border-brand/10 flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl border border-brand/20 flex items-center justify-center text-brand shrink-0 group-hover:scale-110 transition-transform">
                              <span className="font-black text-xl">৳</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Transaction Total</p>
                              <p className="text-2xl font-black text-slate-900 leading-none mt-1">{formatCurrency(order.price)}</p>
                            </div>
                          </div>
                          <div className="hidden sm:block text-right">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt ID</p>
                             <p className="text-[10px] font-mono text-slate-500 font-bold">{order.id.toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-6 min-w-[280px] w-full lg:w-auto">
                      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-400 mb-6 pb-4 border-b border-slate-50">
                          <Clock className="w-4 h-4" />
                          <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                            Recorded: {format(new Date(order.created_at), 'PPP p')}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 block">Tracking Deployment</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => updateStatus(order.id, 'pending')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'pending' 
                                  ? "bg-amber-500 text-white border-amber-500 ring-4 ring-amber-100" 
                                  : "bg-white text-amber-500 border-amber-200 hover:bg-amber-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'pending' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Pending"}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'packing')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'packing' 
                                  ? "bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100" 
                                  : "bg-white text-blue-600 border-blue-100 hover:bg-blue-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'packing' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Packing"}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'shipping')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'shipping' 
                                  ? "bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100" 
                                  : "bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'shipping' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Shipping"}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'delivered')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'delivered' 
                                  ? "bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100" 
                                  : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'delivered' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Delivery"}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'completed')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'completed' 
                                  ? "bg-slate-900 text-white border-slate-900 ring-4 ring-slate-100" 
                                  : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'completed' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Completed"}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'cancelled')}
                              disabled={statusUpdatingId === order.id}
                              className={cn(
                                "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center",
                                order.status === 'cancelled' 
                                  ? "bg-red-600 text-white border-red-600 ring-4 ring-red-100" 
                                  : "bg-white text-red-600 border-red-200 hover:bg-red-50 active:scale-95"
                              )}
                            >
                              {statusUpdatingId === order.id && order.status === 'cancelled' ? <Loader2 className="w-3 h-3 animate-spin"/> : "Cancel Order"}
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={deletingId === order.id}
                            className="w-full mt-6 py-4 flex items-center justify-center gap-3 text-white bg-slate-900 hover:bg-black rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            {deletingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                            Purge Record
                          </button>
                        </div>
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
              className="flex-1 py-3.5 bg-slate-900 hover:bg-black active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 cursor-pointer"
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
