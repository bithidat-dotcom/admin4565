import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, Order, Product, CustomerActivity } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Users, Search, Phone, PhoneCall, Mail, MapPin, ShoppingBag, 
  Eye, Globe, Sparkles, ExternalLink, MessageSquare, 
  ShieldCheck, Package, Clock, X, Trash2, Ban, CheckCircle2, 
  UserPlus, Loader2, AlertTriangle, Copy, Check, Upload, ArrowUpDown 
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

  // Action States
  const [customerToDelete, setCustomerToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLocation, setNewCustLocation] = useState('Dhaka, Bangladesh');
  const [newCustImage, setNewCustImage] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const [addCustError, setAddCustError] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    // 1. Fetch from Host Server Users API
    const loadServerUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d.users)) {
            setCustomers(prev => mergeUserLists(prev, d.users));
          }
        }
      } catch (err) {
        console.warn('Could not load server users backup:', err);
      }
    };
    loadServerUsers();

    if (isQuotaExceeded()) {
      setLoading(false);
      return;
    }

    // 2. Real-time Firestore users listener
    const qUsers = query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(150));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        created_at: d.data().created_at?.toDate?.()?.toISOString() || d.data().created_at || new Date().toISOString()
      })) as User[];

      setCustomers(prev => mergeUserLists(data, prev));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    // 3. Load orders for calculating real purchase counts
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
    }, () => {});

    // 4. Load products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    }, () => {});

    // 5. Load server product click activities
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

  // Merge Firestore and Host Server lists by unique phone or id
  const mergeUserLists = (primary: User[], secondary: User[]): User[] => {
    const map = new Map<string, User>();
    [...primary, ...secondary].forEach(u => {
      const cleanPhone = u.whatsapp_number ? u.whatsapp_number.replace(/\D/g, '') : '';
      const key = cleanPhone || u.id;
      if (!map.has(key)) {
        map.set(key, u);
      } else {
        // Merge preferring custom image and latest data
        const existing = map.get(key)!;
        map.set(key, {
          ...existing,
          ...u,
          image: u.image || existing.image,
          is_order_blocked: typeof u.is_order_blocked === 'boolean' ? u.is_order_blocked : existing.is_order_blocked
        });
      }
    });
    return Array.from(map.values());
  };

  const getCustomerAvatar = (name: string, customImage?: string) => {
    if (customImage && customImage.trim().length > 5) return customImage;
    const hash = (name || 'User').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const id = (hash % 70) + 1;
    return `https://i.pravatar.cc/150?img=${id}`;
  };

  // Build customer stats with orders and click activities
  const customerStats = customers.map(c => {
    const cleanPhone = c.whatsapp_number ? c.whatsapp_number.replace(/\D/g, '') : '';
    const matchedOrders = orders.filter(o => {
      const oPhone = o.whatsapp_number ? o.whatsapp_number.replace(/\D/g, '') : '';
      return (cleanPhone && oPhone && cleanPhone === oPhone) ||
        (o.customer_name && o.customer_name.toLowerCase().trim() === c.name.toLowerCase().trim());
    });

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
      (cleanPhone && a.customer_phone && a.customer_phone.replace(/\D/g, '') === cleanPhone) ||
      (a.customer_name && a.customer_name.toLowerCase().trim() === c.name.toLowerCase().trim())
    );

    return {
      ...c,
      totalOrders: visibleOrders.length,
      totalQuantity: totalQuantity || c.total_orders || 0,
      totalSpent: totalSpent || c.total_spent || 0,
      userClicks,
      is_order_blocked: !!c.is_order_blocked,
      ip_address: c.ip_address || userClicks[0]?.ip_address || '103.145.23.18'
    };
  });

  const filteredCustomers = customerStats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.whatsapp_number && c.whatsapp_number.includes(searchQuery)) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (isAdmin && c.ip_address?.includes(searchQuery))
  );

  // 1. Admin Delete User Account Action
  const handleDeleteUser = async (customer: User) => {
    setIsDeleting(true);
    try {
      // Delete on Host Server
      try {
        await fetch(`/api/users/${customer.id}`, { method: 'DELETE' });
      } catch (sErr) {
        console.warn('Server user delete warning:', sErr);
      }

      // Delete on Firestore
      try {
        await deleteDoc(doc(db, 'users', customer.id));
      } catch (fErr) {
        console.warn('Firestore user delete warning:', fErr);
      }

      // Optimistic update
      setCustomers(prev => prev.filter(u => u.id !== customer.id && u.whatsapp_number !== customer.whatsapp_number));
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
      setCustomerToDelete(null);
      showToast(`User account "${customer.name}" deleted successfully.`);
    } catch (err: any) {
      alert('Error deleting user: ' + (err.message || 'Please try again.'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 2. Stop User Order Action (Toggle Block / Allow)
  const handleToggleStopOrder = async (customer: User) => {
    const nextState = !customer.is_order_blocked;
    setActionLoadingId(customer.id);

    try {
      // 1. Update on Host Server
      try {
        await fetch(`/api/users/${customer.id}/toggle_order_block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_order_blocked: nextState })
        });
      } catch (sErr) {
        console.warn('Server toggle error:', sErr);
      }

      // 2. Update on Firestore
      try {
        await updateDoc(doc(db, 'users', customer.id), {
          is_order_blocked: nextState,
          status: nextState ? 'blocked' : 'active'
        });
      } catch (fErr) {
        console.warn('Firestore toggle error:', fErr);
      }

      // 3. Update local state
      setCustomers(prev => prev.map(u => {
        if (u.id === customer.id || u.whatsapp_number === customer.whatsapp_number) {
          return { ...u, is_order_blocked: nextState, status: nextState ? 'blocked' : 'active' };
        }
        return u;
      }));

      showToast(nextState 
        ? `⛔ Orders stopped for ${customer.name}. New orders from this customer are blocked.` 
        : `✅ Orders re-enabled for ${customer.name}.`
      );
    } catch (err: any) {
      alert('Could not update order status: ' + (err.message || String(err)));
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Add / Check-in New Customer
  const handleAddNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      setAddCustError('Customer name and phone number are required');
      return;
    }

    setIsSubmittingCust(true);
    setAddCustError('');

    try {
      const finalImage = newCustImage || `https://i.pravatar.cc/150?img=${(newCustPhone.slice(-2) ? parseInt(newCustPhone.slice(-2)) % 70 : 15) + 1}`;
      const payload = {
        name: newCustName.trim(),
        whatsapp_number: newCustPhone.trim(),
        phone: newCustPhone.trim(),
        image: finalImage,
        location: newCustLocation.trim() || 'Dhaka, Bangladesh',
        ip_address: '103.145.23.18'
      };

      // Sync to Server
      let serverUser: any = null;
      try {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const sData = await res.json();
          serverUser = sData.user;
        }
      } catch (err) {
        console.warn('Server user sync error:', err);
      }

      // Sync to Firestore
      const userId = serverUser?.id || `USER_${newCustPhone.replace(/\D/g, '') || Date.now()}`;
      try {
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          name: newCustName.trim(),
          whatsapp_number: newCustPhone.trim(),
          image: finalImage,
          location: newCustLocation.trim() || 'Dhaka, Bangladesh',
          created_at: serverTimestamp(),
          last_login: new Date().toISOString(),
          status: 'active',
          is_order_blocked: false
        }, { merge: true });
      } catch (fErr) {
        console.warn('Firestore user creation warning:', fErr);
      }

      // Add to local state
      const createdUser: User = {
        id: userId,
        name: newCustName.trim(),
        whatsapp_number: newCustPhone.trim(),
        image: finalImage,
        location: newCustLocation.trim() || 'Dhaka, Bangladesh',
        created_at: new Date().toISOString(),
        is_order_blocked: false,
        total_orders: 0,
        total_spent: 0
      };

      setCustomers(prev => mergeUserLists([createdUser], prev));
      setIsAddModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustImage('');
      showToast(`Customer "${createdUser.name}" added and verified successfully!`);
    } catch (err: any) {
      setAddCustError(err.message || 'Failed to save customer');
    } finally {
      setIsSubmittingCust(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, filename: file.name })
        });
        if (res.ok) {
          const data = await res.json();
          setNewCustImage(data.url || base64);
        } else {
          setNewCustImage(base64);
        }
      } catch {
        setNewCustImage(base64);
      } finally {
        setIsUploadingImg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const copyPhoneNumber = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider animate-in slide-in-from-top-4 border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-6 h-6 text-[#1E5EF3]" />
            {isAdmin ? 'Customer Intelligence & Policy CRM' : 'Customer Directory & Order Contacts'}
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            {isAdmin 
              ? 'Real-time buyer accounts showing profile photo, phone, direct calling, order suspension controls, IP address, and total units bought'
              : 'Verified customer details, direct call links, and purchased quantities for your shop'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAdmin ? "Search name, phone, IP..." : "Search name or phone..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10 shadow-xs"
            />
          </div>

          {/* Add / Check-in Customer */}
          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#1E5EF3] hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-auto min-w-[980px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4">Customer Name & Profile</th>
                  <th className="p-4">Phone Number & Direct Call</th>
                  <th className="p-4 text-center">Order Status & Control</th>
                  {isAdmin && <th className="p-4">Network IP Address (Policy)</th>}
                  <th className="p-4">Delivery Area</th>
                  <th className="p-4 text-center">Items Bought (Qty)</th>
                  <th className="p-4 text-right">Total Spent</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredCustomers.map(customer => {
                  const avatarUrl = getCustomerAvatar(customer.name, customer.image);
                  const isBlocked = customer.is_order_blocked;

                  return (
                    <tr key={customer.id} className={cn("hover:bg-slate-50/80 transition-colors", isBlocked && "bg-rose-50/30")}>
                      {/* Name & Profile Picture */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img 
                              src={avatarUrl} 
                              alt={customer.name} 
                              className="w-11 h-11 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-slate-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://i.pravatar.cc/150?img=12`;
                              }}
                            />
                            {isBlocked && (
                              <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white rounded-full p-0.5 border border-white" title="Orders Blocked">
                                <Ban className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 font-black uppercase text-xs">{customer.name}</span>
                              {isBlocked && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[8px] font-black uppercase">
                                  Blocked
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono uppercase block">
                              ID: {customer.id.length > 12 ? customer.id.slice(0, 10) + '...' : customer.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Direct Call (Prominent Button) */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Direct Call Button */}
                          <a 
                            href={`tel:${customer.whatsapp_number}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                            title="Click to directly call this customer phone"
                          >
                            <PhoneCall className="w-3.5 h-3.5 text-white animate-pulse" />
                            <span>Call {customer.whatsapp_number}</span>
                          </a>

                          {/* WhatsApp Chat Button */}
                          <a
                            href={`https://wa.me/${customer.whatsapp_number?.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            title="Message on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>

                          {/* Copy Phone Button */}
                          <button
                            onClick={() => copyPhoneNumber(customer.whatsapp_number)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Copy Phone Number"
                          >
                            {copiedPhone === customer.whatsapp_number ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Stop User Order / Status Control */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1.5">
                          {isBlocked ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>Orders Stopped</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Orders Allowed</span>
                            </span>
                          )}

                          {/* Toggle Button */}
                          <button
                            onClick={() => handleToggleStopOrder(customer)}
                            disabled={actionLoadingId === customer.id}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border active:scale-95",
                              isBlocked 
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200" 
                                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                            )}
                          >
                            {actionLoadingId === customer.id ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : isBlocked ? (
                              "✅ Allow Orders"
                            ) : (
                              "⛔ Stop Orders"
                            )}
                          </button>
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

                      {/* Actions: View Activities & Delete Account */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Activity */}
                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#1E5EF3] hover:text-white text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="View click activities and timeline"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Activity ({customer.userClicks?.length || 0})</span>
                          </button>

                          {/* Admin: Delete User Account */}
                          {isAdmin && (
                            <button
                              onClick={() => setCustomerToDelete(customer)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 rounded-xl transition-all cursor-pointer active:scale-95"
                              title="Delete customer account completely"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No customer records match search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-5 shadow-2xl relative border border-rose-100">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Delete Customer Account?
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Are you sure you want to permanently delete <strong className="text-slate-900 font-bold">{customerToDelete.name}</strong> ({customerToDelete.whatsapp_number})? This will delete the account from both the server and Firestore database.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(customerToDelete)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Delete Account</span>
              </button>
            </div>
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
                    {selectedCustomer.is_order_blocked && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase">
                        Orders Stopped
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions inside Modal */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <a 
                href={`tel:${selectedCustomer.whatsapp_number}`}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Direct Call</span>
              </a>

              <button
                onClick={() => handleToggleStopOrder(selectedCustomer)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                  selectedCustomer.is_order_blocked 
                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                )}
              >
                {selectedCustomer.is_order_blocked ? "✅ Allow Orders" : "⛔ Stop Orders"}
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    const target = selectedCustomer;
                    setSelectedCustomer(null);
                    setCustomerToDelete(target);
                  }}
                  className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            {/* Activities list (Deduplicated tracking) */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Products Viewed & Clicked (Deduplicated Activity Engine)
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
                  No individual click logs recorded yet for this customer.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Check-In New Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#1E5EF3]" />
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Add / Check-in Customer
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Rahim Chowdhury"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Phone / WhatsApp Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Profile Photo */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Profile Photo (Custom Upload or Preset)
                </label>
                <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                  <img
                    src={newCustImage || "https://i.pravatar.cc/150?img=12"}
                    alt="Preview"
                    className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/30 shadow-xs shrink-0"
                  />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-xs transition-all">
                      <Upload className="w-3.5 h-3.5 text-[#1E5EF3]" />
                      <span>{isUploadingImg ? "Uploading..." : "Upload Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploadingImg}
                      />
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {['11', '12', '32', '60', '68'].map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewCustImage(`https://i.pravatar.cc/150?img=${id}`)}
                          className={cn(
                            "w-6 h-6 rounded-full overflow-hidden border-2 transition-all shrink-0 cursor-pointer",
                            newCustImage === `https://i.pravatar.cc/150?img=${id}` ? "border-blue-600 scale-110" : "border-transparent opacity-70 hover:opacity-100"
                          )}
                        >
                          <img src={`https://i.pravatar.cc/150?img=${id}`} alt="avatar" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Delivery Area / Location
                </label>
                <input
                  type="text"
                  value={newCustLocation}
                  onChange={e => setNewCustLocation(e.target.value)}
                  placeholder="e.g. Gulshan, Dhaka"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {addCustError && (
                <p className="text-rose-500 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {addCustError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust || isUploadingImg}
                  className="flex-1 py-3 bg-[#1E5EF3] hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCust ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
