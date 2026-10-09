import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { Product } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Search, Sparkles, TrendingUp, TrendingDown, ArrowUp, ArrowDown, 
  Trash2, Flame, Award, Globe, Eye, BarChart3, CheckCircle2, 
  AlertCircle, Edit3, Save, X, ExternalLink, Zap 
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

export default function ProductSeoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditingSeo, setIsEditingSeo] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // SEO Form State
  const [seoForm, setSeoForm] = useState({
    meta_title: '',
    meta_description: '',
    keywords: '',
    slug: '',
    discount: 0
  });

  useEffect(() => {
    if (isQuotaExceeded()) return;

    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      // Sort by rank_order or sales
      data.sort((a, b) => (a.rank_order ?? 999) - (b.rank_order ?? 999));
      setProducts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openSeoEditor = (p: Product) => {
    setSelectedProduct(p);
    setSeoForm({
      meta_title: p.meta_title || `${p.name} - Best Price Online in Bangladesh | pbazar`,
      meta_description: p.meta_description || p.description?.slice(0, 150) || `Buy ${p.name} at best discount price on pbazar. Fast home delivery and 100% authentic quality.`,
      keywords: (p.keywords || [p.name, p.category || 'eCommerce', 'pbazar', 'best price bd']).join(', '),
      slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      discount: p.discount || 0
    });
    setIsEditingSeo(true);
  };

  const handleSaveSeo = async () => {
    if (!selectedProduct) return;
    setSavingId(selectedProduct.id);
    try {
      const kwArray = seoForm.keywords.split(',').map(k => k.trim()).filter(Boolean);
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        meta_title: seoForm.meta_title,
        meta_description: seoForm.meta_description,
        keywords: kwArray,
        slug: seoForm.slug,
        discount: Number(seoForm.discount) || 0,
        seo_score: calculateSeoScore(seoForm.meta_title, seoForm.meta_description, kwArray)
      });
      setIsEditingSeo(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${selectedProduct.id}`);
    } finally {
      setSavingId(null);
    }
  };

  // Promotion / Demotion Actions
  const handleToggleSuperSale = async (p: Product) => {
    setSavingId(p.id);
    try {
      const nextSuperSale = !p.is_super_sale;
      await updateDoc(doc(db, 'products', p.id), {
        is_super_sale: nextSuperSale,
        is_demoted: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDemoteProduct = async (p: Product) => {
    setSavingId(p.id);
    try {
      await updateDoc(doc(db, 'products', p.id), {
        is_super_sale: false,
        is_demoted: true,
        rank_order: (p.rank_order || 0) + 100
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleReorder = async (p: Product, direction: 'up' | 'down') => {
    const currentRank = p.rank_order ?? 50;
    const newRank = direction === 'up' ? Math.max(1, currentRank - 5) : currentRank + 5;
    try {
      await updateDoc(doc(db, 'products', p.id), {
        rank_order: newRank
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Permanently delete this product from pbazar?")) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  // SEO Score Calculator
  const calculateSeoScore = (title: string, desc: string, kws: string[]): number => {
    let score = 0;
    if (title.length >= 30 && title.length <= 60) score += 35;
    else if (title.length > 15) score += 20;

    if (desc.length >= 100 && desc.length <= 160) score += 35;
    else if (desc.length > 50) score += 20;

    if (kws.length >= 3) score += 20;
    if (kws.length >= 5) score += 10;
    return Math.min(100, score);
  };

  // Future Sales Forecast Algorithm
  const predictFutureSales = (p: Product) => {
    const sold = p.sold || 0;
    const clicks = p.clicks || Math.max(12, sold * 4);
    const price = Number(p.price) || 0;
    const discount = Number(p.discount) || 0;
    const stock = Number(p.stock !== undefined ? p.stock : (p.quantity || 10));

    // Base conversion rate estimate (~4-8% average in ecommerce, boosted by discount)
    const baseConversionRate = Math.min(0.18, 0.04 + (discount / 100) * 0.12);
    const estimatedDailyClicks = Math.max(2, Math.round(clicks / 14));
    
    // 30 days projected units
    const projectedUnitsRaw = Math.round(estimatedDailyClicks * 30 * baseConversionRate);
    const projectedUnits = Math.min(stock > 0 ? stock : 50, Math.max(1, projectedUnitsRaw));
    const projectedRevenue = projectedUnits * (price * (1 - discount / 100));

    let momentum: 'Viral / Hot Deal' | 'High Sales Momentum' | 'Moderate Velocity' | 'Needs Promotion' = 'Moderate Velocity';
    if (p.is_super_sale || discount >= 30) momentum = 'Viral / Hot Deal';
    else if (projectedUnits > 25) momentum = 'High Sales Momentum';
    else if (projectedUnits < 8) momentum = 'Needs Promotion';

    return {
      projectedUnits,
      projectedRevenue,
      momentum,
      conversionRate: Math.round(baseConversionRate * 100),
      recommendation: discount < 15 
        ? "Offer a 15% limited-time flash discount to increase CTR by ~35%."
        : stock < 10
        ? "Restock inventory immediately to prevent out-of-stock bounce rates."
        : "Promote to Super Sale to double homepage placement impression."
    };
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.seller && p.seller.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Search className="w-6 h-6 text-[#1E5EF3]" />
              Product SEO & Future Sales Intelligence
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Manage search visibility, promote to Hot Deal/Super Sale, reorder layout ranking, and forecast future revenue
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog SEO..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((p) => {
            const forecast = predictFutureSales(p);
            const seoScore = p.seo_score ?? calculateSeoScore(p.meta_title || p.name, p.meta_description || p.description || '', p.keywords || []);
            const isSuper = p.is_super_sale;

            return (
              <div 
                key={p.id}
                className={cn(
                  "bg-white rounded-3xl p-5 md:p-6 border transition-all shadow-sm space-y-5",
                  isSuper ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200/80"
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Product Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <img 
                      src={p.image || 'https://i.postimg.cc/KvqR53hq/download-(1).png'} 
                      alt={p.name} 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-50"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSuper && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-slate-950" />
                            Hot Deal / Super Sale
                          </span>
                        )}
                        {p.is_demoted && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-500">
                            Demoted
                          </span>
                        )}
                        <span className="text-[10px] font-black uppercase text-[#1E5EF3] bg-blue-50 px-2 py-0.5 rounded">
                          Rank Priority #{p.rank_order ?? 50}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          Vendor: {p.seller || 'pbazar Official'}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mt-1 truncate">
                        {p.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 mt-1">
                        <span className="font-black text-slate-900 text-sm">৳{p.price.toLocaleString()}</span>
                        {p.discount > 0 && <span className="text-rose-600 font-black">{p.discount}% OFF</span>}
                        <span>Stock: <strong className="text-slate-900">{p.stock ?? p.quantity ?? 0}</strong></span>
                        <span>Sold: <strong className="text-emerald-600">{p.sold ?? 0} units</strong></span>
                        <span className="text-[11px] text-slate-400 font-mono">ID: {p.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Future Sales Prediction Card ("Future Sells Kamon Hobe") */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 shrink-0 w-full lg:w-72 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#1E5EF3]" />
                        Future Sales Forecast
                      </span>
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                        forecast.momentum.includes('Viral') ? "bg-amber-100 text-amber-900 font-black" : "bg-blue-100 text-[#1E5EF3]"
                      )}>
                        {forecast.momentum}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-900">~{forecast.projectedUnits} units</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Next 30 Days Est.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(forecast.projectedRevenue)}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Est. Revenue</p>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-500 font-medium italic border-t border-slate-200/50 pt-1.5">
                      💡 {forecast.recommendation}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Strip & SEO Score */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  {/* SEO Health Indicator */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-[#1E5EF3]" />
                      <span className="text-xs font-black uppercase text-slate-700">SEO Score:</span>
                      <span className={cn(
                        "text-xs font-black px-2 py-0.5 rounded-md",
                        seoScore >= 80 ? "bg-emerald-100 text-emerald-800" : seoScore >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                      )}>
                        {seoScore}% {seoScore >= 80 ? 'Optimized' : 'Needs Optimization'}
                      </span>
                    </div>

                    {p.slug && (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        /products/{p.slug}
                      </span>
                    )}
                  </div>

                  {/* Actions: Promote / Demote / Reorder / SEO / Remove */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Promote to Super Sale / Hot Deal */}
                    <button
                      onClick={() => handleToggleSuperSale(p)}
                      disabled={savingId === p.id}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95",
                        isSuper 
                          ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200" 
                          : "bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                      )}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{isSuper ? 'In Super Sale' : 'Promote to Hot Deal'}</span>
                    </button>

                    {/* Demote Button */}
                    <button
                      onClick={() => handleDemoteProduct(p)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                      title="Demote priority ranking"
                    >
                      Demote
                    </button>

                    {/* Reorder Ranking */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      <button
                        onClick={() => handleReorder(p, 'up')}
                        className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
                        title="Move Ranking Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReorder(p, 'down')}
                        className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
                        title="Move Ranking Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit SEO Meta */}
                    <button
                      onClick={() => openSeoEditor(p)}
                      className="px-3.5 py-2 bg-[#1E5EF3] hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit SEO Tags</span>
                    </button>

                    {/* Remove Product */}
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
                      title="Remove Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center text-slate-400 font-bold uppercase text-xs">
              No products found matching active SEO search.
            </div>
          )}
        </div>
      )}

      {/* SEO Edit Modal */}
      {isEditingSeo && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 text-[#1E5EF3]" />
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Search Engine Optimization (SEO)</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase">{selectedProduct.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditingSeo(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Meta Title */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Meta Title (Recommended 30-60 chars)</span>
                  <span className={cn(seoForm.meta_title.length > 60 ? "text-rose-500 font-black" : "text-slate-400")}>
                    {seoForm.meta_title.length}/60 chars
                  </span>
                </div>
                <input
                  type="text"
                  value={seoForm.meta_title}
                  onChange={e => setSeoForm({ ...seoForm, meta_title: e.target.value })}
                  placeholder="e.g. Premium Wireless Earbuds - pbazar Official"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E5EF3]"
                />
              </div>

              {/* Meta Description */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Meta Description (Recommended 120-160 chars)</span>
                  <span className={cn(seoForm.meta_description.length > 160 ? "text-rose-500 font-black" : "text-slate-400")}>
                    {seoForm.meta_description.length}/160 chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={seoForm.meta_description}
                  onChange={e => setSeoForm({ ...seoForm, meta_description: e.target.value })}
                  placeholder="Summarize product value proposition and call to action..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E5EF3]"
                />
              </div>

              {/* Keywords */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">Target Search Keywords (Comma-separated)</span>
                <input
                  type="text"
                  value={seoForm.keywords}
                  onChange={e => setSeoForm({ ...seoForm, keywords: e.target.value })}
                  placeholder="wireless earbuds, bluetooth earphones, audio gadgets bd"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E5EF3]"
                />
              </div>

              {/* URL Slug */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">URL Slug</span>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500">
                  <span className="text-slate-400 shrink-0">pbazar-bd.com/product/</span>
                  <input
                    type="text"
                    value={seoForm.slug}
                    onChange={e => setSeoForm({ ...seoForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full bg-transparent border-none outline-none font-bold text-slate-900 ml-1"
                  />
                </div>
              </div>

              {/* Google Search Live SERP Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Google Search Snippet Preview</span>
                <p className="text-xs text-blue-700 font-bold truncate hover:underline cursor-pointer">
                  {seoForm.meta_title || selectedProduct.name}
                </p>
                <p className="text-[10px] text-emerald-700 font-mono">
                  https://pbazar-bd.com/product/{seoForm.slug || 'item'}
                </p>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {seoForm.meta_description || selectedProduct.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEditingSeo(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSeo}
                disabled={savingId === selectedProduct.id}
                className="px-6 py-2.5 bg-[#1E5EF3] hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>Save SEO Metadata</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
