import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, Save, ToggleLeft, ToggleRight, DollarSign, Image as ImageIcon } from 'lucide-react';
import { Banner } from '../types';

export default function SettingsPage() {
  const [coupon, setCoupon] = useState({ isActive: false, minPurchase: 0, discountAmount: 0 });
  const [banners, setBanners] = useState<Banner[]>([]);
  const [adSettings, setAdSettings] = useState({ isActive: false, bannerId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const couponDoc = await getDoc(doc(db, 'settings', 'coupon'));
      if (couponDoc.exists()) setCoupon(couponDoc.data() as any);
      
      const adDoc = await getDoc(doc(db, 'settings', 'adPopup'));
      if (adDoc.exists()) setAdSettings(adDoc.data() as any);

      const bannerSnap = await getDocs(collection(db, 'banners'));
      setBanners(bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));

      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleUpdate() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'coupon'), coupon, { merge: true });
      await setDoc(doc(db, 'settings', 'adPopup'), adSettings, { merge: true });
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
    <div className="p-8 max-w-2xl space-y-8">
      <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-8">Settings</h1>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Coupon Management</h2>
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
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Ad Popup Management</h2>
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Enable Popup</span>
            <button onClick={() => setAdSettings({...adSettings, isActive: !adSettings.isActive})}>
                {adSettings.isActive ? <ToggleRight className="w-10 h-10 text-brand" /> : <ToggleLeft className="w-10 h-10 text-slate-300" />}
            </button>
        </div>

        <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Banner for Ad</label>
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <select value={adSettings.bannerId} onChange={e => setAdSettings({...adSettings, bannerId: e.target.value})} className="bg-transparent w-full outline-none text-sm font-bold">
                    <option value="">Select a Banner</option>
                    {banners.map(banner => <option key={banner.id} value={banner.id}>{banner.title}</option>)}
                </select>
            </div>
        </div>
      </div>

      <button onClick={handleUpdate} disabled={saving} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'SAVING...' : 'SAVE ALL SETTINGS'}
        </button>
    </div>
  );
}
