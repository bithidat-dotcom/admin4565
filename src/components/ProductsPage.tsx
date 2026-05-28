import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { Product } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { 
  Edit2, 
  Trash2, 
  Loader2, 
  Image as ImageIcon, 
  Plus,
  Sparkles, 
  Pizza, 
  Crown, 
  Smartphone, 
  Bot, 
  Laptop, 
  Layers, 
  Dumbbell, 
  ShoppingBasket,
  Boxes
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import { formatCurrency, cn } from '../lib/utils';

interface ProductsPageProps {
  defaultCategory?: string;
  onCategoryFilterChange?: (category: string) => void;
}

const categoryFilters = [
  { name: 'All', icon: Boxes },
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

export default function ProductsPage({ defaultCategory = 'All', onCategoryFilterChange }: ProductsPageProps = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    images: [] as string[],
    discount: '0',
    seller: '',
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
    discountType: 'permanent' as 'permanent' | 'timer'
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState(defaultCategory);

  const categories = ['Food', 'Fashion', 'Gadget', 'Robotic', 'PC', 'Cloth', 'Sports', 'Grocery'];

  useEffect(() => {
    setFilterCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    onCategoryFilterChange?.(filterCategory);
  }, [filterCategory, onCategoryFilterChange]);

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(filterName.toLowerCase()) &&
    (filterCategory === 'All' || product.category === filterCategory)
  );

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Product[];
      
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      description: '',
      image: '',
      images: [],
      discount: '0',
      seller: '',
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
      discountType: 'permanent'
    });
    setEditingProduct(null);
    setNewImageUrl('');
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
      discountType: product.discountExpiresAt ? 'timer' : 'permanent'
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
    setProductToDelete(null);
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
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
      discountExpiresAt: (parseFloat(formData.discount) > 0 && formData.discountType === 'timer') ? formData.discountExpiresAt : ''
    };

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
      />

      {/* Category Quick Filter Bar */}
      <div className="px-4 md:px-8 mt-4">
        <div className="bg-white/75 p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              Category Registry Shortcuts
            </h4>
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
        <button
          onClick={handleOpenDeleteAllModal}
          className="px-4 py-3 sm:py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors shrink-0 text-center"
        >
          Delete All Products
        </button>
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
      </div>

      <main className="p-4 md:p-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                onClick={() => setActiveProductId(prev => prev === product.id ? null : product.id)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:shadow-lg transition-all duration-500 cursor-pointer"
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
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase">
                      -{product.discount}%
                    </div>
                  )}
                  <div className={cn(
                    "absolute inset-0 bg-slate-900/60 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]",
                    activeProductId === product.id 
                      ? "opacity-100 pointer-events-auto" 
                      : "opacity-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                  )}>
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
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SKU: {product.id.slice(0, 8)}</div>
                  <h3 className="font-bold text-slate-900 line-clamp-1 text-sm uppercase">{product.name}</h3>
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
                    <div className="mt-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tight">
                      Seller: {product.seller}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                    <span className="text-lg font-black text-slate-900 tracking-tighter">
                      {formatCurrency(product.price)}
                    </span>
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
          
          <div className="grid grid-cols-4 gap-4">
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seller Name</label>
              <input
                type="text"
                value={formData.seller}
                onChange={e => setFormData({ ...formData, seller: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                placeholder="Seller Name..."
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
              className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-100 cursor-pointer"
            >
              Yes, Delete
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
    </div>
  );
}
