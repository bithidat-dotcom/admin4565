import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PromoOffer } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Tag, Percent, Plus, Trash2, Gift, Clock,
  ToggleLeft, ToggleRight, Loader2, Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import Modal from './Modal';
import BannersPage from './BannersPage';

export default function OffersPage() {
  const [activeTab, setActiveTab] = useState<'coupons' | 'banners'>('coupons');
  const [offers, setOffers] = useState<PromoOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed' | 'combo' | 'flash_sale'>('percentage');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    const q = query(collection(db, 'offers'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as PromoOffer[];
      setOffers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'offers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !discount) return;

    setSubmitting(true);
    try {
      const payload = {
        name,
        type,
        code: code.trim().toUpperCase() || null,
        description,
        discount: Number(discount),
        min_order: minOrder ? Number(minOrder) : 0,
        start_date: new Date().toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: isActive,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'offers'), payload);
      setIsModalOpen(false);
      
      // Clear form
      setName('');
      setCode('');
      setDescription('');
      setDiscount('');
      setMinOrder('');
      setEndDate('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'offers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this offer?")) return;
    try {
      await deleteDoc(doc(db, 'offers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `offers/${id}`);
    }
  };

  const handleToggleOffer = async (offer: PromoOffer) => {
    try {
      await updateDoc(doc(db, 'offers', offer.id), {
        is_active: !offer.is_active
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `offers/${offer.id}`);
    }
  };

  const handleSeedDemoOffers = async () => {
    setSubmitting(true);
    const demo = [
      {
        name: 'FLASHSALE30',
        type: 'percentage' as const,
        code: 'FLASH30',
        description: 'Get 30% off across all food orders! Minimum basket ৳500.',
        discount: 30,
        min_order: 500,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true
      },
      {
        name: 'WELCOME50',
        type: 'fixed' as const,
        code: 'PBAZAR50',
        description: '৳50 flat discount on your very first store item checkout!',
        discount: 50,
        min_order: 200,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true
      }
    ];

    try {
      for (const item of demo) {
        await addDoc(collection(db, 'offers'), {
          ...item,
          created_at: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-5.5 h-5.5 text-[#1E5EF3]" />
            Promotions & Banners
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configure active checkout codes and visual store banners</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('coupons')}
            className={cn(
              "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'coupons' 
                ? "bg-white text-[#1E5EF3] shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-3.5 h-3.5" />
              Coupons
            </div>
          </button>
          <button
            onClick={() => setActiveTab('banners')}
            className={cn(
              "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'banners' 
                ? "bg-white text-[#1E5EF3] shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5" />
              Store Banners
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'banners' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <BannersPage />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Active Discount Codes</h3>
            <div className="flex items-center gap-3">
              {offers.length === 0 && (
                <button
                  onClick={handleSeedDemoOffers}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-50 text-[#1E5EF3] border border-blue-100 hover:bg-[#1E5EF3] hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Seed Demo
                </button>
              )}
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-[#1E5EF3] hover:bg-[#1546be] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/10"
              >
                <Plus className="w-4 h-4" /> Create Coupon
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24"><LoadingDots /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offers.map(offer => {
                const hasExpired = new Date(offer.end_date) < new Date();
                return (
                  <div 
                    key={offer.id}
                    className={cn(
                      "bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm flex flex-col justify-between p-6 space-y-4",
                      !offer.is_active || hasExpired ? "opacity-65" : "hover:shadow-md transition-all"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-[#1E5EF3] rounded-xl shrink-0">
                          {offer.type === 'percentage' ? <Percent className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{offer.name}</h4>
                          {offer.code && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                              Code: {offer.code}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleOffer(offer)}
                          className={cn(
                            "p-1 rounded-lg transition-all",
                            offer.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                          )}
                        >
                          {offer.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{offer.description}</p>

                    <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-[10px] font-bold text-slate-600">
                      <div className="flex justify-between">
                        <span>Discount Value</span>
                        <span className="text-slate-900 font-black">
                          {offer.type === 'percentage' ? `${offer.discount}% OFF` : `৳${offer.discount} Flat`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Min Order Requirement</span>
                        <span className="text-slate-900 font-black">৳{offer.min_order || 0}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                          Expires: {new Date(offer.end_date).toLocaleDateString()}
                        </span>
                        {hasExpired && <span className="text-rose-500 font-bold uppercase tracking-widest">Expired</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {offers.length === 0 && (
                <div className="col-span-full border border-dashed border-slate-200 rounded-3xl p-16 text-center bg-white flex flex-col items-center justify-center">
                  <Gift className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">No Promotions Created</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Configure active discounts or seasonal percentage coupons to boost sales volume.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Offer Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Promo Offer">
        <form onSubmit={handleCreateOffer} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Offer Campaign Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Eid Mega Food Discount"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Offer Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="percentage">Percentage Discount (%)</option>
                <option value="fixed">Flat Cash Discount (৳)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coupon Code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. CAMPAIGN30"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Discount Value</label>
              <input
                type="number"
                required
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="20"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Order (৳)</label>
              <input
                type="number"
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                placeholder="500"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Description</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Give a clear explanation of coupon rules..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-5 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] bg-[#1E5EF3] hover:bg-[#1546be] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Offer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

