import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { FoodOrder } from '../types';
import LoadingDots from './LoadingDots';
import { 
  UtensilsCrossed, Calendar, Search, MapPin, Phone, DollarSign, 
  ChevronDown, Clock, Check, ArrowRight, User, Circle 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_TIMELINE = [
  'pending', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'completed'
];

export default function FoodOrdersPage() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    let foodOrders: FoodOrder[] = [];
    let cafeOrders: FoodOrder[] = [];

    const handleMerge = () => {
      const merged = [...foodOrders, ...cafeOrders].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setOrders(merged);
      setLoading(false);
    };

    const qFood = query(collection(db, 'food_orders'), orderBy('created_at', 'desc'));
    const unsubFood = onSnapshot(qFood, (snapshot) => {
      foodOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as FoodOrder[];
      handleMerge();
    }, (error) => {
      console.warn("Food orders listener error:", error);
      setLoading(false);
    });

    const qCafe = query(collection(db, 'cafe_orders'), orderBy('created_at', 'desc'));
    const unsubCafe = onSnapshot(qCafe, (snapshot) => {
      cafeOrders = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          customer_name: d.customer_name || 'Cafe Customer',
          whatsapp_number: d.whatsapp_number || '',
          location: d.location || 'Dhaka',
          food_items: [
            {
              id: 'cafe-item',
              name: d.product_name || 'Cafe Item',
              quantity: d.quantity || 1,
              size: 'default' as const,
              price: d.price || 0
            }
          ],
          price: d.price || 0,
          delivery_charge: d.delivery_charge || 0,
          discount: 0,
          total: (d.price || 0) + (d.delivery_charge || 0),
          payment_method: 'mobile_banking' as const,
          payment_status: d.status === 'completed' ? 'paid' as const : 'pending' as const,
          status: d.status === 'preparing' ? 'preparing' : (d.status === 'completed' ? 'completed' : (d.status === 'cancelled' ? 'cancelled' : 'pending')),
          created_at: d.created_at?.toDate?.()?.toISOString() || d.created_at || new Date().toISOString(),
          isCafe: true
        } as any;
      });
      handleMerge();
    }, (error) => {
      console.warn("Cafe orders listener error:", error);
      setLoading(false);
    });

    return () => {
      unsubFood();
      unsubCafe();
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const order = orders.find(o => o.id === orderId);
    const isCafeOrder = (order as any)?.isCafe;
    const collectionName = isCafeOrder ? 'cafe_orders' : 'food_orders';

    let targetStatus = status;
    if (isCafeOrder) {
      if (status === 'accepted' || status === 'ready' || status === 'preparing') targetStatus = 'preparing';
      else if (status === 'completed' || status === 'delivered' || status === 'picked_up' || status === 'on_the_way') targetStatus = 'completed';
      else if (status === 'cancelled') targetStatus = 'cancelled';
      else targetStatus = 'pending';
    }

    try {
      await updateDoc(doc(db, collectionName, orderId), { status: targetStatus });
    } catch (e) {
      try {
        await updateDoc(doc(db, 'food_orders', orderId), { status });
      } catch (err) {
        try {
          await updateDoc(doc(db, 'cafe_orders', orderId), { status });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${orderId}`);
        }
      }
    }
  };

  const handleSeedDemoOrders = async () => {
    const demo = {
      customer_name: 'Zayn Malik',
      whatsapp_number: '01712345678',
      location: 'House 42, Road 11, Banani, Dhaka',
      food_items: [
        { id: '1', name: 'Crispy Double Chicken Burger', quantity: 2, size: 'medium' as const, price: 250 },
        { id: '2', name: 'Fudge Choco Lava Cake', quantity: 1, size: 'default' as const, price: 150 }
      ],
      price: 650,
      delivery_charge: 50,
      discount: 50,
      total: 650,
      payment_method: 'mobile_banking' as const,
      payment_status: 'paid' as const,
      status: 'pending' as const,
    };

    try {
      await addDoc(collection(db, 'food_orders'), {
        ...demo,
        created_at: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch = o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.whatsapp_number.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const getCustomerAvatar = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const id = (hash % 70) + 1;
    return `https://i.pravatar.cc/150?img=${id}`;
  };

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <UtensilsCrossed className="w-5.5 h-5.5 text-[#1E5EF3]" />
            Restaurant Orders Pipeline
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time order acceptance, kitchen prep timeline & status dispatch</p>
        </div>

        <div className="flex items-center gap-3">
          {orders.length === 0 && (
            <button
              onClick={handleSeedDemoOrders}
              className="px-5 py-2.5 bg-blue-50 text-[#1E5EF3] border border-blue-100 hover:bg-[#1E5EF3] hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Seed Demo Order
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status filters */}
        <div className="flex flex-wrap items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto max-w-full">
          {['all', 'pending', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'completed', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                statusFilter === st
                  ? "bg-[#1E5EF3] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, phone, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/10 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Orders list table columns mapping */}
          <div className="lg:col-span-8 space-y-4">
            {filteredOrders.map(order => {
              const isSelected = selectedOrderId === order.id;
              const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
                month: 'short', day: '2-digit', year: 'numeric'
              });

              return (
                <div 
                  key={order.id}
                  onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                  className={cn(
                    "bg-white rounded-2xl border transition-all cursor-pointer p-5 space-y-4",
                    isSelected 
                      ? "border-[#1E5EF3] shadow-lg ring-1 ring-[#1E5EF3]/20" 
                      : "border-slate-200/60 hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getCustomerAvatar(order.customer_name)} 
                        alt={order.customer_name} 
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                      />
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{order.customer_name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Order #{order.id.slice(0, 8).toUpperCase()} • {dateStr}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                        order.status === 'completed' && "bg-emerald-100 text-emerald-800" ||
                          order.status === 'preparing' && "bg-blue-100 text-[#1E5EF3]" ||
                          order.status === 'pending' && "bg-rose-100 text-rose-800" ||
                          "bg-slate-100 text-slate-700"
                      )}>
                        {order.status}
                      </span>

                      <div onClick={e => e.stopPropagation()} className="relative shrink-0">
                        <select
                          value={order.status}
                          onChange={e => handleUpdateStatus(order.id, e.target.value)}
                          className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none appearance-none cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="preparing">Preparing</option>
                          <option value="ready">Ready</option>
                          <option value="picked_up">Picked Up</option>
                          <option value="on_the_way">On The Way</option>
                          <option value="delivered">Delivered</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-600">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Food Items Ordered</span>
                      <p className="text-slate-900 truncate">
                        {order.food_items?.map(f => `${f.name} (x${f.quantity})`).join(', ') || 'Special Foods'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Delivery Destination</span>
                      <p className="text-slate-900 truncate flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {order.location}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Total Price</span>
                      <p className="text-[#1E5EF3] font-black">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>

                  {/* Active Timeline Tracking display inside order */}
                  {isSelected && (
                    <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-300">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Order Timeline Tracker</p>
                      
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        {STATUS_TIMELINE.map((step, idx) => {
                          const currentIdx = STATUS_TIMELINE.indexOf(order.status);
                          const isDone = currentIdx >= idx;
                          const isActive = order.status === step;

                          return (
                            <div key={step} className="flex items-center gap-1.5">
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black uppercase",
                                  isActive ? "bg-[#1E5EF3] text-white shadow-md shadow-blue-600/10" :
                                  isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                  {isDone && !isActive ? <Check className="w-3.5 h-3.5" /> : idx+1}
                                </div>
                                <span className={cn(
                                  "text-[8px] font-black uppercase mt-1 tracking-wider",
                                  isActive ? "text-[#1E5EF3]" : isDone ? "text-slate-800" : "text-slate-400"
                                )}>
                                  {step.replace('_', ' ')}
                                </span>
                              </div>
                              {idx < STATUS_TIMELINE.length - 1 && (
                                <ArrowRight className={cn(
                                  "w-3.5 h-3.5 shrink-0 hidden sm:block",
                                  isDone ? "text-emerald-500" : "text-slate-200"
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Contact panel */}
                      <div className="bg-slate-50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <Phone className="w-4 h-4 text-emerald-500" />
                          <span>WhatsApp Dispatch Helpline:</span>
                          <span className="font-black text-slate-900">{order.whatsapp_number}</span>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-[#e8f5e9] text-[#2e7d32] px-3 py-1.5 rounded-lg">
                          Payment: {order.payment_method.toUpperCase()} ({order.payment_status.toUpperCase()})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="border border-dashed border-slate-200 bg-white rounded-3xl p-16 text-center flex flex-col items-center justify-center">
                <UtensilsCrossed className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-xs font-black text-slate-900 uppercase tracking-widest">No Active Restaurant Orders</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Orders dispatched by buyers will automatically enter this real-time pipeline.</p>
              </div>
            )}
          </div>

          {/* Right sidebar order details inspector panel */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm sticky top-6 space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2 pb-4 border-b border-slate-100">
              <Calendar className="w-4.5 h-4.5 text-[#1E5EF3]" />
              Order Dispatch Desk
            </h3>

            {selectedOrderId ? (
              (() => {
                const order = orders.find(o => o.id === selectedOrderId);
                if (!order) return <p className="text-xs font-bold text-slate-400">Order not found.</p>;

                return (
                  <div className="space-y-5 text-xs font-bold text-slate-700">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-slate-400 font-black tracking-wider">Delivery Instructions</p>
                      <p className="text-slate-900 leading-relaxed font-semibold">{order.location}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase text-slate-400 font-black tracking-wider">Itemized Breakdown</p>
                      <div className="space-y-1.5">
                        {order.food_items?.map(item => (
                          <div key={item.name} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <p className="text-slate-900 uppercase font-black">{item.name}</p>
                              <span className="text-[9px] text-slate-400 font-black uppercase">Size: {item.size} x {item.quantity}</span>
                            </div>
                            <span className="font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Subtotal</span>
                        <span className="text-slate-900 font-black">{formatCurrency(order.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Delivery Charge</span>
                        <span className="text-slate-900 font-black">+{formatCurrency(order.delivery_charge || 0)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Promo Discount</span>
                          <span>-{formatCurrency(order.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100 font-black">
                        <span className="text-slate-900 uppercase tracking-wider">Grand Total</span>
                        <span className="text-[#1E5EF3]">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-widest">Select an order row</p>
                <p className="text-[9px] font-bold uppercase max-w-[200px] mx-auto text-slate-400">Clicking any active card exposes the itemized receipts and timeline trackers.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
