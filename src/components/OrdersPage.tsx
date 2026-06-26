import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, where, getDocs, limit } from 'firebase/firestore';
import { Order } from '../types';
import Header from '../components/Header';
import Modal from './Modal';
import OrderTableView from './OrderTableView';
import LoadingDots from './LoadingDots';
import { Loader2, Phone, MapPin, Package, Clock, CheckCircle, Search, Trash2, ShieldCheck, Lock, Copy, Check, MessageSquare, Store } from 'lucide-react';
import { formatCurrency, cn, exportToCSV } from '../lib/utils';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from 'lucide-react';
import { decryptData, encryptData } from '../lib/security';

interface OrdersPageProps {
  userSession?: any;
}

export default function OrdersPage({ userSession }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isSeller = userSession?.role === 'seller';
  const currentSellerId = userSession?.sellerId || '';
  const currentSellerName = userSession?.name || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [otpVerifyOrderId, setOtpVerifyOrderId] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isTableView, setIsTableView] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Record<string, any>>({});

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe Non-Blocking Confirmation States
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  useEffect(() => {
    // 1. Listen to limited set of recent orders (quota saving)
    let q;
    if (isSeller) {
      // If seller_id is not yet common in orders, we might need to filter by name for now, 
      // but ideally use seller_id.
      q = query(
        collection(db, 'orders'), 
        where('seller_id', '==', currentSellerId),
        orderBy('created_at', 'desc'), 
        limit(300)
      );
    } else {
      q = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(300));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...rawData,
          customer_name: decryptData(rawData.customer_name),
          whatsapp_number: decryptData(rawData.whatsapp_number),
          location: decryptData(rawData.location),
          product_details: decryptData(rawData.product_details),
          created_at: rawData.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }) as Order[];
      
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // 2. Fetch sellers once (they don't change often)
    const fetchSellers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'sellers'));
        const sellersMap: Record<string, any> = {};
        snapshot.docs.forEach(doc => {
          sellersMap[doc.data().name] = { id: doc.id, ...doc.data() };
        });
        setSellers(sellersMap);
      } catch (err) {
        console.warn("Failed to fetch sellers map, might be quota issue:", err);
      }
    };
    fetchSellers();

    return () => {
      unsubscribe();
    };
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
    if (newStatus === 'confirmed') {
      initiateOtpVerification(id);
      return;
    }
    
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

  const initiateOtpVerification = (id: string) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setOtpVerifyOrderId(id);
    setEnteredOtp('');
    setOtpError('');
    
    // Simulate sending SMS
    console.log(`[OTP SENT] To order ${id}: ${otp}`);
    alert(`Verification PIN: ${otp} (Simulated SMS sent to buyer)`);
  };

  const verifyOtp = async () => {
    if (enteredOtp === generatedOtp) {
      if (otpVerifyOrderId) {
        setStatusUpdatingId(otpVerifyOrderId);
        try {
          await updateDoc(doc(db, 'orders', otpVerifyOrderId), { status: 'confirmed' });
          setOtpVerifyOrderId(null);
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `orders/${otpVerifyOrderId}`);
        } finally {
          setStatusUpdatingId(null);
        }
      }
    } else {
      setOtpError('Invalid OTP code. Please check again.');
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'confirmed': return 'bg-teal-100 text-teal-700';
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
          <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200">
             <button onClick={() => setIsTableView(true)} className={cn("px-4 py-2 rounded-lg text-xs font-black", isTableView ? "bg-slate-900 text-white" : "text-slate-500")}>Table View</button>
             <button onClick={() => setIsTableView(false)} className={cn("px-4 py-2 rounded-lg text-xs font-black", !isTableView ? "bg-slate-900 text-white" : "text-slate-500")}>Card View</button>
          </div>
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

            <button 
                onClick={() => exportToCSV(filteredOrders, 'orders')}
                className="bg-white border border-indigo-200 text-indigo-600 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors"
            >
                Export CSV
            </button>

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
            <LoadingDots />
          </div>
        ) : (
          <div className="space-y-4">
            {isTableView ? (
              <OrderTableView orders={filteredOrders} onStatusChange={updateStatus} statusUpdatingId={statusUpdatingId} />
            ) : (
                <AnimatePresence mode="popLayout">
                  {filteredOrders.map((order) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      key={order.id}
                      className={cn(
                        "bg-white rounded-2xl border p-0 overflow-hidden transition-all duration-300 relative",
                        selectedOrders.has(order.id) ? "border-brand shadow-lg shadow-brand/10 ring-2 ring-brand/10" : "border-slate-200 hover:shadow-md"
                      )}
                    >
                      {/* Status Bar */}
                      <div className={cn("h-1.5 w-full", getStatusColor(order.status).split(' ')[0])} />

                      <div className="p-6">
                        <div className="absolute top-6 right-6 z-10">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                          />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          {/* Customer Info Section (Left) */}
                          <div className="lg:col-span-4 space-y-6">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Customer Details</p>
                              <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-tight bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                                {order.customer_name || 'Generic Customer'}
                              </h3>
                            </div>

                            <div className="space-y-4">
                              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl relative group">
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">WhatsApp Primary Hub</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-black text-emerald-700 tracking-tight">{order.whatsapp_number}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleCopy(`${order.id}-wa`, order.whatsapp_number)}
                                      className="p-2 bg-white text-slate-400 hover:text-brand rounded-lg shadow-sm transition-all"
                                    >
                                      {copiedId === `${order.id}-wa` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    <a
                                      href={`https://wa.me/${order.whatsapp_number.replace(/[^0-9]/g, '').startsWith('01') ? '88' + order.whatsapp_number.replace(/[^0-9]/g, '') : order.whatsapp_number.replace(/[^0-9]/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm hover:bg-emerald-600 transition-all"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </a>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Shipping Location</p>
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                  <span className="text-sm font-bold text-slate-700 leading-snug">{order.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Product & Payload Section (Center) */}
                          <div className="lg:col-span-5 space-y-6">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Order Content</p>
                              <div className="bg-brand/5 border border-brand/10 p-4 rounded-2xl">
                                {order.product_name && (
                                  <div className="mb-4">
                                    <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-1">Product Title</p>
                                    <h4 className="text-xl font-black text-slate-900 tracking-tighter">{order.product_name}</h4>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div className="bg-white p-3 rounded-xl border border-brand/10 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Quantity</p>
                                    <p className="text-lg font-black text-brand">{order.quantity || '1'} Items</p>
                                  </div>
                                  <div className="bg-white p-3 rounded-xl border border-brand/10 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                                    <p className="text-lg font-black text-slate-900">{formatCurrency(order.price)}</p>
                                  </div>
                                </div>

                                <div className="bg-white/50 p-3 rounded-xl border border-brand/5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Merchant / Seller</p>
                                  <div className="flex items-center gap-3">
                                    {order.seller_logo || (order.seller && sellers[order.seller]?.logo) ? (
                                      <img 
                                        src={order.seller_logo || sellers[order.seller!]?.logo} 
                                        alt="Seller" 
                                        className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                        <Store className="w-4 h-4 text-slate-400" />
                                      </div>
                                    )}
                                    <span className="font-black text-slate-700 uppercase tracking-tight text-sm">
                                      {order.seller || 'pbazar Official'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Instructions / Details</p>
                              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                                <p className="text-sm font-bold text-slate-600 whitespace-pre-wrap leading-relaxed">
                                  {order.product_details || 'No additional specifications provided.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Management & Status Section (Right) */}
                          <div className="lg:col-span-3">
                            <div className="bg-slate-900 rounded-2xl p-5 text-white h-full space-y-6">
                              <div className="border-b border-white/10 pb-4">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Current Deployment Status</p>
                                <div className={cn(
                                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                  getStatusColor(order.status)
                                )}>
                                  <CheckCircle className="w-3 h-3" />
                                  {order.status}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Update Operational Stage</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => updateStatus(order.id, status as Order['status'])}
                                      disabled={statusUpdatingId === order.id}
                                      className={cn(
                                        "py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                                        order.status === status
                                          ? "bg-white text-slate-900 border-white"
                                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                                      )}
                                    >
                                      {statusUpdatingId === order.id && order.status === status ? <Loader2 className="w-3 h-3 animate-spin mx-auto"/> : status}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="pt-4 space-y-3">
                                <div className="flex items-center gap-2 text-white/40">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-[9px] font-black uppercase tracking-widest">{format(new Date(order.created_at), 'PPP')}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  disabled={deletingId === order.id}
                                  className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                  Purge Record
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
            )}
            
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
        isOpen={otpVerifyOrderId !== null}
        onClose={() => setOtpVerifyOrderId(null)}
        title="Buyer OTP Verification"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Confirming Order For</p>
            {otpVerifyOrderId && orders.find(o => o.id === otpVerifyOrderId) && (
              <div className="text-center">
                <p className="text-lg font-black text-slate-900 uppercase">
                  {orders.find(o => o.id === otpVerifyOrderId)?.customer_name}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1 text-emerald-600">
                  <Phone className="w-3 h-3" />
                  <p className="text-sm font-bold tracking-tight">
                    {orders.find(o => o.id === otpVerifyOrderId)?.whatsapp_number}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Enter 4-Digit OTP Code</label>
            <div className="flex justify-center gap-3">
              <input
                type="text"
                maxLength={4}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="0 0 0 0"
                className="w-full max-w-[200px] text-center text-3xl font-black tracking-[0.5em] py-4 rounded-2xl bg-white border-2 border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all font-mono"
              />
            </div>
            {otpError && <p className="text-rose-500 text-[10px] font-black uppercase text-center">{otpError}</p>}
            <p className="text-[9px] text-slate-400 text-center font-bold">The buyer should have received an OTP via WhatsApp or SMS.</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={verifyOtp}
              disabled={enteredOtp.length < 4 || statusUpdatingId !== null}
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              {statusUpdatingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify & Confirm
            </button>
            <button
              onClick={() => setOtpVerifyOrderId(null)}
              className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
            >
              Cancel
            </button>
          </div>

          <button 
            onClick={() => initiateOtpVerification(otpVerifyOrderId!)}
            className="w-full text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
          >
            Resend OTP Code
          </button>
        </div>
      </Modal>

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
