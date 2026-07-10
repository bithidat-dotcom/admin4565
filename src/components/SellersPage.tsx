import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { Seller, Product, Order, Review } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { 
  Edit2, 
  Trash2, 
  Loader2, 
  Mail,
  Facebook,
  Instagram,
  Plus,
  Store,
  Phone,
  Image as ImageIcon,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Award,
  ShoppingBag,
  Boxes,
  Star,
  Grid,
  Table as TableIcon,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import { cn, formatCurrency } from '../lib/utils';
import { Storage } from '../lib/storage';

interface SellersPageProps {
  userSession?: any;
}

export default function SellersPage({ userSession }: SellersPageProps) {
  const isSeller = userSession?.role === 'seller';
  const currentSellerId = userSession?.sellerId || '';
  const isAdmin = userSession?.role === 'admin';

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  // Active dashboard analysis context
  const [selectedDashboardSeller, setSelectedDashboardSeller] = useState<Seller | null>(null);

  const [formData, setFormData] = useState({
    seller_id: '',
    name: '',
    logo: '',
    whatsapp_number: '',
    email: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    is_verified: false,
    rating: 5.0
  });

  useEffect(() => {
    if (isQuotaExceeded()) {
      setLoading(false);
      return;
    }
    // 0. Load cache for instant display
    const loadCache = async () => {
      const cachedSellers = await Storage.getLarge<Seller[]>('sellers_page_cache');
      if (cachedSellers) {
        setSellers(cachedSellers);
      }
    };
    loadCache();

    // 1. Subscribe to Sellers (Primary)
    const qSellers = query(collection(db, 'sellers'), orderBy('created_at', 'desc'), limit(100));
    const unsubscribeSellers = onSnapshot(qSellers, (snapshot) => {
      const sellersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Seller[];
      setSellers(sellersData);
      Storage.setLarge('sellers_page_cache', sellersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sellers');
      setLoading(false);
    });

    // 2. Fetch dependencies once to save quota (Metrics calculation)
    const fetchDependencies = async () => {
      try {
        const [productsSnap, ordersSnap, reviewsSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), limit(100))),
          getDocs(query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(100))),
          getDocs(query(collection(db, 'reviews'), orderBy('date', 'desc'), limit(100)))
        ]);

        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
        setOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
        setReviews(reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[]);
      } catch (err) {
        console.warn("Failed fetch of dependencies in SellersPage, might be quota issue:", err);
      }
    };
    fetchDependencies();

    return () => {
      unsubscribeSellers();
    };
  }, []);

  const resetForm = () => {
    setFormData({
      seller_id: '',
      name: '',
      logo: '',
      whatsapp_number: '',
      email: '',
      facebook: '',
      instagram: '',
      tiktok: '',
      is_verified: false,
      rating: 5.0
    });
    setEditingSeller(null);
  };

  const handleEdit = (seller: Seller, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Permission Check: Admin can edit anyone, Seller can only edit themselves
    if (!isAdmin && seller.seller_id !== currentSellerId) {
      alert("Unauthorized: You can only edit your own profile.");
      return;
    }

    setEditingSeller(seller);
    setFormData({
      seller_id: seller.seller_id || '',
      name: seller.name,
      logo: seller.logo,
      whatsapp_number: seller.whatsapp_number || '',
      email: seller.email || '',
      facebook: seller.facebook || '',
      instagram: seller.instagram || '',
      tiktok: seller.tiktok || '',
      is_verified: seller.is_verified || false,
      rating: seller.rating !== undefined ? seller.rating : 5.0
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this seller?')) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'sellers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sellers/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.seller_id.trim()) {
      alert('Seller ID is required for tracking.');
      return;
    }
    setSubmitting(true);

    try {
      if (editingSeller) {
        await updateDoc(doc(db, 'sellers', editingSeller.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'sellers'), {
          ...formData,
          created_at: serverTimestamp()
        });
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, editingSeller ? OperationType.UPDATE : OperationType.CREATE, editingSeller ? `sellers/${editingSeller.id}` : 'sellers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLiveRatingChange = async (sellerId: string, ratingValue: number) => {
    try {
      await updateDoc(doc(db, 'sellers', sellerId), {
        rating: ratingValue
      });
      if (selectedDashboardSeller && selectedDashboardSeller.id === sellerId) {
        setSelectedDashboardSeller(prev => prev ? { ...prev, rating: ratingValue } : null);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `sellers/${sellerId}`);
    }
  };

  const handleLiveVerificationToggle = async (sellerId: string, isVerified: boolean) => {
    try {
      await updateDoc(doc(db, 'sellers', sellerId), {
        is_verified: isVerified
      });
      if (selectedDashboardSeller && selectedDashboardSeller.id === sellerId) {
        setSelectedDashboardSeller(prev => prev ? { ...prev, is_verified: isVerified } : null);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `sellers/${sellerId}`);
    }
  };

  // Live Metric computation helpers for a specific partner entity
  const getSellerMetrics = (seller: Seller) => {
    const sName = seller.name.toLowerCase();
    const sCode = seller.seller_id ? seller.seller_id.toLowerCase() : '';

    // Match products
    const sellerProducts = products.filter(p => 
      p.seller?.toLowerCase() === sName || 
      (sCode && p.seller?.toLowerCase() === sCode)
    );

    const totalStock = sellerProducts.reduce((sum, p) => sum + (p.stock ?? 0), 0);
    const totalSold = sellerProducts.reduce((sum, p) => sum + (p.sold ?? 0), 0);

    // Match orders 
    const sellerOrders = orders.filter(o => 
      o.seller?.toLowerCase() === sName || 
      (sCode && o.seller?.toLowerCase() === sCode) ||
      (seller.id && o.seller_id === seller.id) ||
      (seller.seller_id && o.seller_id === seller.seller_id) ||
      (o.product_name && sellerProducts.some(p => p.name?.toLowerCase() === o.product_name?.toLowerCase()))
    );

    // Realized Gross Sales (Delivered or Completed)
    const completedOrdersValue = sellerOrders
      .filter(o => ['delivered', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.price || 0), 0);

    // Cost of goods estimated at 80% (yielding 20% margin)
    const grossProfit = completedOrdersValue * 0.20;
    const cogs = completedOrdersValue * 0.75;
    const adminFees = completedOrdersValue * 0.05;

    // Loss from cancellations
    const cancelledOrdersValue = sellerOrders
      .filter(o => o.status === 'cancelled')
      .reduce((sum, o) => sum + Number(o.price || 0), 0);

    // Rating (Uses admin-assigned custom rating if available, otherwise calculates review average)
    const productNamesList = sellerProducts.map(p => p.name?.toLowerCase());
    const sellerReviews = reviews.filter(r => 
      r.product_name && productNamesList.includes(r.product_name.toLowerCase())
    );
    const avgRating = (seller.rating !== undefined && seller.rating !== null)
      ? Number(Number(seller.rating).toFixed(1))
      : (sellerReviews.length > 0 
          ? Number((sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length).toFixed(1))
          : 5.0);

    return {
      products: sellerProducts,
      orders: sellerOrders,
      totalStock,
      totalSold,
      revenue: completedOrdersValue,
      profit: grossProfit,
      cogs,
      adminFees,
      loss: cancelledOrdersValue,
      avgRating,
      reviewsCount: sellerReviews.length
    };
  };

  const filteredSellers = sellers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.seller_id && s.seller_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.whatsapp_number && s.whatsapp_number.includes(searchTerm));
    
    if (!matchesSearch) return false;
    
    if (verificationFilter === 'verified') return s.is_verified === true;
    if (verificationFilter === 'unverified') return !s.is_verified;
    
    return true;
  });

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header 
        title="Sellers Hub" 
        onAction={isAdmin ? () => { resetForm(); setIsModalOpen(true); } : undefined} 
        actionLabel="Register Partner" 
        onSearch={setSearchTerm}
      />

      <main className="p-4 md:p-8 space-y-6 w-full max-w-[1600px] mx-auto">
        
        {/* Merchant Partner Welcome Banner */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 relative overflow-hidden shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/50 flex-shrink-0">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">pbazar Authorized Partner Program</h2>
              <p className="text-xs text-slate-500 font-medium max-w-[580px] mt-1 leading-relaxed">
                Connect and log merchant operations. Click on any certified partner below to load their real-time performance diagnostics—including stock velocity, rating indexes, and active profit margins.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 flex-shrink-0">
            <span className="text-[10px] bg-slate-100 text-slate-700 font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border border-slate-200/50">
              Active Sellers: {sellers.length}
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border border-indigo-100/40">
              Global Stock: {products.reduce((acc, p) => acc + (p.stock || 0), 0)} pcs
            </span>
          </div>
        </div>

        {/* Filters and View Toggles Section */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-205/60 p-4 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full sm:w-[280px] group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
              <input 
                type="text" 
                placeholder="Search by Partner name or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand tracking-tight uppercase"
              />
            </div>

            {/* Verification fast-filter capsules */}
            <div className="flex items-center bg-slate-50 border border-slate-200/80 p-0.5 rounded-xl w-full sm:w-auto overflow-x-auto">
              {(['all', 'verified', 'unverified'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => setVerificationFilter(preset)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none",
                    verificationFilter === preset 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  )}
                >
                  {preset === 'all' && 'All Sellers'}
                  {preset === 'verified' && 'Verified'}
                  {preset === 'unverified' && 'Unverified'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest cursor-pointer border",
                viewMode === 'grid' 
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50"
              )}
              title="Toggle Grid Cards"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest cursor-pointer border",
                viewMode === 'table' 
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50"
              )}
              title="Toggle Dense Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Directory Table</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <>
            {/* GRID VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSellers.map((seller) => {
                  const m = getSellerMetrics(seller);
                  return (
                    <div 
                      key={seller.id} 
                      onClick={() => setSelectedDashboardSeller(seller)}
                      className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col items-center text-center group hover:shadow-md hover:border-slate-300 transition-all duration-300 relative overflow-hidden cursor-pointer"
                    >
                      {/* Certified Tag */}
                      <div className="absolute top-4 left-4 flex items-center gap-1.5">
                        <span className="text-[8px] font-black uppercase bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full tracking-wider border border-indigo-100/40">
                          {seller.seller_id || 'PARTNER'}
                        </span>
                        {seller.is_verified && (
                          <span className="text-blue-500" title="pbazar Verified Merchant">
                            <ShieldCheck className="w-4 h-4 fill-blue-500 text-white" />
                          </span>
                        )}
                      </div>

                      <div className="w-18 h-18 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mt-3 mb-4 overflow-hidden relative">
                        {seller.logo ? (
                          <img src={seller.logo} alt={seller.name} className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-7 h-7 text-slate-300" />
                        )}
                      </div>
                      
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-base mb-1 truncate w-full px-2 flex items-center justify-center gap-1">
                        <span>{seller.name}</span>
                        {seller.is_verified && (
                          <ShieldCheck className="w-4 h-4 fill-blue-500 text-white flex-shrink-0" title="pbazar Verified Merchant" />
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mb-4">Stock Value: {formatCurrency(m.products.reduce((acc, p) => acc + ((p.stock || 0) * p.price), 0))}</p>
                      
                      {/* Metric Strips */}
                      <div className="grid grid-cols-3 gap-2 w-full bg-slate-50 p-2.5 rounded-2xl mb-5">
                        <div className="text-center">
                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Stock</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{m.totalStock} pcs</div>
                        </div>
                        <div className="text-center border-x border-slate-200">
                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Products</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{m.products.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Rating</div>
                          <div className="text-xs font-black text-amber-500 mt-0.5 flex items-center justify-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                            {m.avgRating}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between w-full mt-auto pt-3 border-t border-slate-100 gap-2.5">
                        {(isAdmin || seller.seller_id === currentSellerId) && (
                          <button 
                            onClick={(e) => handleEdit(seller, e)}
                            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 hover:text-slate-900 cursor-pointer text-xs"
                            title="Edit Partner"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedDashboardSeller(seller)}
                          className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 border border-indigo-100/40 hover:border-indigo-600 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <LayoutDashboard className="w-3 h-3" />
                          Dashboard
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={(e) => handleDelete(seller.id, e)}
                            disabled={deletingId === seller.id}
                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors border border-rose-200/50 cursor-pointer text-xs"
                            title="Delete Partner"
                          >
                            {deletingId === seller.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DIRECTORY TABLE VIEW */}
            {viewMode === 'table' && (
              <div className="bg-white rounded-3xl border border-slate-205/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse table-auto min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Name / Id</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Products</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Stock</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Realized revenue</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimated profits</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Merchant Rating</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSellers.map((seller) => {
                        const m = getSellerMetrics(seller);
                        return (
                          <tr 
                            key={seller.id} 
                            onClick={() => setSelectedDashboardSeller(seller)}
                            className="group hover:bg-indigo-50/20 transition-all cursor-pointer"
                          >
                            <td className="px-6 py-4.5 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {seller.logo ? (
                                  <img src={seller.logo} alt={seller.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Store className="w-4.5 h-4.5 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1">
                                  <span>{seller.name}</span>
                                  {seller.is_verified && (
                                    <ShieldCheck className="w-3.5 h-3.5 fill-blue-500 text-white flex-shrink-0" title="pbazar Verified Merchant" />
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{seller.seller_id || seller.id.slice(0, 8)}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-extrabold text-slate-650">{m.products.length} listed items</td>
                            <td className="px-6 py-4 text-xs font-extrabold text-slate-700">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-black border",
                                m.totalStock === 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                              )}>
                                {m.totalStock} units
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-black text-slate-800">{formatCurrency(m.revenue)}</td>
                            <td className="px-6 py-4 text-xs font-black text-emerald-600">{formatCurrency(m.profit)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                                <span className="text-xs font-black text-slate-700">{m.avgRating}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center gap-1.5">
                                <button 
                                  onClick={() => setSelectedDashboardSeller(seller)}
                                  className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-100/50 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase text-indigo-700 transition-colors"
                                >
                                  KPI metrics
                                </button>
                                <button 
                                  onClick={(e) => handleEdit(seller, e)}
                                  className="p-1 px-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => handleDelete(seller.id, e)}
                                  disabled={deletingId === seller.id}
                                  className="p-1 px-2 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-lg"
                                >
                                  {deletingId === seller.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {filteredSellers.length === 0 && (
              <div className="p-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <Store className="w-12 h-12 mx-auto mb-4 text-slate-350" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No merchants found matching your filters</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Seller Register/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeller ? `Edit Seller: ${formData.name}` : 'Register Certified Partner'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Unique ID (REQUIRED)</label>
              <input
                required
                type="text"
                value={formData.seller_id}
                onChange={e => setFormData({ ...formData, seller_id: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-black uppercase tracking-widest text-[#6366f1]"
                placeholder="e.g. trendy_bd_001"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Standard Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold uppercase tracking-tight text-slate-800"
                placeholder="e.g. Trendy BD Co."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WhatsApp Number (For Direct Contact / API)</label>
            <input
              required
              type="text"
              value={formData.whatsapp_number}
              onChange={e => setFormData({ ...formData, whatsapp_number: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-extrabold text-slate-700"
              placeholder="e.g. 017xxxxxxxx"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold text-slate-700"
                placeholder="contact@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Facebook Link</label>
              <input
                type="url"
                value={formData.facebook}
                onChange={e => setFormData({ ...formData, facebook: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold text-slate-700"
                placeholder="https://facebook.com/brand"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instagram Link</label>
              <input
                type="url"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold text-slate-700"
                placeholder="https://instagram.com/brand"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TikTok Handle</label>
              <input
                type="url"
                value={formData.tiktok}
                onChange={e => setFormData({ ...formData, tiktok: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold text-slate-700"
                placeholder="https://tiktok.com/@brand"
              />
            </div>
          </div>

          {/* Admin Rating & Verification controls */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] border-b border-slate-200 pb-2">
              Merchant Verification & Trust Rating (Admin Control)
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.is_verified}
                  onChange={e => setFormData({ ...formData, is_verified: e.target.checked })}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
                    Verify Partner
                    <ShieldCheck className="w-4 h-4 fill-blue-500 text-white" />
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                    Show verified corporate badge representation in catalogs
                  </span>
                </div>
              </label>

              <div className="space-y-1 w-full sm:w-[180px]">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Assign Seller Rating</label>
                <div className="flex items-center gap-2">
                  <select
                    value={formData.rating}
                    onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-750 focus:outline-none focus:border-indigo-500"
                  >
                    {[5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 3.5, 3.0, 2.5, 2.0, 1.0].map(val => (
                      <option key={val} value={val}>{val.toFixed(1)} Stars</option>
                    ))}
                  </select>
                  <Star className="w-4 h-4 fill-amber-450 stroke-amber-450 text-amber-500 flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Official Logo</label>
            <ImageUploader 
              value={formData.logo}
              onChange={(url) => setFormData(prev => ({...prev, logo: url}))}
              folder="sellers"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3.5 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-55 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-black transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingSeller ? 'Update Partner' : 'Register Partner'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Seller Performance Dashboard Modal */}
      {selectedDashboardSeller && (() => {
        const stats = getSellerMetrics(selectedDashboardSeller);
        const stockValue = stats.products.reduce((acc, p) => acc + ((p.stock || 0) * p.price), 0);
        return (
          <Modal
            isOpen={!!selectedDashboardSeller}
            onClose={() => setSelectedDashboardSeller(null)}
            title={`Merchant KPI Dashboard: ${selectedDashboardSeller.name}`}
            fullScreen={true}
          >
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1 select-none">
              
              {/* Partner Profile Badge header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-55 p-5 rounded-2xl border border-slate-200/50">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-205 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {selectedDashboardSeller.logo ? (
                      <img src={selectedDashboardSeller.logo} alt={selectedDashboardSeller.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-6 h-6 text-slate-400" />
                    )}
                    {selectedDashboardSeller.is_verified && (
                      <div className="absolute bottom-0 right-0 p-0.5 bg-blue-500 rounded-tl-xl">
                        <ShieldCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
                        {selectedDashboardSeller.name}
                        {selectedDashboardSeller.is_verified && (
                          <ShieldCheck className="w-4 h-4 fill-blue-500 text-white flex-shrink-0" title="pbazar Verified Merchant" />
                        )}
                      </h3>
                      <span className="text-[8px] bg-indigo-100 text-indigo-700 border border-indigo-200/30 px-2 py-0.5 rounded font-black uppercase tracking-widest">
                        {selectedDashboardSeller.seller_id || 'CERTIFIED'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-450 font-semibold tracking-tight mt-1 uppercase">
                      Hotline: <a href={`https://wa.me/${selectedDashboardSeller.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-black">{selectedDashboardSeller.whatsapp_number}</a>
                      {selectedDashboardSeller.email && (
                        <span> • Email: <span className="font-bold lowercase text-slate-650">{selectedDashboardSeller.email}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instant Verification Switcher */}
                <button
                  type="button"
                  onClick={() => handleLiveVerificationToggle(selectedDashboardSeller.id, !selectedDashboardSeller.is_verified)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-center",
                    selectedDashboardSeller.is_verified
                      ? "bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <ShieldCheck className={cn("w-3.5 h-3.5", selectedDashboardSeller.is_verified ? "fill-blue-500 text-white" : "")} />
                  <span>{selectedDashboardSeller.is_verified ? "Verified Merchant" : "Click to Verify"}</span>
                </button>
              </div>

              {/* Realized Profit & Loss and Velocity Indexes */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Merchant ledger diagnostics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Revenue Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Gross revenue</span>
                    <p className="text-sm font-black text-slate-800 mt-1">{formatCurrency(stats.revenue)}</p>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase mt-1">Delivered orders balance</p>
                  </div>

                  {/* Net Profits Card */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Net Merchant profit
                    </span>
                    <p className="text-sm font-black text-emerald-700 mt-1">{formatCurrency(stats.profit)}</p>
                    <p className="text-[9px] text-emerald-500 font-black uppercase mt-1">Estimated 20% Net Margin</p>
                  </div>

                  {/* Losses Card */}
                  <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-105/90">
                    <span className="text-[8px] font-black uppercase text-rose-600 tracking-wider flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Cancellation Losses
                    </span>
                    <p className="text-sm font-black text-rose-700 mt-1">{formatCurrency(stats.loss)}</p>
                    <p className="text-[9px] text-rose-500 font-bold uppercase mt-1">Missed potential value</p>
                  </div>

                  {/* Rating Index card */}
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-black uppercase text-amber-600 tracking-wider flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-300" />
                        Rating Index
                      </span>
                      <p className="text-sm font-black text-slate-800 mt-0.5">{stats.avgRating} / 5.0</p>
                    </div>
                    
                    {/* Live Star clickable setter */}
                    <div className="mt-2 border-t border-amber-250/30 pt-1.5">
                      <div className="flex items-center gap-0.5 justify-between">
                        <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest">Rate:</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((starVal) => {
                            const active = starVal <= Math.round(stats.avgRating);
                            return (
                              <button
                                key={starVal}
                                type="button"
                                onClick={() => handleLiveRatingChange(selectedDashboardSeller.id, starVal)}
                                className="p-0.5 hover:scale-120 transition-transform cursor-pointer"
                                title={`Rate ${starVal} Star`}
                              >
                                <Star className={cn("w-3.5 h-3.5", active ? "fill-amber-400 text-amber-500" : "text-amber-200 opacity-40")} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit & Loss Calculation flow details */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Est. cost of goods & transaction distribution</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-600 uppercase">
                    <span>COGS (Calculated base cost 75%):</span>
                    <span>{formatCurrency(stats.cogs)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600 uppercase">
                    <span>Platform Service Charge (5%):</span>
                    <span>{formatCurrency(stats.adminFees)}</span>
                  </div>
                  <div className="h-[1px] bg-slate-200 my-1" />
                  <div className="flex justify-between font-black text-slate-800 uppercase text-xs">
                    <span>Total Realized Gross Profits:</span>
                    <span className="text-emerald-600">{formatCurrency(stats.profit)}</span>
                  </div>
                </div>
              </div>

              {/* Quantity Stock metrics */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Merchant products & store presence</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Available Stock on Shelf</span>
                      <span className="text-xs font-black text-slate-700">{stats.totalStock} units</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Catalog Items</span>
                      <span className="text-xs font-black text-slate-700">{stats.products.length} listed items</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Estimated Catalog Value</span>
                      <span className="text-xs font-black text-slate-700">{formatCurrency(stockValue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Listed Table Section */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Seller Listed Products Catalog</h4>
                {stats.products.length === 0 ? (
                   <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    No products listed for this seller.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-bold uppercase text-[9px] text-slate-400">
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Price Unit</th>
                          <th className="p-3">In Stock</th>
                          <th className="p-3 text-right">Sold Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.products.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-700 truncate max-w-[200px]">{p.name}</td>
                            <td className="p-3 text-slate-600 font-bold">{formatCurrency(p.price)}</td>
                            <td className="p-3 font-bold text-slate-600">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black border",
                                (p.stock || 0) === 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-50 text-slate-700 border-slate-200"
                              )}>
                                {p.stock || 0} pcs
                              </span>
                            </td>
                            <td className="p-3 text-right font-black text-slate-800">{p.sold || 0} items</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDashboardSeller(null)}
                  className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-colors shadow-sm cursor-pointer"
                >
                  Close performance hub
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
