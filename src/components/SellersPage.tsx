import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Seller } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { 
  Edit2, 
  Trash2, 
  Loader2, 
  Mail,
  Facebook,
  Instagram,
  Music,
  Plus,
  Store,
  Phone,
  Image as ImageIcon
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import { cn } from '../lib/utils';

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    whatsapp_number: '',
    email: '',
    facebook: '',
    instagram: '',
    tiktok: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'sellers'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sellersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Seller[];
      
      setSellers(sellersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sellers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      logo: '',
      whatsapp_number: '',
      email: '',
      facebook: '',
      instagram: '',
      tiktok: ''
    });
    setEditingSeller(null);
  };

  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      logo: seller.logo,
      whatsapp_number: seller.whatsapp_number || '',
      email: seller.email || '',
      facebook: seller.facebook || '',
      instagram: seller.instagram || '',
      tiktok: seller.tiktok || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
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

  return (
    <div className="flex-1">
      <Header 
        title="Sellers" 
        onAction={() => { resetForm(); setIsModalOpen(true); }} 
        actionLabel="Add Seller" 
      />

      <main className="p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sellers.map((seller) => (
              <div key={seller.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center group hover:shadow-lg transition-all duration-300">
                <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 overflow-hidden relative">
                  {seller.logo ? (
                    <img src={seller.logo} alt={seller.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg mb-1">{seller.name}</h3>
                
                <div className="flex items-center gap-2 mb-6">
                  {seller.whatsapp_number && (
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100" title="WhatsApp">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {seller.email && (
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100" title="Email">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {seller.facebook && (
                    <div className="w-6.5 h-6.5 p-1 bg-white border border-slate-100 rounded-lg shadow-sm" title="Facebook">
                      <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQm0F2xlq4BO9-4boQ1D9oGwXTiYfW5KcUvew&s" alt="FB" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {seller.instagram && (
                    <div className="w-6.5 h-6.5 p-1 bg-white border border-slate-100 rounded-lg shadow-sm" title="Instagram">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/250px-Instagram_logo_2016.svg.png" alt="IG" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {seller.tiktok && (
                    <div className="w-6.5 h-6.5 p-1 bg-white border border-slate-100 rounded-lg shadow-sm" title="TikTok">
                      <img src="https://sf-static.tiktokcdn.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png" alt="TT" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full mt-auto">
                  <button 
                    onClick={() => handleEdit(seller)}
                    className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(seller.id)}
                    disabled={deletingId === seller.id}
                    className="flex-1 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingId === seller.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {sellers.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Store className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No sellers registered yet</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeller ? 'Edit Seller' : 'New Seller'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seller Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
              placeholder="e.g. Trendy BD"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WhatsApp Number</label>
            <input
              type="text"
              value={formData.whatsapp_number}
              onChange={e => setFormData({ ...formData, whatsapp_number: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
              placeholder="e.g. 01700000000"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address (Optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
                placeholder="e.g. contact@trendybd.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Facebook Link</label>
              <input
                type="url"
                value={formData.facebook}
                onChange={e => setFormData({ ...formData, facebook: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
                placeholder="https://facebook.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instagram Link</label>
              <input
                type="url"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
                placeholder="https://instagram.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TikTok Link</label>
              <input
                type="url"
                value={formData.tiktok}
                onChange={e => setFormData({ ...formData, tiktok: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-sm font-bold uppercase tracking-tight"
                placeholder="https://tiktok.com/@..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seller Logo</label>
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
              className="flex-1 py-3.5 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingSeller ? 'Update' : 'Register'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
