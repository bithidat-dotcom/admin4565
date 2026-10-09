import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Product, Seller, Order, ScamAlert } from '../types';
import LoadingDots from './LoadingDots';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, 
  Trash2, Ban, Lock, Unlock, CheckCircle, Search, 
  Store, Package, ExternalLink, RefreshCw, Eye 
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

export default function ScamCatcherPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'high' | 'seller' | 'product'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubSellers = onSnapshot(collection(db, 'sellers'), (snap) => {
      setSellers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Seller[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sellers'));

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubSellers();
      unsubOrders();
    };
  }, []);

  // Heuristic Anti-Scam Detection Engine
  const detectScams = (): ScamAlert[] => {
    const alerts: ScamAlert[] = [];

    // 1. Scan Products for counterfeit, bait & switch, unrealistic pricing
    products.forEach(p => {
      const reasons: string[] = [];
      let score = 0;

      const pName = (p.name || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();
      const price = Number(p.price) || 0;
      const discount = Number(p.discount) || 0;

      // Rule A: Counterfeit keywords
      const counterfeitKeywords = ['replica', 'clone', 'master copy', 'first copy', 'fake', 'duplicate', '1:1 copy'];
      const matchedKw = counterfeitKeywords.filter(kw => pName.includes(kw) || pDesc.includes(kw));
      if (matchedKw.length > 0) {
        reasons.push(`Counterfeit brand keywords detected: "${matchedKw.join(', ')}"`);
        score += 45;
      }

      // Rule B: Unrealistic Discount (Bait-and-Switch)
      if (discount >= 85) {
        reasons.push(`Abnormal ${discount}% discount indicates deceptive pricing or bait-and-switch`);
        score += 40;
      } else if (discount >= 70 && price > 5000) {
        reasons.push(`High ${discount}% discount on high-ticket item`);
        score += 20;
      }

      // Rule C: Unrealistic pricing for premium categories
      const isTech = pName.includes('iphone') || pName.includes('macbook') || pName.includes('galaxy s') || pName.includes('laptop');
      if (isTech && price < 3000 && price > 0) {
        reasons.push(`Suspiciously low price (৳${price.toLocaleString()}) for premium electronics`);
        score += 50;
      }

      // Rule D: Missing critical seller information
      if (!p.seller && !p.seller_id) {
        reasons.push('Phantom listing without identifiable vendor ID or contact info');
        score += 25;
      }

      // Rule E: No image or broken description
      if (!p.image || p.image.length < 5) {
        reasons.push('Listing missing authentic product imagery');
        score += 15;
      }

      if (score >= 25) {
        const riskLevel = score >= 50 ? 'critical' : score >= 35 ? 'high' : 'medium';
        alerts.push({
          id: `PROD-${p.id}`,
          type: 'product',
          target_id: p.id,
          target_name: p.name,
          seller_id: p.seller_id,
          seller_name: p.seller || 'Unassigned',
          risk_level: riskLevel,
          risk_score: score,
          reasons,
          detected_at: p.created_at || new Date().toISOString(),
          status: 'active',
          details: `Price: ৳${price.toLocaleString()} | Discount: ${discount}%`
        });
      }
    });

    // 2. Scan Sellers for high cancellations, unverified status with high orders
    sellers.forEach(s => {
      const reasons: string[] = [];
      let score = 0;

      const sName = (s.name || '').toLowerCase();
      const sId = (s.seller_id || s.id).toLowerCase();

      // Find all seller orders
      const sellerOrders = orders.filter(o => 
        (o.seller && o.seller.toLowerCase() === sName) ||
        (o.seller_id && o.seller_id.toLowerCase() === sId)
      );

      const totalOrders = sellerOrders.length;
      const cancelledOrders = sellerOrders.filter(o => o.status === 'cancelled').length;

      // Rule F: High cancellation rate
      if (totalOrders >= 4 && (cancelledOrders / totalOrders) >= 0.45) {
        const rate = Math.round((cancelledOrders / totalOrders) * 100);
        reasons.push(`Critical ${rate}% cancellation rate (${cancelledOrders}/${totalOrders} orders unfulfilled)`);
        score += 45;
      }

      // Rule G: Missing contact details
      if (!s.whatsapp_number || s.whatsapp_number.length < 9) {
        reasons.push('Vendor lacks valid WhatsApp phone number for customer dispute resolution');
        score += 30;
      }

      // Rule H: Unverified vendor with high transaction volume
      if (!s.is_verified && totalOrders > 15) {
        reasons.push('Unverified vendor operating high transaction volume without background verification');
        score += 25;
      }

      // Rule I: Check frozen status
      if (s.is_frozen) {
        reasons.push('Seller license currently frozen under investigation');
        score += 50;
      }

      if (score >= 25) {
        const riskLevel = score >= 50 ? 'critical' : score >= 35 ? 'high' : 'medium';
        alerts.push({
          id: `SELLER-${s.id}`,
          type: 'seller',
          target_id: s.id,
          target_name: s.name,
          seller_id: s.seller_id,
          seller_name: s.name,
          risk_level: riskLevel,
          risk_score: score,
          reasons,
          detected_at: s.created_at || new Date().toISOString(),
          status: s.is_frozen ? 'frozen' : 'active',
          details: `Total Orders: ${totalOrders} | Cancelled: ${cancelledOrders}`
        });
      }
    });

    return alerts.sort((a, b) => b.risk_score - a.risk_score);
  };

  const detectedScams = detectScams();

  const filteredScams = detectedScams.filter(alert => {
    if (filterType === 'critical' && alert.risk_level !== 'critical') return false;
    if (filterType === 'high' && alert.risk_level !== 'high') return false;
    if (filterType === 'product' && alert.type !== 'product') return false;
    if (filterType === 'seller' && alert.type !== 'seller') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        alert.target_name.toLowerCase().includes(q) ||
        (alert.seller_name && alert.seller_name.toLowerCase().includes(q)) ||
        alert.reasons.some(r => r.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Action: Freeze Seller License
  const handleFreezeSeller = async (sellerId: string, currentStatus: boolean) => {
    setActionLoadingId(sellerId);
    try {
      await updateDoc(doc(db, 'sellers', sellerId), {
        is_frozen: !currentStatus,
        is_verified: false
      });

      // Audit log to host server
      fetch('/api/scam_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentStatus ? 'UNFREEZE_SELLER' : 'FREEZE_SELLER',
          seller_id: sellerId,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

      alert(currentStatus ? 'Seller license restored.' : 'Seller license permanently frozen. Pending payouts locked.');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `sellers/${sellerId}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Delist / Remove Product
  const handleDelistProduct = async (productId: string) => {
    if (!window.confirm("Delist this scam product from pbazar catalog permanently?")) return;
    setActionLoadingId(productId);
    try {
      await deleteDoc(doc(db, 'products', productId));

      fetch('/api/scam_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELIST_PRODUCT',
          product_id: productId,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

      alert("Scam product delisted and purged from customer store.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const criticalCount = detectedScams.filter(a => a.risk_level === 'critical').length;
  const highCount = detectedScams.filter(a => a.risk_level === 'high').length;
  const productCount = detectedScams.filter(a => a.type === 'product').length;
  const sellerCount = detectedScams.filter(a => a.type === 'seller').length;

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header with Anti-Scam Shield Branding */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </span>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
              🛡️ pbazar Anti-Scam & Fraud Catcher Engine
            </h1>
          </div>
          <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mt-2 max-w-2xl">
            Zero-Tolerance Anti-Scam Enforcement: Real-time heuristic AI scanning for counterfeit goods, bait-and-switch discounts, high vendor cancellations, and unverified merchant fraud.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
            <p className="text-[10px] font-black uppercase text-rose-300 tracking-wider">Critical Threats</p>
            <p className="text-3xl font-black text-rose-400 mt-1">{criticalCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
            <p className="text-[10px] font-black uppercase text-amber-300 tracking-wider">High Risk Alerts</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{highCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
          {[
            { id: 'all', label: `All Alerts (${detectedScams.length})` },
            { id: 'critical', label: `Critical (${criticalCount})` },
            { id: 'high', label: `High Risk (${highCount})` },
            { id: 'product', label: `Products (${productCount})` },
            { id: 'seller', label: `Vendors (${sellerCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                filterType === tab.id ? "bg-[#1E5EF3] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search scam reasons, items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {/* Scam Cards Feed */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingDots /></div>
      ) : (
        <div className="space-y-4">
          {filteredScams.map((alert) => {
            const isCritical = alert.risk_level === 'critical';
            const isHigh = alert.risk_level === 'high';

            return (
              <div 
                key={alert.id}
                className={cn(
                  "bg-white rounded-2xl p-5 md:p-6 border transition-all shadow-sm",
                  isCritical ? "border-rose-300 ring-2 ring-rose-100" : isHigh ? "border-amber-300" : "border-slate-200"
                )}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                      isCritical ? "bg-rose-100 text-rose-600" : isHigh ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-[#1E5EF3]"
                    )}>
                      {alert.type === 'product' ? <Package className="w-6 h-6" /> : <Store className="w-6 h-6" />}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                          isCritical ? "bg-rose-600 text-white" : isHigh ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                        )}>
                          {alert.risk_level} Threat • Score {alert.risk_score}/100
                        </span>

                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Target: {alert.type.toUpperCase()}
                        </span>

                        {alert.status === 'frozen' && (
                          <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">
                            License Frozen
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mt-1">
                        {alert.target_name}
                      </h3>

                      {alert.details && (
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                          {alert.details} {alert.seller_name && `• Vendor: ${alert.seller_name}`}
                        </p>
                      )}

                      {/* Reasons Caught */}
                      <div className="mt-3 space-y-1.5">
                        {alert.reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Moderation Actions */}
                  <div className="flex flex-wrap md:flex-col items-center md:items-end gap-2 shrink-0">
                    {alert.type === 'seller' ? (
                      <button
                        disabled={actionLoadingId === alert.target_id}
                        onClick={() => handleFreezeSeller(alert.target_id, alert.status === 'frozen')}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer",
                          alert.status === 'frozen'
                            ? "bg-slate-900 hover:bg-slate-800 text-white"
                            : "bg-rose-600 hover:bg-rose-700 text-white"
                        )}
                      >
                        {alert.status === 'frozen' ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        <span>{alert.status === 'frozen' ? 'Restore License' : 'Revoke License & Freeze'}</span>
                      </button>
                    ) : (
                      <button
                        disabled={actionLoadingId === alert.target_id}
                        onClick={() => handleDelistProduct(alert.target_id)}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delist & Remove Item</span>
                      </button>
                    )}

                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      Detected: {new Date(alert.detected_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredScams.length === 0 && (
            <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
              <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto" />
              <h3 className="text-base font-black text-slate-900 uppercase">Marketplace Status: Clean & Protected</h3>
              <p className="text-xs text-slate-500 font-bold max-w-md mx-auto">
                No active scam or counterfeit threats matching your query. All vendor items comply with pbazar standards.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
