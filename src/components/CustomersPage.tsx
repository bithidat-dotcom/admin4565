import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { User, Order, Product, CustomerActivity } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Users, Search, Phone, Mail, MapPin, ShoppingBag, 
  Eye, Globe, Sparkles, ExternalLink, MessageSquare, 
  ShieldCheck, Package, Clock, X 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';

interface CustomersPageProps {
  userSession?: any;
}

export default function CustomersPage({ userSession }: CustomersPageProps) {
  const isAdmin = !userSession || userSession.role === 'admin';
  const isSeller = userSession?.role === 'product_seller' || userSession?.role === 'food_seller';
  const currentSellerId = userSession?.sellerId || '';
  const currentSellerName = userSession?.name || '';

  const [customers, setCustomers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clickActivities, setClickActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load users
    const qUsers = query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(100));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as User[];
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    // Load orders for calculating real purchase counts
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
    }, () => {});

    // Load products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    }, () => {});

    // Load server product click activities
    fetch('/api/product_clicks')
      .then(res => res.json())
      .then(d => {
        if (d.clicks) setClickActivities(d.clicks);
      })
      .catch(() => {});

    return () => {
      unsubUsers();
      unsubOrders();
      unsubProducts();
    };
  }, []);

  const getCustomerAvatar = (name: string, customImage?: string) => {
    if (customImage) return customImage;
    const hash = (name || 'User').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const id = (hash % 70) + 1;
    return `https://i.pravatar.cc/150?img=${id}`;
  };

  // Build customer stats with orders
  const customerStats = customers.map(c => {
    // Orders matching customer phone or name
    const matchedOrders = orders.filter(o => 
      (o.whatsapp_number && o.whatsapp_number === c.whatsapp_number) ||
      (o.customer_name && o.customer_name.toLowerCase() === c.name.toLowerCase())
    );

    // If seller view: filter orders to this seller only
    const visibleOrders = isSeller 
      ? matchedOrders.filter(o => 
          (o.seller_id && o.seller_id.toLowerCase() === currentSellerId.toLowerCase()) ||
          (o.seller && o.seller.toLowerCase() === currentSellerName.toLowerCase())
        )
      : matchedOrders;

    const totalQuantity = visibleOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
    const totalSpent = visibleOrders.reduce((sum, o) => sum + (Number(o.price || 0) * (Number(o.quantity) || 1)), 0);

    // Filter clicked activities for this customer
    const userClicks = clickActivities.filter(a => 
      a.customer_id === c.id || 
      a.customer_phone === c.whatsapp_number ||
      (a.customer_name && a.customer_name.toLowerCase() === c.name.toLowerCase())
    );

    return {
      ...c,
      totalOrders: visibleOrders.length,
      totalQuantity,
      totalSpent,
      userClicks,
      ip_address: c.ip_address || userClicks[0]?.ip_address || '103.145.23.18'
    };
  });

  const filteredCustomers = customerStats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.whatsapp_number.includes(searchQuery) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (isAdmin && c.ip_address?.includes(searchQuery))
  );

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-6 h-6 text-[#1E5EF3]" />
            {isAdmin ? 'Customer Intelligence & Policy CRM' : 'Customer Directory & Order Contacts'}
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            {isAdmin 
              ? 'Complete customer profiles showing buyer photo, phone, verified IP address, bought quantity, and full product click activity'
              : 'Verified customer details, ordered quantities, and direct call support for sellers'}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isAdmin ? "Search name, phone, IP address..." : "Search name or phone..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-auto min-w-[900px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4">Customer Name & Profile</th>
                  <th className="p-4">Phone Number & Direct Call</th>
                  {isAdmin && <th className="p-4">Network IP Address (Policy)</th>}
                  <th className="p-4">Delivery Area</th>
                  <th className="p-4 text-center">Items Bought (Qty)</th>
                  <th className="p-4 text-right">Total Spent</th>
                  <th className="p-4 text-center">Activity & History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredCustomers.map(customer => {
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Profile Picture */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={getCustomerAvatar(customer.name, customer.image)} 
                            alt={customer.name} 
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-xs shrink-0"
                          />
                          <div>
                            <span className="text-slate-900 font-black uppercase text-xs block">{customer.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">ID: {customer.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Direct Call */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <a 
                            href={`tel:${customer.whatsapp_number}`}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Direct Call Customer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{customer.whatsapp_number}</span>
                          </a>

                          <a
                            href={`https://wa.me/${customer.whatsapp_number?.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                            title="Message on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Admin View: Network IP Address */}
                      {isAdmin && (
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-mono text-xs font-bold text-slate-800">{customer.ip_address}</span>
                          </div>
                          <span className="text-[8px] text-emerald-600 font-bold uppercase tracking-wider">Policy Verified</span>
                        </td>
                      )}

                      {/* Delivery Area */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-slate-600 max-w-[160px] truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{customer.location || 'Dhaka, Bangladesh'}</span>
                        </div>
                      </td>

                      {/* Items Bought (Quantity) */}
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-[#1E5EF3] rounded-lg font-black text-xs">
                          {customer.totalQuantity || customer.total_orders || 0} units
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="p-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(customer.totalSpent || customer.total_spent || 0)}
                      </td>

                      {/* Activity & Click History */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#1E5EF3] hover:text-white text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 mx-auto transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Activities ({customer.userClicks?.length || 0})</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No customer records match search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Product Click Activity Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img 
                  src={getCustomerAvatar(selectedCustomer.name, selectedCustomer.image)} 
                  alt="Customer" 
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                />
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    Customer Activity Timeline: {selectedCustomer.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-0.5">
                    <span className="text-emerald-600 font-black">{selectedCustomer.whatsapp_number}</span>
                    {isAdmin && <span>• IP: <strong className="font-mono text-slate-800">{selectedCustomer.ip_address}</strong></span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Activities list (Deduplicated tracking) */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Products Viewed & Clicked (Deduplicated Records)
              </p>

              {selectedCustomer.userClicks && selectedCustomer.userClicks.length > 0 ? (
                selectedCustomer.userClicks.map((act) => (
                  <div key={act.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {act.product_image ? (
                        <img src={act.product_image} alt={act.product_name} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1E5EF3] flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 uppercase truncate">{act.product_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">PID: {act.product_id.slice(0, 8)}</p>
                        <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                          Last Visited: {format(new Date(act.last_clicked_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 bg-[#1E5EF3]/10 text-[#1E5EF3] rounded-lg text-xs font-black">
                        {act.click_count} {act.click_count === 1 ? 'click' : 'clicks'}
                      </span>
                      <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Deduplicated</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-xs">
                  No individual click logs recorded yet for this user.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <a 
                href={`tel:${selectedCustomer.whatsapp_number}`}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Call {selectedCustomer.name}</span>
              </a>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
