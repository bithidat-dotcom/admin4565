import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Bell, ShieldAlert, CheckCircle, Clock, ShoppingBag, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import LoadingDots from './LoadingDots';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'stock' | 'system' | 'review';
  created_at: string;
  is_read: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate a set of realistic notifications for instant interaction
    const demoNotifications: AppNotification[] = [
      {
        id: '1',
        title: 'New Restaurant Order Received',
        body: 'Zayn Malik placed a new order #FB940A for "Crispy Double Chicken Burger".',
        type: 'order',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        is_read: false
      },
      {
        id: '2',
        title: 'Stock Warning threshold breached',
        body: 'Product "Premium Leather Smart Wallet" stock is down to 2 units.',
        type: 'stock',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        is_read: false
      },
      {
        id: '3',
        title: 'System Backup Success',
        body: 'All Firestore document tables and assets backed up securely to persistent container mirrors.',
        type: 'system',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        is_read: true
      }
    ];

    setNotifications(demoNotifications);
    setLoading(false);
  }, []);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-5.5 h-5.5 text-[#1E5EF3] animate-swing" />
            Alerts & Live Broadcast Notifications
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Live background status listeners and threshold breaches</p>
        </div>

        <button 
          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
        >
          Mark All As Read
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => (
            <div 
              key={n.id}
              onClick={() => handleMarkAsRead(n.id)}
              className={cn(
                "p-5 rounded-2xl border flex items-start justify-between gap-4 cursor-pointer transition-all bg-white",
                n.is_read ? "border-slate-200/60 opacity-80" : "border-l-4 border-l-[#1E5EF3] border-slate-200/60 shadow-sm"
              )}
            >
              <div className="flex items-start gap-3.5">
                <div className={cn(
                  "p-2.5 rounded-xl shrink-0",
                  n.type === 'order' && "bg-blue-50 text-[#1E5EF3]" ||
                    n.type === 'stock' && "bg-amber-50 text-amber-600" ||
                    "bg-emerald-50 text-emerald-600"
                )}>
                  {n.type === 'stock' ? <ShieldAlert className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    {n.title}
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#1E5EF3] inline-block animate-pulse" />}
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">{n.body}</p>
                  
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNotification(n.id);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="border border-dashed border-slate-200 rounded-3xl p-16 text-center bg-white flex flex-col items-center justify-center">
              <Bell className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Notification Inbox Clear</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">We will broadcast here when any low-stock alerts or live orders are triggered.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
