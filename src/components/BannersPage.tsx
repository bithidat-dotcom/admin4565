import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Banner } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { Trash2, Loader2, Image as ImageIcon } from 'lucide-react';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('banners')
        .insert([{ image: newImageUrl }]);
      
      if (error) throw error;
      await fetchBanners();
      setIsModalOpen(false);
      setNewImageUrl('');
    } catch (err) {
      console.error('Error adding banner:', err);
      alert('Failed to add banner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setBanners(banners.filter(b => b.id !== id));
    } catch (err) {
      console.error('Error deleting banner:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Banners" onAction={() => setIsModalOpen(true)} actionLabel="New Banner" />

      <main className="p-8 max-w-[1240px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {banners.map((banner) => (
              <div 
                key={banner.id} 
                className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500"
              >
                <div className="aspect-[21/9] bg-slate-50 overflow-hidden flex items-center justify-center relative">
                  {banner.image ? (
                    <img src={banner.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-slate-200" />
                  )}
                  <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleDelete(banner.id)}
                    disabled={deletingId === banner.id}
                    className="p-4 bg-red-500 text-white rounded-2xl shadow-2xl hover:bg-red-600 transition-all hover:scale-110 disabled:opacity-50 disabled:scale-100"
                  >
                    {deletingId === banner.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="p-5 flex items-center justify-between bg-white">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                      Promotional Slot
                    </p>
                    <p className="text-xs font-bold text-slate-600">
                      Sync ID: {banner.id.slice(0, 12)}
                    </p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-brand uppercase tracking-widest">
                      Status: Active
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">
                       {new Date(banner.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {banners.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 mb-6 font-black text-2xl">
                  +
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">No Active Banners</p>
                <p className="text-xs font-bold text-slate-400">Your storefront promotional area is currently empty.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Provision New Banner">
        <form onSubmit={handleAddBanner} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Asset URL</label>
            <input
              required
              type="url"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              className="w-full px-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              placeholder="https://..."
            />
            <p className="text-[10px] text-slate-400 font-semibold italic">* Recommended aspect ratio: 21:9 for best visual performance.</p>
          </div>
          
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-6 py-3 rounded-xl bg-brand text-white text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Asset
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
