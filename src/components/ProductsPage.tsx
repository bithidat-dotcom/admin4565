import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { Edit2, Trash2, Loader2, Image as ImageIcon, Plus, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom / Fixed Categories Support
  const [customTypes, setCustomTypes] = useState<string[]>(['Fashion', 'Cloth', 'Laptop', 'Mobile', 'Device', 'Robotic', 'Cosmetic', 'T-Shirts', 'All']);
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    images: [] as string[],
    discount: '0',
    type: '',
    seller: ''
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [filterName, setFilterName] = useState('');

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(filterName.toLowerCase())
  );

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      description: '',
      image: '',
      images: [],
      discount: '0',
      type: '',
      seller: ''
    });
    setEditingProduct(null);
    setNewImageUrl('');
    setShowCustomTypeInput(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
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
      type: product.type || '',
      seller: product.seller || ''
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
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
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
      // NOTE: This assumes RLS policies allow deleting all rows.
      const { error } = await supabase.from('products').delete().neq('id', 'non-existent-id-to-remove-all');
      if (error) throw error;
      setProducts([]);
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      console.error('Error deleting all products:', err);
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

    const payload = {
      name: formData.name,
      price: parseFloat(formData.price),
      image: formData.image,
      images: formData.images,
      discount: parseFloat(formData.discount),
      description: formData.description,
      type: formData.type,
      seller: formData.seller
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload]);
        if (error) throw error;
      }
      
      await fetchProducts();
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueTypes = Array.from(new Set([
    'Fashion',
    'Cloth',
    'Laptop',
    'Mobile',
    'Device',
    'Robotic',
    'Cosmetic',
    'T-Shirts',
    'All',
    ...products.map(p => p.type).filter((t): t is string => !!t && t.trim() !== ''),
    ...customTypes
  ]));

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header 
        title="Products" 
        onAction={handleOpenAddModal} 
        actionLabel="New Product" 
      />
      <div className="px-8 mt-4 flex items-center gap-4">
        <button
          onClick={handleOpenDeleteAllModal}
          className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors"
        >
          Delete All Products
        </button>
        <input 
          type="text" 
          placeholder="Filter by name..." 
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 uppercase tracking-widest"
        />
      </div>

      <main className="p-8 max-w-[1240px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:shadow-lg transition-all duration-500"
              >
                <div className="aspect-square relative overflow-hidden bg-slate-100">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name}
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
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                    <button 
                      onClick={() => handleEdit(product)}
                      className="p-3 bg-white rounded-xl shadow-xl text-brand hover:scale-110 active:scale-95 transition-all"
                      title="Edit Product"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
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
                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                    <span className="text-lg font-black text-slate-900 tracking-tighter">
                      {formatCurrency(product.price)}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          localStorage.setItem('review_product_filter_id', product.id);
                          window.dispatchEvent(new Event('navigate_to_reviews_view'));
                        }}
                        className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline cursor-pointer bg-brand/5 px-2.5 py-1 rounded-lg"
                      >
                        Review
                      </button>
                      <button className="text-[10px] font-black text-[#64748b] uppercase tracking-widest hover:underline">
                        Details
                      </button>
                    </div>
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
          <div className="grid grid-cols-3 gap-4">
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
            <div className="space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product Type</label>
                <button
                  type="button"
                  onClick={() => setShowCustomTypeInput(!showCustomTypeInput)}
                  className="text-brand hover:text-brand-dark flex items-center gap-1 text-[9px] uppercase font-black cursor-pointer bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                >
                  <Plus className="w-3 h-3" /> Custom
                </button>
              </div>
              
              {!showCustomTypeInput ? (
                <select
                  value={formData.type}
                  onChange={e => {
                    if (e.target.value === '__add_custom__') {
                      setShowCustomTypeInput(true);
                    } else {
                      setFormData({ ...formData, type: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium cursor-pointer"
                >
                  <option value="">Select Type...</option>
                  {uniqueTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="__add_custom__" className="text-brand font-bold bg-indigo-50 font-black">+ Create Custom Type...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                    placeholder="Enter custom type..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.type.trim()) {
                        const trimmed = formData.type.trim();
                        if (!customTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
                          setCustomTypes(prev => [...prev, trimmed]);
                        }
                      }
                      setShowCustomTypeInput(false);
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 cursor-pointer"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomTypeInput(false);
                    }}
                    className="px-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seller / Group</label>
              <input
                type="text"
                value={formData.seller}
                onChange={e => setFormData({ ...formData, seller: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                placeholder="Seller Name..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detailed Description</label>
            <textarea
              required
              rows={5}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium resize-none"
              placeholder="Markdown supported..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Main Media Source (URL)</label>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  required
                  type="url"
                  value={formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
                  placeholder="https://..."
                />
              </div>
              {formData.image && (
                <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                  <img 
                    src={formData.image} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>
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
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={addExtraImage}
                className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {formData.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.images.map((url, index) => (
                  <div key={index} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={url} alt="" className="w-full h-full object-cover" />
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
              className="flex-[2] px-6 py-3 rounded-xl bg-brand text-white text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProduct ? 'Update Data' : 'Save Instance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal to avoid window.confirm failures */}
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
