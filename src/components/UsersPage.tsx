import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, where, updateDoc, limit } from 'firebase/firestore';
import { User, Order, View } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { Users, Trash2, Loader2, Phone, MapPin, Mail, Calendar, Hash, ExternalLink, Package, Coins, ShieldCheck, Lock, Copy, Check, MessageSquare } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { Storage } from '../lib/storage';
import { format } from 'date-fns';
import { decryptData, encryptData } from '../lib/security';

interface UsersPageProps {
  onViewChange?: (view: View) => void;
}

export default function UsersPage({ onViewChange }: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTableView, setIsTableView] = useState(false);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Manual Balance Adjustment States
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<User | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState('');
  const [updatingBalance, setUpdatingBalance] = useState(false);

  const confirmAdjustBalance = async () => {
    if (!selectedUserForBalance) return;
    setUpdatingBalance(true);
    try {
      const parsed = parseFloat(newBalanceValue);
      if (isNaN(parsed)) throw new Error("Invalid format");
      await updateDoc(doc(db, 'users', selectedUserForBalance.id), {
        wallet_balance: parsed
      });
      setSelectedUserForBalance(null);
    } catch (err: any) {
      console.error("Error setting wallet balance:", err);
    } finally {
      setUpdatingBalance(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // 0. Load cache for instant display
    const loadCache = async () => {
      const cachedUsers = await Storage.getLarge<User[]>('users_page_cache');
      if (cachedUsers) {
        setUsers(cachedUsers);
      }
      
      const cachedOrders = await Storage.getLarge<Order[]>('users_orders_cache');
      if (cachedOrders) {
        setOrders(cachedOrders);
      }
    };
    loadCache();

    // 1. Listen to registered users (limited)
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(300)), (usersSnap) => {
      const usersList = usersSnap.docs
        .filter(doc => doc.data().is_hidden !== true)
        .map(doc => {
        const rawData = doc.data();
        let resolvedDate = new Date().toISOString();
        if (rawData.created_at) {
          resolvedDate = typeof rawData.created_at.toDate === 'function' 
            ? rawData.created_at.toDate().toISOString() 
            : String(rawData.created_at);
        } else if (rawData.createdAt) {
          resolvedDate = typeof rawData.createdAt.toDate === 'function'
            ? rawData.createdAt.toDate().toISOString()
            : String(rawData.createdAt);
        } else if (rawData.last_login) {
          resolvedDate = typeof rawData.last_login.toDate === 'function'
            ? rawData.last_login.toDate().toISOString()
            : String(rawData.last_login);
        }

        return {
          id: doc.id,
          ...rawData,
          name: decryptData(rawData.name || rawData.displayName || rawData.userName || '').trim(),
          whatsapp_number: decryptData(rawData.whatsapp_number || rawData.phone || rawData.phoneNumber || '').trim(),
          location: decryptData(rawData.location || rawData.address || '').trim(),
          email: decryptData(rawData.email || rawData.emailAddress || '').trim(),
          created_at: resolvedDate,
          isGuest: false
        };
      }) as User[];
      setUsers(usersList);
      Storage.setLarge('users_page_cache', usersList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    // 2. Listen to orders (limited)
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), limit(300), orderBy('created_at', 'desc')), (ordersSnap) => {
      const ordersList = ordersSnap.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...rawData,
          customer_name: decryptData(rawData.customer_name).trim(),
          whatsapp_number: decryptData(rawData.whatsapp_number).trim(),
          location: decryptData(rawData.location).trim(),
          product_details: decryptData(rawData.product_details).trim(),
          product_name: rawData.product_name || '',
          created_at: rawData.created_at?.toDate?.()?.toISOString() || rawData.created_at || new Date().toISOString()
        };
      }) as Order[];
      setOrders(ordersList);
      Storage.setLarge('users_orders_cache', ordersList);
    });

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, []);

  // Compute combined profile list whenever data changes (Optimized merged view)
  const combinedUserProfiles = React.useMemo(() => {
    const processedUsers: any[] = [...users];
    const uniqueOrderWhatsapps = Array.from(new Set(orders.map(o => o.whatsapp_number).filter(Boolean)));

    uniqueOrderWhatsapps.forEach(p => {
      const phone = String(p || '');
      const phoneOrders = orders.filter(o => o.whatsapp_number === phone);
      const completedOrders = phoneOrders.filter(o => o.status === 'completed');
      const totalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
      
      const latestOrder = phoneOrders[0];
      const latestName = latestOrder?.customer_name || '';
      const latestLoc = latestOrder?.location || '';
      const earliestDate = phoneOrders[phoneOrders.length - 1]?.created_at || new Date().toISOString();

      const matchingRegIdx = processedUsers.findIndex(u => u.whatsapp_number === phone);

      if (matchingRegIdx !== -1) {
        const regUser = processedUsers[matchingRegIdx];
        if (!regUser.name || regUser.name === 'Anonymous User' || regUser.name === 'Anonymous' || regUser.name === '') {
          regUser.name = latestName || ('Customer (' + phone.slice(-4) + ')');
        }
        if (!regUser.location || regUser.location === 'N/A' || regUser.location === '') {
          regUser.location = latestLoc || 'N/A';
        }
        regUser.total_orders = phoneOrders.length;
        regUser.total_spent = totalSpent;
      } else if (phone) {
        processedUsers.push({
          id: `guest-${phone.replace(/[^a-zA-Z0-9]/g, '') || Math.random().toString(36).substring(4)}`,
          name: latestName || 'Customer (' + phone.slice(-4) + ')',
          whatsapp_number: phone,
          location: latestLoc || 'N/A',
          email: 'N/A',
          total_orders: phoneOrders.length,
          total_spent: totalSpent,
          wallet_balance: Math.round(totalSpent * 0.10),
          created_at: earliestDate,
          isGuest: true
        });
      }
    });

    return processedUsers.map(u => {
      let cleanName = u.name;
      if (!cleanName || cleanName === 'Anonymous User' || cleanName === 'Anonymous' || cleanName === 'N/A') {
         const matchingOrder = orders.find(o => o.whatsapp_number === u.whatsapp_number);
         cleanName = matchingOrder?.customer_name || 'Customer (' + (u.whatsapp_number || '').slice(-4) + ')';
      }
      return { ...u, name: cleanName };
    }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [users, orders]);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const id = userToDelete;
    setUserToDelete(null);
    setDeletingId(id);
    try {
      // Hide the profile instead of actual deletion as requested
      await updateDoc(doc(db, 'users', id), {
        is_hidden: true,
        hidden_at: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const viewUserOrders = (user: User) => {
    setSelectedUser(user);
    setLoadingOrders(true);
    
    // We try to find orders by user_id OR by whatsapp_number (legacy or non-registered orders)
    const q = query(
      collection(db, 'orders'), 
      where('whatsapp_number', '==', user.whatsapp_number),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as Order[];
      setUserOrders(orders);
      setLoadingOrders(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoadingOrders(false);
    });

    return unsubscribe;
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Customer Profiles">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setIsTableView(false)}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              !isTableView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Grid
          </button>
          <button
            onClick={() => setIsTableView(true)}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              isTableView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Table
          </button>
        </div>
      </Header>

      <main className="p-4 md:p-8">


        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : isTableView ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Orders</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {combinedUserProfiles.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase shrink-0">
                            {user.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate uppercase tracking-tight">{user.name}</p>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest",
                              user.isGuest ? "text-amber-500" : "text-emerald-500"
                            )}>
                              {user.isGuest ? 'Guest' : 'Member'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Phone className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-mono text-sm font-bold text-slate-700">{user.whatsapp_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[200px]">{user.location || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
                          <span className="font-black text-xs">৳</span>
                          <span className="font-bold text-xs">{formatCurrency(user.wallet_balance || 0).replace('৳', '')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] border border-slate-200">
                          {user.total_orders || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewUserOrders(user)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200"
                            title="View History"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          {!user.isGuest && (
                            <button
                              onClick={() => {
                                setSelectedUserForBalance(user);
                                setNewBalanceValue(String(user.wallet_balance || 0));
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200"
                              title="Adjust Wallet"
                            >
                              <Coins className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {combinedUserProfiles.map((user) => (
              <div 
                key={user.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-2xl uppercase">
                      {user.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{user.name || 'Anonymous User'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("w-2 h-2 rounded-full animate-pulse", user.isGuest ? "bg-amber-500" : "bg-emerald-500")} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          {user.isGuest ? 'Guest Customer' : 'Registered Customer'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!user.isGuest && (
                    <button
                      onClick={() => setUserToDelete(user.id)}
                      className="p-2 text-slate-400 md:text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-bold text-sm truncate text-slate-900">{user.whatsapp_number}</p>
                          <button
                            onClick={() => handleCopy(user.id, user.whatsapp_number)}
                            className="p-1 text-slate-400 hover:text-brand hover:bg-slate-100 rounded transition-all cursor-pointer shrink-0"
                            title="Copy Number"
                          >
                            {copiedId === user.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {user.whatsapp_number && (
                            <a
                              href={`https://wa.me/${user.whatsapp_number.replace(/[^0-9]/g, '').startsWith('01') ? '88' + user.whatsapp_number.replace(/[^0-9]/g, '') : user.whatsapp_number.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-all flex items-center justify-center cursor-pointer shrink-0"
                              title="Open WhatsApp Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-brand shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Primary Location</p>
                        <p className="font-bold text-sm leading-tight line-clamp-2">{user.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-brand shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                        <p className="font-bold text-sm truncate">{user.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-brand/5 flex items-center justify-center text-brand shrink-0">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-brand uppercase tracking-widest">Order Count</p>
                        <p className="font-black text-slate-900 text-sm">{user.total_orders || 0} Transactions</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings Wallet & Money Pulse */}
                <div className="mt-6 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/60 flex items-center justify-between group-hover:bg-emerald-50/80 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                      <span className="font-black text-lg">৳</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em]">{user.isGuest ? 'Cashback Wallet' : 'Savings Wallet'}</p>
                      <p className="text-base font-black text-slate-900 leading-none mt-0.5">{formatCurrency(user.wallet_balance || 0)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Spent</p>
                    <p className="text-xs font-black text-slate-700 mt-0.5">{formatCurrency(user.total_spent || 0)}</p>
                  </div>
                </div>

                {/* Purchased Items Detail Frame */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-[9px] font-black text-slate-450 uppercase tracking-[0.12em] mb-2.5 flex items-center gap-1.5 font-mono">
                    <Package className="w-3.5 h-3.5 text-slate-450 shrink-0" /> Recent Bought Items
                  </p>
                  {orders.filter(o => o.whatsapp_number === user.whatsapp_number).length > 0 ? (
                    <div className="space-y-2">
                      {orders
                        .filter(o => o.whatsapp_number === user.whatsapp_number)
                        .slice(0, 2)
                        .map((order) => (
                          <div 
                            key={order.id} 
                            className="bg-slate-50 border border-slate-100 hover:border-slate-200 p-3 rounded-xl flex items-center justify-between gap-4 transition-all duration-200"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-xs truncate">
                                {order.product_details || order.product_name || 'Direct product checkout'}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                                <span>{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-350" />
                                <span>Quantity: {order.quantity || 1}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">{formatCurrency(order.price)}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none border shrink-0",
                                order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                order.status === 'completed' ? 'bg-slate-900 text-white border-transparent' :
                                order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                'bg-indigo-50 text-indigo-700 border-indigo-100'
                              )}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      {orders.filter(o => o.whatsapp_number === user.whatsapp_number).length > 2 && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center pt-1 animate-pulse">
                          + {orders.filter(o => o.whatsapp_number === user.whatsapp_number).length - 2} more transaction entries in profile history
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-semibold italic pl-1">No historical purchases logged for this contact.</p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => viewUserOrders(user)}
                      className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest hover:bg-brand/5 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-brand/10 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      History
                    </button>
                    {!user.isGuest && (
                      <button
                        onClick={() => {
                          setSelectedUserForBalance(user);
                          setNewBalanceValue(String(user.wallet_balance || 0));
                        }}
                        className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-emerald-100 cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        Adjust Balance
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                       Joined {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>

                {deletingId === user.id && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10 transition-all">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  </div>
                )}
              </div>
            ))}

            {combinedUserProfiles.length === 0 && (
              <div className="col-span-full p-16 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">No Customers Found</p>
                <p className="text-sm font-medium mt-1">Detailed customer profiles will appear here as they interact with the platform.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        isOpen={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        title={`History: ${selectedUser?.name}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {loadingOrders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          ) : userOrders.length > 0 ? (
            userOrders.map((order) => (
              <div key={order.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Order ID: {order.id.slice(0, 8)}</span>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'completed' ? 'bg-slate-900 text-white' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-brand/10 text-brand'
                  )}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{order.product_name || order.product_details}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {format(new Date(order.created_at), 'MMM dd, yyyy - p')}
                    </p>
                  </div>
                  <p className="font-black text-slate-900 text-sm">{formatCurrency(order.price)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-sm">No transaction records found</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        title="Hide Customer Profile?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you sure you want to hide this customer's profile? The user will no longer appear in the directory list, but their historical order data will remain in the database.
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmDeleteUser}
              className="flex-1 py-4 bg-slate-900 hover:bg-black active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 cursor-pointer"
            >
              Hide Profile
            </button>
            <button
              onClick={() => setUserToDelete(null)}
              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={selectedUserForBalance !== null}
        onClose={() => setSelectedUserForBalance(null)}
        title={`Adjust Wallet: ${selectedUserForBalance?.name}`}
      >
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 rounded-2xl flex items-center justify-between border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest font-mono">Current Balance</p>
            <p className="text-xl font-black text-emerald-800">{formatCurrency(selectedUserForBalance?.wallet_balance || 0)}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">New Wallet Balance Amount (৳)</label>
            <input 
              type="number"
              placeholder="Enter taka amount..."
              value={newBalanceValue}
              onChange={(e) => setNewBalanceValue(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand font-black text-slate-800 text-sm shadow-inner bg-slate-50"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={confirmAdjustBalance}
              disabled={updatingBalance}
              className="flex-1 py-4 bg-slate-900 hover:bg-black active:scale-98 disabled:opacity-50 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 cursor-pointer flex items-center justify-center gap-2"
            >
              {updatingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Adjustment'}
            </button>
            <button
              onClick={() => setSelectedUserForBalance(null)}
              disabled={updatingBalance}
              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
