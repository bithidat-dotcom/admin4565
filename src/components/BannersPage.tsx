import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Banner } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import LoadingDots from './LoadingDots';
import { Storage } from '../lib/storage';
import { Trash2, Loader2, Image as ImageIcon, Eye, Megaphone } from 'lucide-react';
import { cn } from '../lib/utils';
import ImageUploader from './ImageUploader';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeBannerId, setActiveBannerId] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Banner[];
      setBanners(bannersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banners');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'banners'), {
        title: title || 'Untitled Banner',
        image: newImageUrl,
        created_at: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setNewImageUrl('');
      setTitle('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'banners');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'banners', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `banners/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Banners" onAction={() => setIsModalOpen(true)} actionLabel="New Banner" />

      <main className="p-4 md:p-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingDots />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
            {banners.map((banner) => (
              <div 
                key={banner.id} 
                onDoubleClick={() => setActiveBannerId(prev => prev === banner.id ? null : banner.id)}
                className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500 cursor-pointer select-none"
                title="Double click on mobile/desktop to reveal controls"
              >
                <div className="aspect-[21/9] bg-slate-50 overflow-hidden flex items-center justify-center relative">
                  {banner.image ? (
                    <img src={banner.image} alt={banner.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-slate-200" />
                  )}
                  <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className={cn(
                  "absolute top-4 right-4 transition-all duration-300 flex flex-col gap-2",
                  activeBannerId === banner.id 
                    ? "translate-y-0 opacity-100 pointer-events-auto" 
                    : "translate-y-2 opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                )}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewBanner(banner);
                    }}
                    className="p-4 bg-white/90 text-slate-800 rounded-2xl shadow-2xl hover:bg-white transition-all hover:scale-110 cursor-pointer"
                    title="Preview banner"
                  >
                     <Eye className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await setDoc(doc(db, 'settings', 'adPopup'), { isActive: true, bannerId: banner.id }, { merge: true });
                        // Clear the seen flag so user can see it right away for verification
                        Storage.removeSmall(`popupSeen_${banner.id}`);
                        alert("Banner published as active Ad Popup! Refresh your app to see the change if needed, or it may appear instantly.");
                      } catch (err) {
                        console.error(err);
                        alert("Failed to set ad popup.");
                      }
                    }}
                    className="p-4 bg-white/90 text-brand rounded-2xl shadow-2xl hover:bg-white transition-all hover:scale-110 cursor-pointer group/megaphone relative"
                    title="Set as popup"
                  >
                    <Megaphone className="w-5 h-5" />
                    <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/megaphone:opacity-100 transition-opacity whitespace-nowrap">SET AS AD POPUP</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(banner.id);
                    }}
                    disabled={deletingId === banner.id}
                    className="p-4 bg-red-500 text-white rounded-2xl shadow-2xl hover:bg-red-600 transition-all hover:scale-110 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                  >
                    {deletingId === banner.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="p-5 flex items-center justify-between bg-white">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                      {banner.title || 'Promotional Slot'}
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
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Banner Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              placeholder="e.g., Summer Sale"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Asset</label>
            <ImageUploader 
              value={newImageUrl}
              onChange={setNewImageUrl}
              folder="banners"
            />
            <p className="text-[10px] text-slate-400 font-semibold italic">* Recommended: 21:9 (Store Header), 9:16 or 4:3 (Ad Popup).</p>
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
              className="flex-[2] px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Asset
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!previewBanner} onClose={() => setPreviewBanner(null)} title={`Preview: ${previewBanner?.title || 'Banner'}`} fullScreen={true}>
        {previewBanner && (
          <div className="w-full h-full flex items-center justify-center">
            <img src={previewBanner.image} alt={previewBanner.title} className="max-w-full max-h-full object-contain rounded-2xl" />
          </div>
        )}
      </Modal>
    </div>
  );
}
