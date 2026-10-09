import React, { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, Scale, Clock, 
  Package, Truck, MessageSquare, CheckCircle2, ChevronRight, 
  FileText, ExternalLink 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SellerPoliciesProps {
  isOpen?: boolean;
  onClose?: () => void;
  isStandalonePage?: boolean;
}

export default function SellerPoliciesModal({ isOpen = true, onClose, isStandalonePage = false }: SellerPoliciesProps) {
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    return localStorage.getItem('pbazar_seller_policy_acknowledged') === 'true';
  });

  const handleAcknowledge = () => {
    localStorage.setItem('pbazar_seller_policy_acknowledged', 'true');
    setHasAcknowledged(true);
    if (onClose) onClose();
  };

  const content = (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-blue-200">Official Vendor Code</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
            🛡️ pbazar Seller Dashboard: Terms & Policies
          </h1>
          <p className="text-xs text-blue-100/90 font-medium leading-relaxed max-w-2xl">
            Welcome to pbazar. To maintain a trusted marketplace for all buyers and sellers, every vendor must strictly adhere to our operational rules and code of conduct.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-3 py-1.5 rounded-full">
            Mandatory Compliance
          </span>
          <span className="text-[9px] text-blue-200/80 font-bold">Updated October 2026</span>
        </div>
      </div>

      {/* Section 1: Zero-Tolerance Anti-Scam Policy */}
      <div className="bg-rose-50/60 border-2 border-rose-200 rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-rose-950 uppercase tracking-tight">
              Zero-Tolerance Anti-Scam Policy (Strict Enforcement)
            </h2>
            <p className="text-xs text-rose-700 font-bold uppercase tracking-wider">Immediate disciplinary action upon violation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-1.5">
            <h3 className="text-xs font-black text-rose-900 uppercase">No Counterfeit or Fake Products</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Selling replicas, knock-offs, or counterfeit items disguised as authentic brands is strictly prohibited.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-1.5">
            <h3 className="text-xs font-black text-rose-900 uppercase">Misleading Listings</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Product descriptions, images, and specifications must match the exact item delivered. Intentional deception or bait-and-switch tactics are classified as scams.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-1.5">
            <h3 className="text-xs font-black text-rose-900 uppercase">Instant License Revocation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Any seller found engaging in fraudulent activities, scamming customers, or failing to deliver paid orders will have their seller license permanently revoked immediately, with pending payouts frozen for investigation.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Product Listing & Quality Standards */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E5EF3] text-white flex items-center justify-center font-black">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Product Listing & Quality Standards
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Authenticity and ethical pricing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Accurate Descriptions</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Clearly state the condition of the item (New, Refurbished, Used) and highlight any potential defects.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Fair Pricing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Avoid artificial price gouging, hidden fees, or deceptive discounting practices.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Prohibited Items</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Illegal goods, hazardous materials, weapons, adult content, and restricted substances are strictly banned from being listed on pbazar.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Inventory & Order Fulfillment */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Inventory & Order Fulfillment
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Reliable dispatch timeframes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Real-Time Stock Updates</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sellers must keep their inventory updated to prevent out-of-stock orders. Repeatedly canceling orders due to stock unavailability will lower seller ratings.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Timely Dispatch</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Orders must be packed securely and handed over to shipping partners within the designated processing window (typically 24–48 hours).
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Tracking Information</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Valid tracking numbers must be updated promptly on the dashboard so buyers can monitor their deliveries.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Customer Support & Dispute Resolution */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Customer Support & Dispute Resolution
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Professional communications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Professional Communication</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sellers must maintain polite and respectful communication with customers through the platform.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Return & Refund Compliance</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sellers must respect pbazar's return policy for defective, damaged, or incorrect items.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase">Dispute Response Time</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sellers are required to respond to customer complaints or admin inquiries within 24 hours.
            </p>
          </div>
        </div>
      </div>

      {/* Acknowledgment Footer */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-black uppercase">Vendor Policy Acceptance</p>
            <p className="text-xs text-slate-300">
              {hasAcknowledged ? 'You have formally acknowledged and agreed to these terms.' : 'All registered pbazar partners must confirm compliance.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleAcknowledge}
          className={cn(
            "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shrink-0",
            hasAcknowledged ? "bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400" : "bg-[#1E5EF3] text-white hover:bg-blue-600"
          )}
        >
          {hasAcknowledged ? 'Agreed & Certified' : 'I Agree & Accept Terms'}
        </button>
      </div>
    </div>
  );

  if (isStandalonePage) {
    return (
      <div className="flex-1 bg-slate-50/50 p-4 md:p-8">
        {content}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 rounded-xl transition-all"
        >
          ✕
        </button>
        {content}
      </div>
    </div>
  );
}
