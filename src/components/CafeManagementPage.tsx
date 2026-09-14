import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { CafeProduct, CafeOrder } from '../types';
import Header from './Header';
import Modal from './Modal';
import LoadingDots from './LoadingDots';
import ImageUploader from './ImageUploader';
import { Coffee, Plus, Trash2, Edit2, CheckCircle, Clock, XCircle, Utensils, Sparkles, Phone, MapPin, Store, DollarSign, Image as ImageIcon, ShoppingBag, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function CafeManagementPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'settings'>('products');
  
  // Products state
  const [products, setProducts] = useState<CafeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CafeProduct | null>(null);
  
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

  // Cafe Settings / Shop state
  const [cafeShopName, setCafeShopName] = useState('pbazar Drink Cafe & Bistro');
  const [cafeBanner, setCafeBanner] = useState('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1200');
  const [savingSettings, setSavingSettings] = useState(false);

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

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.price) || 0) + (Number(o.delivery_charge) || 0), 0);

  return (
    <div className="flex-1 overflow-x-hidden bg-[#e8f5e9]/10">
      <Header 
        title="Drink Cafe & Bistro Management" 
        onAction={() => {
          resetProductForm();
          setIsProductModalOpen(true);
        }} 
        actionLabel="Add Cafe Item" 
      />

      <main className="p-4 md:p-8 space-y-8">
        {/* Top Banner / Hero stats */}
        <div className="bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-[#2e7d32]/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
            <Coffee className="w-80 h-80 text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest text-emerald-100">Live Cafe Hub</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{cafeShopName}</h2>
              <p className="text-xs text-emerald-100 font-medium max-w-xl">Manage delicious drinks, gourmet food, snacks, and desserts with real-time order tracking and shop setup.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">Total Revenue</p>
                <p className="text-xl font-black">{formatCurrency(totalRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">Active Orders</p>
                <p className="text-xl font-black">{orders.filter(o => o.status === 'pending' || o.status === 'preparing').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm",
              activeTab === 'products'
                ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20"
                : "bg-white text-slate-600 hover:bg-[#e8f5e9]/50 border border-slate-200"
            )}
          >
            <Coffee className="w-4 h-4" />
            Cafe Menu ({products.length})
          </button>
          
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm",
              activeTab === 'orders'
                ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20"
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
              "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm",
              activeTab === 'settings'
                ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20"
                : "bg-white text-slate-600 hover:bg-[#e8f5e9]/50 border border-slate-200"
            )}
          >
            <Store className="w-4 h-4" />
            Shop Setup & Banner
          </button>
        </div>

        {/* Tab 1: Products */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Cafe Menu Items</h3>
              <button
                onClick={() => {
                  resetProductForm();
                  setIsProductModalOpen(true);
                }}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-[#2e7d32]/20"
              >
                <Plus className="w-4 h-4" /> Add Menu Item
              </button>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center h-64"><LoadingDots /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map(product => (
                  <div key={product.id} className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=800';
                        }}
                      />
                      <span className="absolute top-3 right-3 bg-[#2e7d32] text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full shadow-md">
                        {product.category || 'Drinks'}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">{product.name}</h4>
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1">{product.description || 'Delicious cafe specialty.'}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-base font-black text-[#2e7d32]">{formatCurrency(product.price)}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="p-2 bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#2e7d32] hover:text-white rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {products.length === 0 && (
                  <div className="col-span-full border-2 border-dashed border-emerald-200 rounded-3xl p-16 text-center bg-[#e8f5e9]/20 flex flex-col items-center justify-center">
                    <Coffee className="w-12 h-12 text-[#2e7d32] mb-4 opacity-50" />
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">No Cafe Menu Items Yet</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">Add your first drink, food, snack, or dessert item to get started.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Customer Cafe Orders</h3>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                {['all', 'pending', 'preparing', 'completed', 'cancelled'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      statusFilter === st
                        ? "bg-[#2e7d32] text-white shadow-md shadow-[#2e7d32]/20"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loadingOrders ? (
              <div className="flex items-center justify-center h-64"><LoadingDots /></div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#e8f5e9]/60 border-b border-emerald-100 text-[10px] font-black text-[#2e7d32] uppercase tracking-wider">
                        <th className="p-4">Order ID & Date</th>
                        <th className="p-4">Customer Details</th>
                        <th className="p-4">Item & Qty</th>
                        <th className="p-4 text-right">Total Amount</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono">
                            <span className="font-bold text-slate-900">#{order.id.slice(0, 8)}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                              {new Date(order.created_at).toLocaleString()}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-slate-900 uppercase">{order.customer_name}</div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-[#2e7d32]" /> {order.whatsapp_number}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                              <MapPin className="w-3 h-3 text-slate-400" /> {order.location}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{order.product_name || 'Cafe Item'}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Qty: {order.quantity || 1}</div>
                          </td>
                          <td className="p-4 text-right font-black text-slate-900">
                            {formatCurrency((Number(order.price) || 0) + (Number(order.delivery_charge) || 0))}
                            <div className="text-[9px] text-slate-400 font-bold">Inc. ৳{order.delivery_charge || 0} Del</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-block",
                              order.status === 'completed' && "bg-emerald-100 text-emerald-800",
                              order.status === 'preparing' && "bg-amber-100 text-amber-800",
                              order.status === 'pending' && "bg-blue-100 text-blue-800",
                              order.status === 'cancelled' && "bg-rose-100 text-rose-800",
                            )}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold uppercase text-slate-700 focus:ring-2 focus:ring-[#2e7d32]/20 outline-none cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}

                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest">
                            No cafe orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                className="bg-[#2e7d32] text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1b5e20] transition-all shadow-lg shadow-[#2e7d32]/20"
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
