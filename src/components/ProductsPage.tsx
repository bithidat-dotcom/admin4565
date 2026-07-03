import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, serverTimestamp, limit, where, or } from 'firebase/firestore';
import { Product, Seller } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import LoadingDots from './LoadingDots';
import { exportToCSV } from '../lib/utils';
import { 
  Edit2, 
  Trash2, 
  Loader2, 
  Image as ImageIcon, 
  Plus,
  Star,
  ChevronRight,
  Sparkles, 
  Pizza, 
  Crown, 
  Smartphone, 
  Bot, 
  Laptop, 
  ArrowLeft,
  Home, 
  Layers, 
  Dumbbell, 
  ShoppingBasket,
  Boxes,
  Store,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Music
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import { formatCurrency, cn } from '../lib/utils';
import { Storage } from '../lib/storage';

interface ProductsPageProps {
  defaultCategory?: string;
  onCategoryFilterChange?: (category: string) => void;
  onViewChange?: (view: any) => void;
  userSession?: any;
}

const categoryFilters = [
  { name: 'All', icon: Boxes },
  { name: 'Super Sale', icon: Star, special: 'super_sale' },
  { name: 'Food', icon: Pizza },
  { name: 'Fashion', icon: Crown },
  { name: 'Gadget', icon: Smartphone },
  { name: 'Robotic', icon: Bot },
  { name: 'PC', icon: Laptop },
  { name: 'Cloth', icon: Layers },
  { name: 'Sports', icon: Dumbbell },
  { name: 'Grocery', icon: ShoppingBasket },
];

function DiscountTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = new Date(expiresAt).getTime();
      const diff = target - now;

      if (isNaN(target)) {
        setTimeLeft('');
        return;
      }

      if (diff <= 0) {
        setTimeLeft('Discount Expired');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let str = '';
        if (days > 0) str += `${days}d `;
        str += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        setTimeLeft(str);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;
  
  if (timeLeft === 'Discount Expired') {
    return (
      <div className="mt-2 text-[9px] font-black text-rose-500 bg-rose-50/80 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-widest inline-block select-none font-mono">
        ⏳ Sale Ended
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded border border-indigo-100 animate-pulse uppercase tracking-wider inline-block select-none font-mono">
      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
      Ends: {timeLeft}
    </div>
  );
}

const isNew = (dateString: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
};

export default function ProductsPage({ defaultCategory = 'All', onCategoryFilterChange, onViewChange, userSession }: ProductsPageProps = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isSeller = userSession?.role === 'seller';
  const currentSellerName = userSession?.name || '';
  const currentSellerId = userSession?.sellerId || '';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [sellerSearch, setSellerSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    images: [] as string[],
    discount: '0',
    seller: '',
    seller_logo: '',
    seller_whatsapp: '',
    seller_email: '',
    seller_facebook: '',
    seller_instagram: '',
    seller_tiktok: '',
    category: 'Food',
    stock: '20',
    sold: '0',
    gadgetSpecs: {
      ram: '',
      storage: '',
      refreshRate: '',
      battery: '',
      watt: '',
      amp: ''
    },
    discountExpiresAt: '',
    discountType: 'permanent' as 'permanent' | 'timer',
    seller_id: '',
    is_super_sale: false,
    is_seller_creation: isSeller,
    extra_categories: [] as string[]
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newExtraCategory, setNewExtraCategory] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState(defaultCategory);

  const categories = ['Food', 'Fashion', 'Gadget', 'Robotic', 'PC', 'Cloth', 'Sports', 'Grocery'];

  useEffect(() => {
    setFilterCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    onCategoryFilterChange?.(filterCategory);
  }, [filterCategory, onCategoryFilterChange]);

  const filteredProducts = products.filter(product => {
    const searchLower = filterName.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(searchLower) || 
                          product.extra_categories?.some(cat => cat.toLowerCase().includes(searchLower));
    const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
    const matchesSuperSell = filterCategory === 'Super Sale' ? product.is_super_sale : true;
    
    if (filterCategory === 'Super Sale') {
      return matchesSearch && product.is_super_sale;
    }
    
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    // Load cache
    const loadCache = async () => {
      const cachedProducts = await Storage.getLarge<Product[]>('products_page_cache');
      if (cachedProducts && !isSeller) {
        setProducts(cachedProducts);
      }
      
      const cachedSellers = await Storage.getLarge<Seller[]>('sellers_list_cache');
      if (cachedSellers) {
        setSellers(cachedSellers);
      }
    };
    loadCache();

    // Limited query to save quota
    let q;
    if (isSeller && (currentSellerId || currentSellerName)) {
      q = query(
        collection(db, 'products'), 
        or(
          where('seller_id', '==', currentSellerId),
          where('seller', '==', currentSellerName)
        ),
        limit(500)
      );
    } else {
      q = query(collection(db, 'products'), limit(1000));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at || new Date().toISOString()
      })) as Product[];
      
      // Client-side sort to ensure all items show even if they are missing fields required for server-side index
      productsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setProducts(productsData);
      if (!isSeller) {
        Storage.setLarge('products_page_cache', productsData);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSeller, currentSellerId]);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const q = query(collection(db, 'sellers'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const sellersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Seller[];
        setSellers(sellersData);
        Storage.setLarge('sellers_list_cache', sellersData);
      } catch (err) {
         console.warn("Failed fetch of sellers in ProductsPage, might be quota issue:", err);
      }
    };
    fetchSellers();
  }, []);

  const resetForm = () => {
    setFormData({
      ...formData,
      name: '',
      price: '',
      description: '',
      image: '',
      images: [],
      discount: '0',
      seller: isSeller ? currentSellerName : '',
      seller_id: isSeller ? currentSellerId : '',
      seller_logo: '',
      seller_whatsapp: '',
      seller_email: '',
      seller_facebook: '',
      seller_instagram: '',
      seller_tiktok: '',
      category: 'Food',
      stock: '20',
      sold: '0',
      gadgetSpecs: {
        ram: '',
        storage: '',
        refreshRate: '',
        battery: '',
        watt: '',
        amp: ''
      },
      discountExpiresAt: '',
      discountType: 'permanent',
      is_super_sale: false,
      extra_categories: []
    });
    setEditingProduct(null);
    setNewImageUrl('');
    setNewExtraCategory('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    if (filterCategory !== 'All') {
      setFormData(prev => ({ ...prev, category: filterCategory }));
    }
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      description: product.description,
      image: product.image,
      images: product.images || [],
      discount: product.discount.toString(),
      seller: product.seller || '',
      seller_id: product.seller_id || '',
      seller_logo: product.seller_logo || '',
      seller_whatsapp: product.seller_whatsapp || '',
      seller_email: product.seller_email || '',
      seller_facebook: product.seller_facebook || '',
      seller_instagram: product.seller_instagram || '',
      seller_tiktok: product.seller_tiktok || '',
      category: product.category || 'Food',
      stock: (product.stock ?? 20).toString(),
      sold: (product.sold ?? 0).toString(),
      gadgetSpecs: {
        ram: product.gadgetSpecs?.ram || '',
        storage: product.gadgetSpecs?.storage || '',
        refreshRate: product.gadgetSpecs?.refreshRate || '',
        battery: product.gadgetSpecs?.battery || '',
        watt: product.gadgetSpecs?.watt || '',
        amp: product.gadgetSpecs?.amp || ''
      },
      discountExpiresAt: product.discountExpiresAt || '',
      discountType: product.discountExpiresAt ? 'timer' : 'permanent',
      is_super_sale: product.is_super_sale || false,
      extra_categories: product.extra_categories || []
    });
    setIsModalOpen(true);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteModalStep, setDeleteModalStep] = useState<'password' | 'confirm'>('password');
  const [passwordInput, setPasswordInput] = useState('');

  const handleDelete = (id: string) => {
    setProductToDelete(id);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    const id = productToDelete;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'products', id));
      setProductToDelete(null);
    } catch (err) {
      console.error("Delete failed:", err);
      if (err instanceof Error && err.message.includes("QUOTA_EXCEEDED")) {
        alert("Daily limit reached. Cannot delete right now. Please try again tomorrow.");
      } else {
        alert("Failed to delete product. Please check your connection.");
      }
      // Don't close modal on error so user can retry or see what happened
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenDeleteAllModal = () => {
    setPasswordInput('');
    setDeleteModalStep('password');
    setIsDeleteAllModalOpen(true);
  };

  const verifyPasswordAndProceed = () => {
    if (passwordInput === 's10d10k5@') {
      setDeleteModalStep('confirm');
    } else {
      alert('Invalid password');
    }
  };

  const executeDeleteAll = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'products');
      alert('Failed to delete all products');
    }
  };

  const addExtraImage = () => {
    if (!newImageUrl) return;
    setFormData(prev => ({ ...prev, images: [...prev.images, newImageUrl] }));
    setNewImageUrl('');
  };

  const addExtraCategory = () => {
    if (!newExtraCategory.trim()) return;
    if (formData.extra_categories.includes(newExtraCategory.trim())) {
      setNewExtraCategory('');
      return;
    }
    setFormData(prev => ({ ...prev, extra_categories: [...prev.extra_categories, newExtraCategory.trim()] }));
    setNewExtraCategory('');
  };

  const removeExtraCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      extra_categories: prev.extra_categories.filter(c => c !== cat)
    }));
  };

  const removeExtraImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: any = {
      name: formData.name,
      price: parseFloat(formData.price),
      image: formData.image,
      images: formData.images,
      discount: parseFloat(formData.discount),
      description: formData.description,
      seller: formData.seller,
      seller_id: formData.is_seller_creation ? currentSellerId : (formData.seller_id || ''),
      seller_logo: formData.seller_logo,
      seller_whatsapp: formData.seller_whatsapp,
      seller_email: formData.seller_email,
      seller_facebook: formData.seller_facebook,
      seller_instagram: formData.seller_instagram,
      seller_tiktok: formData.seller_tiktok,
      category: formData.category,
      stock: parseInt(formData.stock) || 0,
      quantity: parseInt(formData.stock) || 0,
      qty: parseInt(formData.stock) || 0,
      sold: parseInt(formData.sold) || 0,
      updatedAt: serverTimestamp(),
      gadgetSpecs: formData.category === 'Gadget' ? {
        ram: formData.gadgetSpecs.ram || '',
        storage: formData.gadgetSpecs.storage || '',
        refreshRate: formData.gadgetSpecs.refreshRate || '',
        battery: formData.gadgetSpecs.battery || '',
        watt: formData.gadgetSpecs.watt || '',
        amp: formData.gadgetSpecs.amp || ''
      } : null,
      is_super_sale: formData.is_super_sale,
      extra_categories: formData.extra_categories,
      discountExpiresAt: (parseFloat(formData.discount) > 0 && formData.discountType === 'timer') ? formData.discountExpiresAt : ''
    };

    // Calculate approximate payload size to prevent Firestore "too large" errors (1MB limit)
    const payloadString = JSON.stringify(payload);
    const payloadSizeInBytes = new Blob([payloadString]).size;
    
    if (payloadSizeInBytes > 1000000) {
      setSubmitting(false);
      const sizeMB = (payloadSizeInBytes / (1024 * 1024)).toFixed(2);
      alert(`STOP: This product data is too large to save (${sizeMB} MB). \n\nReason: Firestore documents have a 1MB limit. You likely have too many large images or are using Base64 links. \n\nFIX: Remove some gallery images or use Method 2 (Cloud) in the Link Converter to host them externally.`);
      return;
    }

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          created_at: serverTimestamp()
        });
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, editingProduct ? `products/${editingProduct.id}` : 'products');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header 
        title="Products" 
        onAction={handleOpenAddModal} 
        actionLabel="New Product" 
        onSearch={setFilterName}
      />

      {/* Category Quick Filter Bar */}
      <div className="px-4 md:px-8 mt-4">
        <div className="bg-white/75 p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-3">
              {onViewChange && (
                <button
                  onClick={() => onViewChange('dashboard')}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-150/40 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Dashboard
                </button>
              )}
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                Category Registry Shortcuts
              </h4>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider lg:inline hidden">
              Scroll Horizontally &rarr;
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none snap-x touch-pan-x -mx-2 px-2">
            {categoryFilters.map((cat) => {
              const IconComponent = cat.icon;
              const isActive = filterCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setFilterCategory(cat.name)}
                  className={cn(
                    "snap-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 shrink-0 border cursor-pointer",
                    isActive
                      ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200"
                      : "bg-white border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <IconComponent className={cn("w-3.5 h-3.5", isActive ? "text-brand animate-pulse" : "text-slate-400")} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {!isSeller && (
          <button
            onClick={handleOpenDeleteAllModal}
            className="px-4 py-3 sm:py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors shrink-0 text-center"
          >
            Delete All Products
          </button>
        )}
        <input 
          type="text" 
          placeholder="Filter by name..." 
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="px-4 py-3 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 uppercase tracking-widest flex-1 sm:max-w-xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
        />
        <select 
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-3 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 uppercase tracking-widest sm:max-w-xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
        >
          <option value="All">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button 
                onClick={() => exportToCSV(filteredProducts, 'products')}
                className="bg-white border border-indigo-200 text-indigo-600 rounded-lg px-4 py-3 sm:py-2 text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors"
            >
                Export CSV
            </button>
      </div>

      <main className="p-4 md:p-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingDots />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                onClick={() => setActiveProductId(prev => prev === product.id ? null : product.id)}
                className={cn(
                  "bg-white rounded-xl border overflow-hidden group hover:shadow-xl transition-all duration-500 cursor-pointer relative",
                  product.is_super_sale ? "border-amber-400 shadow-lg shadow-amber-50 ring-1 ring-amber-400/20" : "border-slate-200"
                )}
              >
                <div className="aspect-square relative overflow-hidden bg-slate-100">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  {product.discount > 0 && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase z-10">
                      -{product.discount}%
                    </div>
                  )}
                  {isNew(product.created_at) && (
                    <div className={cn(
                      "absolute bg-brand text-white text-[10px] font-black px-2 py-1 rounded tracking-widest uppercase z-10 animate-pulse shadow-lg shadow-brand/20",
                      product.discount > 0 ? "top-10 left-3" : "top-3 left-3"
                    )}>
                      NEW
                    </div>
                  )}
                  {product.is_super_sale && (
                    <div className={cn(
                      "absolute left-3 bg-amber-500 text-white text-[9px] font-black px-2 py-1 rounded tracking-widest uppercase z-10 flex items-center gap-1 shadow-lg shadow-amber-500/20",
                      (product.discount > 0 && isNew(product.created_at)) ? "top-16" : (product.discount > 0 || isNew(product.created_at)) ? "top-10" : "top-3"
                    )}>
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Super Sale
                    </div>
                  )}
                  {product.seller && (
                    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
                       <div className="bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-slate-200/50 shadow-sm flex items-center gap-1.5 pr-2">
                          <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                             {(product.seller_logo || sellers.find(s => s.name === product.seller)?.logo) ? (
                               <img 
                                src={product.seller_logo || sellers.find(s => s.name === product.seller)?.logo} 
                                alt="" 
                                className="w-full h-full object-cover"
                               />
                             ) : (
                               <Store className="w-3 h-3 text-slate-400" />
                             )}
                          </div>
                          <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest truncate max-w-[60px]">
                            {product.seller}
                          </span>
                       </div>
                    </div>
                  )}
                  <div className={cn(
                    "absolute inset-0 bg-slate-900/60 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]",
                    activeProductId === product.id 
                      ? "opacity-100 pointer-events-auto" 
                      : "opacity-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                  )}>
                    {(!isSeller || product.seller_id === currentSellerId) && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(product);
                          }}
                          className="p-3 bg-white rounded-xl shadow-xl text-brand hover:scale-110 active:scale-95 transition-all"
                          title="Edit Product"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateDoc(doc(db, 'products', product.id), {
                                is_super_sale: !product.is_super_sale
                              });
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all",
                            product.is_super_sale ? "bg-amber-500 text-white" : "bg-white text-slate-400"
                          )}
                          title={product.is_super_sale ? "Remove from Super Sale" : "Mark as Super Sale"}
                        >
                          <Star className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product.id);
                          }}
                          disabled={deletingId === product.id}
                          className="p-3 bg-white rounded-xl shadow-xl text-red-500 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                          title="Delete Product"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </>
                    )}
                    {(isSeller && product.seller_id !== currentSellerId) && (
                      <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-md">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest text-center">Locked View</p>
                        <p className="text-[8px] text-white/60 font-bold uppercase tracking-tight text-center">Owned by {product.seller}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU: {product.id.slice(0, 8)}</div>
                    {product.extra_categories && product.extra_categories.length > 0 && product.extra_categories.map((cat, i) => (
                      <span key={i} className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-indigo-100/50">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-bold text-slate-900 line-clamp-1 text-sm uppercase">{product.name}</h3>
                  <div className="flex justify-between items-center mt-2">
                      <span className="font-black text-brand text-sm">{formatCurrency(product.price)}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", (product.stock || 0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{(product.stock || 0)} left</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-2 line-clamp-2 min-h-[32px] leading-relaxed">
                    {product.description}
                  </p>

                  {/* Dynamic Countdown Clock Display */}
                  {product.discount > 0 && product.discountExpiresAt && (
                    <DiscountTimer expiresAt={product.discountExpiresAt} />
                  )}

                  {/* Micro Gadget Specs Panel */}
                  {product.category === 'Gadget' && product.gadgetSpecs && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-white">
                      <div className="flex items-center gap-1 text-[8.5px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-800/80">
                        <Smartphone className="w-3.5 h-3.5 text-brand" />
                        Hardware Specifications
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9.5px]">
                        {product.gadgetSpecs.ram && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">RAM</span>
                            <span className="font-extrabold text-brand truncate max-w-[40px] uppercase">{product.gadgetSpecs.ram}</span>
                          </div>
                        )}
                        {product.gadgetSpecs.storage && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">ROM</span>
                            <span className="font-extrabold text-white truncate max-w-[40px] uppercase">{product.gadgetSpecs.storage}</span>
                          </div>
                        )}
                        {product.gadgetSpecs.refreshRate && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50 col-span-2">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Refresh</span>
                            <span className="font-extrabold text-white truncate uppercase">{product.gadgetSpecs.refreshRate}</span>
                          </div>
                        )}
                        {product.gadgetSpecs.battery && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50 col-span-2">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Battery</span>
                            <span className="font-extrabold text-white truncate uppercase">{product.gadgetSpecs.battery}</span>
                          </div>
                        )}
                        {product.gadgetSpecs.watt && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Watt</span>
                            <span className="font-extrabold text-white truncate max-w-[40px] uppercase">{product.gadgetSpecs.watt}</span>
                          </div>
                        )}
                        {product.gadgetSpecs.amp && (
                          <div className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50">
                            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Amp</span>
                            <span className="font-extrabold text-white truncate max-w-[40px] uppercase">{product.gadgetSpecs.amp}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Stock Status & Units Sold indicators */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                      (product.stock ?? 0) === 0 
                        ? "bg-red-50 text-red-600 border border-red-100" 
                        : (product.stock ?? 0) <= 5 
                          ? "bg-amber-50 text-amber-600 border border-amber-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    )}>
                      {(product.stock ?? 0) === 0 
                        ? "Out Of Stock" 
                        : (product.stock ?? 0) <= 5 
                          ? `Low Stock: ${product.stock}` 
                          : `In Stock: ${product.stock}`}
                    </span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {product.sold ?? 0} Sold
                    </span>
                  </div>

                  {product.seller && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">
                          Seller: {product.seller}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(product.seller_whatsapp || sellers.find(s => s.name === product.seller)?.whatsapp_number) && (
                            <a 
                              href={`https://wa.me/${(product.seller_whatsapp || sellers.find(s => s.name === product.seller)?.whatsapp_number)?.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                              title="Chat on WhatsApp"
                            >
                              <Phone className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {(product.seller_email || sellers.find(s => s.name === product.seller)?.email) && (
                            <a 
                              href={`mailto:${product.seller_email || sellers.find(s => s.name === product.seller)?.email}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 flex items-center justify-center rounded-md bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                              title="Email Seller"
                            >
                              <Mail className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {(product.seller_facebook || sellers.find(s => s.name === product.seller)?.facebook) && (
                            <a 
                              href={product.seller_facebook || sellers.find(s => s.name === product.seller)?.facebook}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 p-0.5 flex items-center justify-center rounded-md bg-white border border-slate-100 shadow-sm hover:border-slate-300 transition-all"
                              title="Facebook"
                            >
                              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQm0F2xlq4BO9-4boQ1D9oGwXTiYfW5KcUvew&s" alt="FB" className="w-full h-full object-contain" />
                            </a>
                          )}
                          {(product.seller_instagram || sellers.find(s => s.name === product.seller)?.instagram) && (
                            <a 
                              href={product.seller_instagram || sellers.find(s => s.name === product.seller)?.instagram}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 p-0.5 flex items-center justify-center rounded-md bg-white border border-slate-100 shadow-sm hover:border-slate-300 transition-all"
                              title="Instagram"
                            >
                              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/250px-Instagram_logo_2016.svg.png" alt="IG" className="w-full h-full object-contain" />
                            </a>
                          )}
                          {(product.seller_tiktok || sellers.find(s => s.name === product.seller)?.tiktok) && (
                            <a 
                              href={product.seller_tiktok || sellers.find(s => s.name === product.seller)?.tiktok}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 p-0.5 flex items-center justify-center rounded-md bg-white border border-slate-100 shadow-sm hover:border-slate-300 transition-all"
                              title="TikTok"
                            >
                              <img src="https://sf-static.tiktokcdn.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png" alt="TT" className="w-full h-full object-contain" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900 tracking-tighter">
                        {formatCurrency(product.price)}
                      </span>
                      {(product.seller_whatsapp || sellers.find(s => s.name === product.seller)?.whatsapp_number) && (
                        <a 
                          href={`https://wa.me/${(product.seller_whatsapp || sellers.find(s => s.name === product.seller)?.whatsapp_number)?.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors"
                          title="Contact Seller on WhatsApp"
                        >
                          <Phone className="w-3 h-3 fill-current" />
                        </a>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Details action simply activates details or logs, we keep it safe
                      }} 
                      className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        title={deleteModalStep === 'password' ? 'Authorize Action' : 'Confirm Deletion'}
      >
        {deleteModalStep === 'password' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Please enter the owner password to proceed.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
              placeholder="Enter password..."
            />
            <button
              onClick={verifyPasswordAndProceed}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Are you sure you want to permanently delete ALL products? This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50"
              >
                No
              </button>
              <button
                onClick={executeDeleteAll}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-red-600"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Update Inventory' : 'Add New Inventory'}
        fullScreen={true}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                placeholder="Product name..."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price (৳)</label>
              <input
                required
                type="number"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Discount (%)</label>
              <input
                type="number"
                value={formData.discount}
                onChange={e => setFormData({ ...formData, discount: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Promotion</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_super_sale: !formData.is_super_sale })}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border w-full",
                  formData.is_super_sale 
                    ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200" 
                    : "bg-slate-50 border-slate-200 text-slate-400"
                )}
              >
                <Star className={cn("w-3.5 h-3.5", formData.is_super_sale ? "fill-current animate-pulse" : "")} />
                {formData.is_super_sale ? 'Active Super Sale' : 'Mark Super Sale'}
              </button>
            </div>
          </div>

          <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-700">Extra Categories / Tags</h4>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExtraCategory}
                onChange={e => setNewExtraCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExtraCategory();
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium"
                placeholder="Type additional category (e.g. New Arrival, Offer)..."
              />
              <button
                type="button"
                onClick={addExtraCategory}
                disabled={!newExtraCategory.trim()}
                className="px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:grayscale"
              >
                Add Tag
              </button>
            </div>
            
            {formData.extra_categories.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {formData.extra_categories.map((cat, idx) => (
                  <span 
                    key={idx} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm"
                  >
                    {cat}
                    <button 
                      type="button" 
                      onClick={() => removeExtraCategory(cat)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Adding extra categories helps in custom filtering and discovery sections.</p>
          </div>

          <div className="space-y-3">
            {isSeller ? (
              <div className="p-4 bg-brand/5 border border-brand/20 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs">
                  {(currentSellerName || 'S').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing As Partner</p>
                  <p className="text-sm font-black text-slate-900 uppercase">{currentSellerName || 'Independent Seller'}</p>
                  <p className="text-[9px] font-bold text-brand uppercase tracking-tighter">Verified Identity • ID: {currentSellerId}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Seller Profile</label>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={(e) => {
                        const el = e.currentTarget.parentElement?.parentElement?.nextElementSibling?.nextElementSibling;
                        if (el) el.scrollLeft -= 200;
                      }}
                      className="p-1 hover:bg-white rounded shadow-sm text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        const el = e.currentTarget.parentElement?.parentElement?.nextElementSibling?.nextElementSibling;
                        if (el) el.scrollLeft += 200;
                      }}
                      className="p-1 hover:bg-white rounded shadow-sm text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="relative group mb-4">
                  <input
                    type="text"
                    placeholder="Search seller by name..."
                    value={sellerSearch}
                    onChange={(e) => setSellerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-[11px] font-bold uppercase tracking-widest transition-all"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <ShoppingBasket className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 snap-x -mx-1 px-1 scroll-smooth no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setFormData({ 
                      ...formData, 
                      seller: '', 
                      seller_id: '',
                      seller_logo: '', 
                      seller_whatsapp: '',
                      seller_email: '',
                      seller_facebook: '',
                      seller_instagram: '',
                      seller_tiktok: ''
                    })}
                    className={cn(
                      "snap-start flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all shrink-0 min-w-[100px] cursor-pointer",
                      formData.seller === '' 
                        ? "bg-slate-900 border-slate-900 shadow-xl scale-105" 
                        : "bg-white border-slate-200 hover:border-slate-400"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border-2",
                      formData.seller === '' ? "bg-slate-800 border-brand" : "bg-slate-50 border-slate-100"
                    )}>
                      <Store className={cn("w-6 h-6", formData.seller === '' ? "text-brand" : "text-slate-400")} />
                    </div>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest truncate max-w-[80px]", formData.seller === '' ? "text-white" : "text-slate-600")}>Official</span>
                  </button>
                  {sellers.filter(s => s.name.toLowerCase().includes(sellerSearch.toLowerCase())).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        seller: s.name, 
                        seller_id: s.seller_id || s.id,
                        seller_logo: s.logo || '', 
                        seller_whatsapp: s.whatsapp_number || '',
                        seller_email: s.email || '',
                        seller_facebook: s.facebook || '',
                        seller_instagram: s.instagram || '',
                        seller_tiktok: s.tiktok || ''
                      })}
                      className={cn(
                        "snap-start flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all shrink-0 min-w-[100px] cursor-pointer",
                        formData.seller === s.name 
                          ? "bg-slate-900 border-slate-900 shadow-xl scale-105" 
                          : "bg-white border-slate-200 hover:border-slate-400"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl overflow-hidden border-2",
                        formData.seller === s.name ? "border-brand" : "border-slate-100"
                      )}>
                        {s.logo ? (
                          <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <Store className="w-6 h-6 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest truncate max-w-[80px]", formData.seller === s.name ? "text-white" : "text-slate-600")}>
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isSeller && (
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Manual Seller Information Override</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">WhatsApp</label>
                    <input
                      type="text"
                      value={formData.seller_whatsapp}
                      onChange={e => setFormData({ ...formData, seller_whatsapp: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="WhatsApp..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                    <input
                      type="text"
                      value={formData.seller_email}
                      onChange={e => setFormData({ ...formData, seller_email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="Email..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facebook</label>
                    <input
                      type="text"
                      value={formData.seller_facebook}
                      onChange={e => setFormData({ ...formData, seller_facebook: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="Facebook URL..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Instagram</label>
                    <input
                      type="text"
                      value={formData.seller_instagram}
                      onChange={e => setFormData({ ...formData, seller_instagram: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="Instagram URL..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TikTok</label>
                    <input
                      type="text"
                      value={formData.seller_tiktok}
                      onChange={e => setFormData({ ...formData, seller_tiktok: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="TikTok URL..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logo URL</label>
                    <input
                      type="text"
                      value={formData.seller_logo}
                      onChange={e => setFormData({ ...formData, seller_logo: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none text-[10px] font-bold"
                      placeholder="Logo URL..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Stock / Quantity Available</label>
              <input
                required
                type="number"
                min="0"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                placeholder="Number of products in stock..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Units Sold (Initial/Accumulated)</label>
              <input
                required
                type="number"
                min="0"
                value={formData.sold}
                onChange={e => setFormData({ ...formData, sold: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                placeholder="Number of items sold..."
              />
            </div>
          </div>

          {/* Conditional Gadget Specs Panel */}
          {formData.category === 'Gadget' && (
            <div className="bg-white text-slate-800 p-5 rounded-2xl space-y-4 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-brand animate-pulse" />
                <h4 className="text-[11px] font-black uppercase tracking-widest text-brand">Gadget Specification Sheets (Active)</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">RAM Memory (e.g. 8GB, 12GB)</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.ram}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, ram: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 8GB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Storage Capacity (e.g. 256GB)</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.storage}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, storage: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 256GB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Screen Refresh Rate (Hz)</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.refreshRate}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, refreshRate: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 120Hz"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Battery Capacity & Backup</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.battery}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, battery: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 5000 mAh / 10 Hours"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Charger Wattage (W)</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.watt}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, watt: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 67W / 120W"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Current Amperage (Amp)</label>
                  <input
                    type="text"
                    value={formData.gadgetSpecs.amp}
                    onChange={e => setFormData({ 
                      ...formData, 
                      gadgetSpecs: { ...formData.gadgetSpecs, amp: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-xs text-slate-900 font-medium transition-all"
                    placeholder="e.g. 3A / 5A"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Discount Expiration Timer Select */}
          {parseFloat(formData.discount) > 0 && (
            <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-black text-rose-950 uppercase tracking-wider">Discount Mode</h5>
                  <p className="text-xs text-slate-500 leading-normal">Choose if this discount has a time limit or stays persistent.</p>
                </div>
                <div className="flex gap-2 p-1 bg-rose-100/50 rounded-xl max-w-fit">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'permanent', discountExpiresAt: '' })}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                      formData.discountType === 'permanent'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-rose-950 hover:bg-rose-100"
                    )}
                  >
                    Non-Timer
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'timer' })}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                      formData.discountType === 'timer'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-rose-950 hover:bg-rose-100"
                    )}
                  >
                    Timer Limit
                  </button>
                </div>
              </div>

              {formData.discountType === 'timer' && (
                <div className="pt-3 border-t border-rose-100/60 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="space-y-1 text-center md:text-left">
                    <h5 className="text-xs font-black text-rose-950 uppercase tracking-wider">Flash Sale Countdown Timer</h5>
                    <p className="text-xs text-slate-500 leading-normal">Specify the exact target date and time when this discount percentage ends.</p>
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={formData.discountExpiresAt}
                    onChange={e => setFormData({ ...formData, discountExpiresAt: e.target.value })}
                    className="w-full md:w-auto px-4 py-3 rounded-xl bg-white border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm font-semibold text-rose-800 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detailed Description</label>
            <textarea
              required
              rows={5}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium resize-none"
              placeholder="Enter product details..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Main Media Source</label>
            <ImageUploader 
              value={formData.image}
              onChange={(url) => setFormData(prev => ({...prev, image: url}))}
              folder="products"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gallery Sync</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  placeholder="Additional media URL..."
                />
              </div>
              {newImageUrl && (
                <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                   <img 
                    src={newImageUrl} 
                    alt="Preview" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={addExtraImage}
                className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                disabled={!newImageUrl}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {formData.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.images.map((url, index) => (
                  <div key={index} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={url} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExtraImage(index)}
                      className="absolute inset-x-0 bottom-0 bg-red-500 text-white text-[8px] font-black uppercase py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProduct ? 'Update Data' : 'Save Instance'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={productToDelete !== null}
        onClose={() => setProductToDelete(null)}
        title="Delete Product?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you sure you want to permanently delete this product from your inventory registry?
          </p>
          <div className="flex gap-4">
            <button
              onClick={executeDeleteProduct}
              disabled={deletingId !== null}
              className={cn(
                "flex-1 py-3.5 flex items-center justify-center gap-2 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer",
                deletingId !== null ? "bg-red-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 shadow-red-100"
              )}
            >
              {deletingId !== null && <Loader2 className="w-4 h-4 animate-spin" />}
              {deletingId !== null ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              onClick={() => setProductToDelete(null)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Floating Back to Dashboard Button for Better Scrolling UX */}
      {onViewChange && (
        <button 
          onClick={() => onViewChange('dashboard')} 
          className="fixed bottom-6 right-6 z-50 bg-white border border-slate-205 text-slate-700 p-4 rounded-full shadow-2xl hover:bg-slate-50 hover:text-slate-900 transition-all hover:scale-110 flex items-center justify-center cursor-pointer group"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-[124px] transition-all duration-300 font-extrabold text-[10px] uppercase tracking-widest pl-0 group-hover:pl-2 whitespace-nowrap">
            Back to Dashboard
          </span>
        </button>
      )}
    </div>
  );
}
