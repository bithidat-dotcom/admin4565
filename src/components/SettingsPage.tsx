import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, Save, ToggleLeft, ToggleRight, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  const [coupon, setCoupon] = useState({ isActive: false, minPurchase: 0, discountAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchCoupon() {
      const docRef = doc(db, 'settings', 'coupon');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCoupon(docSnap.data() as any);
      }
      setLoading(false);
    }
    fetchCoupon();
  }, []);

  async function handleUpdate() {
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'coupon');
      await setDoc(docRef, coupon, { merge: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-brand animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-8">Coupon Management</h1>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Activate Coupons</span>
            <button onClick={() => setCoupon({...coupon, isActive: !coupon.isActive})}>
                {coupon.isActive ? <ToggleRight className="w-10 h-10 text-brand" /> : <ToggleLeft className="w-10 h-10 text-slate-300" />}
            </button>
        </div>

        <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Minimum Purchase</label>
            <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <input type="number" value={coupon.minPurchase} onChange={e => setCoupon({...coupon, minPurchase: Number(e.target.value)})} className="bg-transparent flex-1 outline-none text-sm font-bold" />
            </div>
        </div>

        <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Discount Amount</label>
            <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <input type="number" value={coupon.discountAmount} onChange={e => setCoupon({...coupon, discountAmount: Number(e.target.value)})} className="bg-transparent flex-1 outline-none text-sm font-bold" />
            </div>
        </div>

        <button onClick={handleUpdate} disabled={saving} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>
      </div>
    </div>
  );
}
