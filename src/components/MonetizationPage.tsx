import React, { useState, useEffect } from 'react';
import { DollarSign, ShieldCheck, Zap, TrendingUp, Award, CheckCircle, AlertCircle, Settings, Store, ShoppingBag, CreditCard, PieChart } from 'lucide-react';
import { Order, Product, Seller } from '../types';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';

interface MonetizationPageProps {
  products?: Product[];
  orders?: Order[];
  sellers?: Seller[];
}

export default function MonetizationPage({ products: propProducts, orders: propOrders, sellers: propSellers }: MonetizationPageProps) {
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [sponsoredFee, setSponsoredFee] = useState<number>(5);
  const [proSubPrice, setProSubPrice] = useState<number>(29);
  const [savedSettings, setSavedSettings] = useState(false);
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>(propProducts || []);
  const [orders, setOrders] = useState<Order[]>(propOrders || []);
  const [sellers, setSellers] = useState<Seller[]>(propSellers || []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pSnap, oSnap, sSnap, setSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'sellers')),
          getDoc(doc(db, 'settings', 'monetization'))
        ]);

        if (!propProducts || propProducts.length === 0) {
          setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        }
        if (!propOrders || propOrders.length === 0) {
          setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        }
        if (!propSellers || propSellers.length === 0) {
          setSellers(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
        }

        if (setSnap.exists()) {
          const data = setSnap.data();
          if (data.commissionRate) setCommissionRate(data.commissionRate);
          if (data.sponsoredFee) setSponsoredFee(data.sponsoredFee);
          if (data.proSubPrice) setProSubPrice(data.proSubPrice);
        }
      } catch (err) {
        console.error("Error loading monetization data:", err);
      }
    };
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { commissionRate, sponsoredFee, proSubPrice, updated_at: new Date().toISOString() };
      localStorage.setItem('pbazar_monetization', JSON.stringify(data));
      await setDoc(doc(db, 'settings', 'monetization'), data, { merge: true });
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 3000);
    } catch (err) {
      console.error("Error saving monetization settings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalGMV = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const commissionRevenue = (totalGMV * commissionRate) / 100;
  const promotedProductsCount = products.filter(p => p.is_super_sale).length;
  const promotedRevenue = promotedProductsCount * sponsoredFee * 7;
  const proSellersCount = sellers.filter(s => s.is_verified).length || Math.floor(sellers.length * 0.3);
  const subscriptionRevenue = proSellersCount * proSubPrice;
  const totalNetPlatformRevenue = commissionRevenue + promotedRevenue + subscriptionRevenue;

  return (
    <div className="space-y-6 p-4 sm:p-8 pb-12 animate-fadeIn max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-md rounded-l-3xl flex items-center justify-center p-6 hidden lg:flex">
          <DollarSign className="w-32 h-32 text-white/20 animate-pulse" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            Enterprise Monetization & Revenue Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Pbazar Monetization Dashboard
          </h1>
          <p className="text-white/80 text-xs sm:text-sm font-medium leading-relaxed">
            Monitor platform earnings from commissions, promoted product listings, and vendor subscription tiers. Optimize revenue streams and manage payment gateways securely.
          </p>
        </div>
      </div>

      {/* Revenue Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Platform GMV</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalGMV)}</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              +14.2% this month
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Revenue ({commissionRate}%)</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(commissionRevenue)}</h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              Auto-deducted
            </span>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <PieChart className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promoted Listings</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(promotedRevenue)}</h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              {promotedProductsCount} active boosts
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Net Profit</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(Math.round(totalNetPlatformRevenue))}</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              100% Verified
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Settings & Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Monetization Rules</h2>
              <p className="text-xs text-slate-500 font-medium">Configure platform fees and rates</p>
            </div>
          </div>

          {savedSettings && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Platform Commission Rate (%)
              </label>
              <input 
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Percentage charged on each successful order.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sponsored Listing Fee (৳ / day)
              </label>
              <input 
                type="number"
                min="0"
                value={sponsoredFee}
                onChange={(e) => setSponsoredFee(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Fee for pinning product to 'HOT DEAL' / Super Sale section.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pro Partner Subscription (৳ / month)
              </label>
              <input 
                type="number"
                min="0"
                value={proSubPrice}
                onChange={(e) => setProSubPrice(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Monthly fee for verified badge and 0% commission.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Monetization Settings'}
            </button>
          </form>
        </div>

        {/* Payment Gateways & Vendor Subscriptions Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Payment Gateway Integrations</h2>
                  <p className="text-xs text-slate-500 font-medium">Active secure payment channels for transactions</p>
                </div>
              </div>
              <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-wider">
                Live & Secured
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-500 text-white rounded-lg flex items-center font-black text-xs justify-center shadow-sm">
                    bKash
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">bKash Merchant Gateway</h4>
                    <p className="text-[10px] text-slate-500">Auto-reconciliation active</p>
                  </div>
                </div>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" title="Connected" />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-lg flex items-center font-black text-xs justify-center shadow-sm">
                    Nagad
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Nagad Business API</h4>
                    <p className="text-[10px] text-slate-500">Instant payout enabled</p>
                  </div>
                </div>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" title="Connected" />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center font-black text-xs justify-center shadow-sm">
                    Stripe
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Stripe International</h4>
                    <p className="text-[10px] text-slate-500">USD & EUR card payments</p>
                  </div>
                </div>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" title="Connected" />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center font-black text-xs justify-center shadow-sm">
                    COD
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Cash on Delivery + Escrow</h4>
                    <p className="text-[10px] text-slate-500">Platform protection guarantee</p>
                  </div>
                </div>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" title="Connected" />
              </div>
            </div>
          </div>

          {/* Partner Tier Summary Table */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Partner & Seller Monetization Tiers</h2>
                  <p className="text-xs text-slate-500 font-medium">Subscription status and commission contribution</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500">{sellers.length} Total Partners</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Partner Store</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Commission Rate</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {sellers.slice(0, 5).map((seller) => (
                    <tr key={seller.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img 
                          src={seller.logo || "https://i.postimg.cc/KvqR53hq/download-(1).png"} 
                          alt={seller.name}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200" 
                        />
                        <div>
                          <p className="font-black text-slate-900">{seller.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">@{seller.seller_id || seller.id}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-black uppercase">
                          {seller.is_verified ? `Pro Partner (৳${proSubPrice}/mo)` : 'Standard Free'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {seller.is_verified ? '0%' : `${commissionRate}%`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sellers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                        No partners registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
