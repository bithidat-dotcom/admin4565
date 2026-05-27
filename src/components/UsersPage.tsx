import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, where, updateDoc } from 'firebase/firestore';
import { User, Order, View } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { Users, Trash2, Loader2, Phone, MapPin, Mail, Calendar, Hash, ExternalLink, Package, Coins } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

interface UsersPageProps {
  onViewChange?: (view: View) => void;
}

export default function UsersPage({ onViewChange }: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

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
    const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as User[];
      
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const id = userToDelete;
    setUserToDelete(null);
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
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
      <Header title="Customer Profiles" />

      <main className="p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {users.map((user) => (
              <div 
                key={user.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-2xl">
                      {user.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{user.name || 'Anonymous User'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Registered Customer</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setUserToDelete(user.id)}
                    className="p-2 text-slate-400 md:text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-brand shrink-0">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                        <p className="font-bold text-sm truncate">{user.whatsapp_number}</p>
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
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em]">Savings Wallet</p>
                      <p className="text-base font-black text-slate-900 leading-none mt-0.5">{formatCurrency(user.wallet_balance || 0)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Spent</p>
                    <p className="text-xs font-black text-slate-700 mt-0.5">{formatCurrency(user.total_spent || 0)}</p>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => viewUserOrders(user)}
                      className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest hover:bg-brand/5 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-brand/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      History
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserForBalance(user);
                        setNewBalanceValue(String(user.wallet_balance || 0));
                      }}
                      className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-emerald-100"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Adjust Balance
                    </button>
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

            {users.length === 0 && (
              <div className="col-span-full p-16 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">No registered customers</p>
                <p className="text-sm font-medium mt-1">Customer profiles will appear here as they register on the platform.</p>
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
        title="Delete Customer Profile?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you sure you want to delete this customer's profile? All their transaction history metadata in this view will be detached. This action cannot be undone.
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmDeleteUser}
              className="flex-1 py-4 bg-slate-900 hover:bg-black active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 cursor-pointer"
            >
              Purge Profile
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
