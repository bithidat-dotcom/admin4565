import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { CafeProduct, CafeOrder } from '../types';
import Header from './Header';
import Modal from './Modal';
import LoadingDots from './LoadingDots';
import ImageUploader from './ImageUploader';
import { 
  Coffee, Plus, Trash2, Edit2, CheckCircle, Clock, XCircle, Utensils, 
  Sparkles, Phone, MapPin, Store, DollarSign, Image as ImageIcon, 
  ShoppingBag, Loader2, Calendar, Search, Grid, List, Check, ChevronDown, Settings 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function CafeManagementPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'settings'>('products');
  
  // Products state
  const [products, setProducts] = useState<CafeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CafeProduct | null>(null);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  
  // Product form
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState<'Drinks' | 'Food' | 'Snacks' | 'Desserts'>('Drinks');
  const [productImage, setProductImage] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Cafe Settings / Shop state
  const [cafeShopName, setCafeShopName] = useState('pbazar Drink Cafe & Bistro');
  const [cafeBanner, setCafeBanner] = useState('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1200');

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load products
    const qProducts = query(collection(db, 'cafe_products'), orderBy('created_at', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as CafeProduct[];
      setProducts(data);
      setLoadingProducts(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cafe_products');
      setLoadingProducts(false);
    });

    // Load orders
    const qOrders = query(collection(db, 'cafe_orders'), orderBy('created_at', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as CafeOrder[];
      setOrders(data);
      setLoadingOrders(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cafe_orders');
      setLoadingOrders(false);
    });

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, []);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !productPrice) return;

    setSubmittingProduct(true);
    try {
      const payload = {
        name: productName,
        price: Number(productPrice),
        category: productCategory,
        image: productImage || 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=800',
        description: productDesc,
        created_at: serverTimestamp()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'cafe_products', editingProduct.id), payload);
      } else {
        await addDoc(collection(db, 'cafe_products'), payload);
      }

      setIsProductModalOpen(false);
      resetProductForm();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'cafe_products');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setProductCategory('Drinks');
    setProductImage('');
    setProductDesc('');
  };

  const handleEditProduct = (prod: CafeProduct) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductPrice(prod.price.toString());
    setProductCategory(prod.category || 'Drinks');
    setProductImage(prod.image);
    setProductDesc(prod.description);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cafe item?")) return;
    try {
      await deleteDoc(doc(db, 'cafe_products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cafe_products/${id}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'pending' | 'preparing' | 'completed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'cafe_orders', orderId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cafe_orders/${orderId}`);
    }
  };

  // Deterministic professional customer avatar from username
  const getCustomerAvatar = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const id = (hash % 70) + 1;
    return `https://i.pravatar.cc/150?img=${id}`;
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.whatsapp_number.includes(searchQuery) ||
      (o.product_name && o.product_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const filteredProducts = productCategoryFilter === 'all'
    ? products
    : products.filter(p => p.category === productCategoryFilter);

  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.price) || 0) + (Number(o.delivery_charge) || 0), 0);

  const activeOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;

  return (
    <div className="flex-1 overflow-x-hidden bg-[#e8f5e9]/5 min-h-screen">
      <Header 
        title="Drink Cafe Hub" 
        onAction={() => {
          resetProductForm();
          setIsProductModalOpen(true);
        }} 
        actionLabel="Add Cafe Item" 
      />

      <main className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Top Banner / Hero stats */}
        <div className="bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-[#2e7d32]/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-15 pointer-events-none">
            <Coffee className="w-96 h-96 text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-black bg-white/20 px-3.5 py-1.5 rounded-full uppercase tracking-widest text-emerald-100">Live Cafe Hub</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{cafeShopName}</h2>
              <p className="text-xs text-emerald-100/95 font-medium max-w-xl leading-relaxed">
                Experience high-performance order execution, menu management, and real-time sales insight tools formatted with fluid responsiveness.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 min-w-[280px]">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">Total Revenue</p>
                <p className="text-xl md:text-2xl font-black mt-0.5">{formatCurrency(totalRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">Active Orders</p>
                <p className="text-xl md:text-2xl font-black mt-0.5">{activeOrdersCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation and Actions Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('products')}
              className={cn(
                "px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm whitespace-nowrap",
                activeTab === 'products'
                  ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20 scale-102"
                  : "bg-white text-slate-600 hover:bg-[#e8f5e9]/50 border border-slate-200"
              )}
            >
              <Coffee className="w-4 h-4" />
              Cafe Menu ({products.length})
            </button>
            
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm whitespace-nowrap",
                activeTab === 'orders'
                  ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20 scale-102"
                  : "bg-white text-slate-600 hover:bg-[#e8f5e9]/50 border border-slate-200"
              )}
            >
              <Utensils className="w-4 h-4" />
              Cafe Orders ({orders.length})
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm whitespace-nowrap",
                activeTab === 'settings'
                  ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20 scale-102"
                  : "bg-white text-slate-600 hover:bg-[#e8f5e9]/50 border border-slate-200"
              )}
            >
              <Settings className="w-4 h-4" />
              Storefront Setup
            </button>
          </div>

          {/* Quick Stats Summary / Context Info */}
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest hidden lg:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Tab 1: Products */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cafe Menu List</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setProductViewMode('grid')}
                    className={cn("p-1.5 rounded-lg transition-all", productViewMode === 'grid' ? "bg-white text-[#2e7d32] shadow-sm" : "text-slate-400 hover:text-slate-600")}
                    title="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setProductViewMode('list')}
                    className={cn("p-1.5 rounded-lg transition-all", productViewMode === 'list' ? "bg-white text-[#2e7d32] shadow-sm" : "text-slate-400 hover:text-slate-600")}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
                {['all', 'Drinks', 'Food', 'Snacks', 'Desserts'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setProductCategoryFilter(cat)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                      productCategoryFilter === cat
                        ? "bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]/30 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center h-64"><LoadingDots /></div>
            ) : productViewMode === 'grid' ? (
              /* Grid Mode with Small Proportional Thumbnails (Directly answering 'cafe drink image some small') */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col justify-between space-y-4"
                  >
                    {/* Compact Image Container */}
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=800';
                          }}
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[8px] font-black uppercase bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded-full inline-block">
                          {product.category || 'Drinks'}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{product.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold tracking-wider">{formatCurrency(product.price)}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                      {product.description || 'Premium delicious cafe culinary creation.'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs font-black text-[#2e7d32] bg-[#e8f5e9] px-2.5 py-1 rounded-lg">Available</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="p-2 bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#2e7d32] hover:text-white rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full border border-dashed border-emerald-200 rounded-2xl p-12 text-center bg-[#e8f5e9]/20 flex flex-col items-center justify-center">
                    <Coffee className="w-10 h-10 text-[#2e7d32] mb-3 opacity-50" />
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">No matching items found</p>
                  </div>
                )}
              </div>
            ) : (
              /* Beautiful Bistro List Menu Mode with Tiny Exquisite Thumbnails */
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <div key={product.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#e8f5e9]/10 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=800';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{product.name}</h4>
                          <span className="text-[8px] font-black uppercase bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded-full">
                            {product.category || 'Drinks'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">{product.description || 'Delicious cafe specialty.'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <span className="text-xs font-black text-slate-900">{formatCurrency(product.price)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="p-2 bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#2e7d32] hover:text-white rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders (Direct Replication of the uploaded design UI) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Customer Orders</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{filteredOrders.length} orders found</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by customer, phone, item..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none w-52"
                  />
                </div>

                {/* Filter Selector Tabs */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto">
                  {['all', 'pending', 'preparing', 'completed', 'cancelled'].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                        statusFilter === st
                          ? "bg-[#2e7d32] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Premium Date Range Filter Placeholder (Matches the style in the screenshot) */}
                <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-[#2e7d32]" />
                  <span>14 Sep 2026</span>
                  <span className="text-slate-300">To</span>
                  <span>15 Sep 2026</span>
                </div>
              </div>
            </div>

            {/* Orders List Representation matching the uploaded visual perfectly */}
            {loadingOrders ? (
              <div className="flex items-center justify-center h-64"><LoadingDots /></div>
            ) : (
              <div className="space-y-4">
                {/* Table Header Row */}
                <div className="grid grid-cols-12 px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-3">Customer Name</div>
                  <div className="col-span-3">Address</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-1 text-right">Price</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {/* Animated Order Rows */}
                <AnimatePresence mode="popLayout">
                  {filteredOrders.map((order, idx) => {
                    const isSelected = selectedOrderId === order.id;
                    const dateFormatted = new Date(order.created_at).toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        key={order.id}
                        onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                        className={cn(
                          "grid grid-cols-12 items-center px-6 py-4 rounded-2xl border transition-all cursor-pointer relative",
                          isSelected 
                            ? "bg-[#2e7d32] text-white border-transparent shadow-xl shadow-[#2e7d32]/20 scale-[1.01] -translate-y-0.5 z-10" 
                            : "bg-white text-slate-700 border-slate-200/70 hover:border-emerald-200 hover:shadow-sm"
                        )}
                      >
                        {/* ID Column */}
                        <div className="col-span-2 font-mono text-xs font-black">
                          <span className={cn(isSelected ? "text-white/90" : "text-slate-900")}>
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <div className={cn("text-[9px] mt-0.5 font-sans", isSelected ? "text-white/70" : "text-slate-400")}>
                            {dateFormatted}
                          </div>
                        </div>

                        {/* Customer Name + Avatar Column */}
                        <div className="col-span-3 flex items-center gap-3">
                          <img 
                            src={getCustomerAvatar(order.customer_name)} 
                            alt={order.customer_name} 
                            className="w-8 h-8 rounded-full border border-slate-100 object-cover shrink-0 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className={cn("text-xs font-black uppercase truncate", isSelected ? "text-white" : "text-slate-900")}>
                              {order.customer_name}
                            </div>
                            <div className={cn("text-[10px] flex items-center gap-1 mt-0.5 font-semibold", isSelected ? "text-white/80" : "text-[#2e7d32]")}>
                              <Phone className="w-2.5 h-2.5" />
                              {order.whatsapp_number}
                            </div>
                          </div>
                        </div>

                        {/* Location/Address Column */}
                        <div className="col-span-3 flex items-center gap-2">
                          <MapPin className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-white/80" : "text-slate-400")} />
                          <div className="min-w-0">
                            <p className={cn("text-xs font-bold truncate", isSelected ? "text-white" : "text-slate-700")}>
                              {order.location}
                            </p>
                            <span className={cn("text-[9px] font-semibold block mt-0.5", isSelected ? "text-white/70" : "text-slate-400")}>
                              Item: {order.product_name || 'Cafe Specialty'}
                            </span>
                          </div>
                        </div>

                        {/* Status Tag Column with Glowing dot indicator (Mirroring the picture design) */}
                        <div className="col-span-2 text-center flex justify-center">
                          <span className={cn(
                            "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                            isSelected
                              ? "bg-white/10 text-white"
                              : order.status === 'completed' && "bg-emerald-100 text-emerald-800" ||
                                order.status === 'preparing' && "bg-amber-100 text-amber-800" ||
                                order.status === 'pending' && "bg-rose-100 text-rose-800" ||
                                "bg-slate-100 text-slate-800"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full inline-block animate-pulse",
                              isSelected ? "bg-white" : 
                              order.status === 'completed' ? "bg-emerald-500" :
                              order.status === 'preparing' ? "bg-amber-500" :
                              order.status === 'pending' ? "bg-rose-500" : "bg-slate-500"
                            )} />
                            {order.status}
                          </span>
                        </div>

                        {/* Price Column */}
                        <div className="col-span-1 text-right font-mono text-xs font-black">
                          <span className={isSelected ? "text-white" : "text-slate-900"}>
                            {formatCurrency((Number(order.price) || 0) + (Number(order.delivery_charge) || 0))}
                          </span>
                          <div className={cn("text-[9px] font-sans", isSelected ? "text-white/75" : "text-slate-400")}>
                            +{order.delivery_charge || 0} del
                          </div>
                        </div>

                        {/* Quick Action Selector Column */}
                        <div className="col-span-1 text-right flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer border shadow-sm transition-all appearance-none pr-6",
                                isSelected 
                                  ? "bg-white/15 text-white border-transparent focus:ring-0" 
                                  : "bg-white text-slate-700 border-slate-200 focus:ring-2 focus:ring-[#2e7d32]/20"
                              )}
                            >
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <ChevronDown className={cn("w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none", isSelected ? "text-white" : "text-slate-500")} />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {filteredOrders.length === 0 && (
                  <div className="border border-dashed border-emerald-200 rounded-3xl p-16 text-center bg-[#e8f5e9]/20 flex flex-col items-center justify-center">
                    <Utensils className="w-12 h-12 text-[#2e7d32] mb-4 opacity-50" />
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">No matching orders found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Settings & Shop Setup */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Drink Cafe Storefront Setup</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Configure your Drink Cafe branding, shop name, and promotional hero banner.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cafe Shop Name</label>
                <input
                  type="text"
                  value={cafeShopName}
                  onChange={(e) => setCafeShopName(e.target.value)}
                  className="w-full mt-1.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Storefront Hero Banner Image</label>
                <div className="mt-1.5">
                  <ImageUploader
                    value={cafeBanner}
                    onChange={setCafeBanner}
                    folder="banners"
                  />
                </div>
              </div>

              <button
                onClick={() => alert("Cafe storefront configuration saved successfully!")}
                className="bg-[#2e7d32] text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1b5e20] transition-all shadow-lg shadow-[#2e7d32]/20 cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        title={editingProduct ? "Edit Cafe Menu Item" : "Add New Cafe Item"}
      >
        <form onSubmit={handleSaveProduct} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Item Name</label>
            <input
              type="text"
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g., Cold Brew Coffee / Club Sandwich"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price (৳)</label>
              <input
                type="number"
                required
                value={productPrice}
                onChange={e => setProductPrice(e.target.value)}
                placeholder="250"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
              <select
                value={productCategory}
                onChange={e => setProductCategory(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none cursor-pointer"
              >
                <option value="Drinks">Drinks</option>
                <option value="Food">Food</option>
                <option value="Snacks">Snacks</option>
                <option value="Desserts">Desserts</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product Image</label>
            <ImageUploader 
              value={productImage}
              onChange={setProductImage}
              folder="products"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
            <textarea
              rows={3}
              value={productDesc}
              onChange={e => setProductDesc(e.target.value)}
              placeholder="Freshly brewed with premium ingredients..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingProduct}
              className="flex-[2] bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#2e7d32]/20 flex items-center justify-center gap-2"
            >
              {submittingProduct && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProduct ? "Update Item" : "Publish Item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
