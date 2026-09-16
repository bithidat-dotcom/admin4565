import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { User } from '../types';
import LoadingDots from './LoadingDots';
import { Users, Search, Phone, Mail, MapPin, Wallet, ShoppingBag } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isQuotaExceeded()) return;

    const q = query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
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

    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.whatsapp_number.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCustomerAvatar = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const id = (hash % 70) + 1;
    return `https://i.pravatar.cc/150?img=${id}`;
  };

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5.5 h-5.5 text-[#1E5EF3]" />
            Customer Profiles & CRM
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Audit customer basket sizes, contact details, wallet balances and order history</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, phone, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4">Customer</th>
                  <th className="p-4">WhatsApp Phone</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Default Location</th>
                  <th className="p-4 text-center">Baskets Placed</th>
                  <th className="p-4 text-right">Total Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <img 
                        src={getCustomerAvatar(customer.name)} 
                        alt={customer.name} 
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                      />
                      <div>
                        <span className="text-slate-900 font-black uppercase text-xs block">{customer.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">ID: {customer.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-slate-900">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {customer.whatsapp_number}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {customer.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {customer.email}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No Email Linked</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      <span className="flex items-center gap-1 max-w-[200px] truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {customer.location}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-900 font-black">
                      {customer.total_orders || 0}
                    </td>
                    <td className="p-4 text-right text-[#1E5EF3] font-black">
                      {formatCurrency(customer.total_spent || 0)}
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest">
                      No active customer profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
