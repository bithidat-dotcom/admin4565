import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Banner } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { 
  Trash2, 
  Loader2, 
  Image as ImageIcon, 
  Megaphone, 
  ExternalLink, 
  Sparkles, 
  Film, 
  CheckCircle,
  HelpCircle,
  Video
} from 'lucide-react';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  
  // Promotional Ads details state
  const [isAd, setIsAd] = useState(false);
  const [adLink, setAdLink] = useState('');
  const [adTitle, setAdTitle] = useState('');
  
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
      // 1. Attempt insertion with the newly introduced campaign/Ad columns
      const { error } = await supabase
        .from('banners')
        .insert([{ 
          image: newImageUrl,
          is_ad: isAd,
          ad_link: isAd ? (adLink.trim() || null) : null,
          ad_title: isAd ? (adTitle.trim() || null) : null
        }]);
      
      if (error) {
        // Check if error is due to missing columns (PostgREST PGRST204 / PGRST200 or code '42703' for undefined_column)
        const isColumnError = error.code === 'PGRST204' || 
                             error.message?.includes('column') || 
                             (error as any).details?.includes('column');
        
        if (isColumnError) {
          console.warn('New ad columns missing in database. Falling back to standard image banner:', error);
          
          // 2. Resilient Fallback: Insert standard banner with image only
          const { error: fallbackError } = await supabase
            .from('banners')
            .insert([{ image: newImageUrl }]);
            
          if (fallbackError) throw fallbackError;
          
          alert('Standard Banner published! Note: To use advanced clickable Ad Campaign links and video titles, copy and run the latest SQL table schema from `/supabase_schema.sql` in your Supabase SQL Editor.');
        } else {
          throw error;
        }
      }
      
      await fetchBanners();
      setIsModalOpen(false);
      
      // Reset inputs
      setNewImageUrl('');
      setIsAd(false);
      setAdLink('');
      setAdTitle('');
    } catch (err: any) {
      console.error('Error adding banner:', err);
      alert(`Failed to add banner: ${err.message || 'Unknown error'}`);
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

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/) || 
           lower.includes('youtube.com/') || 
           lower.includes('youtu.be/') || 
           lower.includes('vimeo.com/');
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.includes('youtube.com/watch')) {
        const videoId = new URL(url).searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
      }
      if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
      }
      if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        return `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&background=1`;
      }
    } catch (e) {
      console.warn('URL parsing failed. Returning default URL', e);
    }
    return url;
  };

  const isDirectVideo = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/) !== null;
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Banners" onAction={() => setIsModalOpen(true)} actionLabel="New Banner" />

      <main className="p-8 max-w-[1240px] space-y-6">
        
        {/* Marketing Info Strip */}
        <div className="p-5 bg-indigo-50 border border-indigo-200/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500 rounded-xl text-white">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Dynamic Ad Campaigns</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Elevate user session CTR by hosting auto-play video banners, custom sponsors, and clickable dynamic links.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {banners.map((banner) => {
              const isVid = isVideoUrl(banner.image);
              return (
                <div 
                  key={banner.id} 
                  className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500 flex flex-col justify-between"
                >
                  {/* Media Preview Box */}
                  <div className="aspect-[21/9] bg-slate-50 overflow-hidden flex items-center justify-center relative">
                    {banner.image ? (
                      isVid ? (
                        isDirectVideo(banner.image) ? (
                          <video 
                            src={banner.image} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                          />
                        ) : (
                          <iframe 
                            src={getEmbedUrl(banner.image)} 
                            title="Banner Video Player" 
                            className="w-full h-full object-cover scale-110 pointer-events-none" 
                            frameBorder="0" 
                            allow="autoplay; fullscreen; picture-in-picture" 
                            allowFullScreen
                          />
                        )
                      ) : (
                        <img src={banner.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                      )
                    ) : (
                      <ImageIcon className="w-12 h-12 text-slate-200" />
                    )}

                    {/* Left overlay badge if is an Ad or Video */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {banner.is_ad && (
                        <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-white" />
                          Promo AD
                        </span>
                      )}
                      {isVid && (
                        <span className="px-2.5 py-1 bg-indigo-650 bg-indigo-650/90 text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          Video Broadcast
                        </span>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  
                  {/* Delete hovering top action handle */}
                  <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleDelete(banner.id)}
                      disabled={deletingId === banner.id}
                      className="p-3.5 bg-red-500 text-white rounded-xl shadow-2xl hover:bg-red-650 hover:bg-red-600 transition-all hover:scale-110 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                    >
                      {deletingId === banner.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Body Info Panel: Advertising Redirection options summary */}
                  <div className="p-5 space-y-4 bg-white border-t border-slate-100">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {banner.is_ad && banner.ad_title ? (
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                            🎯 {banner.ad_title}
                          </h3>
                        ) : (
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            Standard Retail Banner
                          </p>
                        )}
                        <p className="text-[10px] font-medium text-slate-500 truncate mt-1">
                          Media Code: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">{banner.id.slice(0, 16)}</code>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest">
                          Active Ready
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold mt-1.5">
                          {new Date(banner.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons layer for advertisement testing and clicking */}
                    {banner.is_ad && banner.ad_link && (
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                        <div className="overflow-hidden">
                          <p className="text-[8px] font-black text-[#94a3b8] uppercase tracking-widest">Ad Destination Link</p>
                          <p className="text-[11px] font-bold text-slate-600 hover:underline truncate" title={banner.ad_link}>
                            {banner.ad_link}
                          </p>
                        </div>
                        <a 
                          href={banner.ad_link} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black uppercase text-[9px] tracking-widest flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
                        >
                          <span>Open Ad</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Provision New Banner / Campaign AD">
        <form onSubmit={handleAddBanner} className="space-y-5 font-sans">
          
          {/* Main asset link */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Asset Media URL</label>
            <input
              required
              type="url"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-xs font-bold text-slate-700"
              placeholder="https://images.unsplash.com/... or MP4 video URL"
            />
            <p className="text-[9px] text-[#94a3b8] font-semibold italic">
              * Supports standard high-definition JPG/PNG links, MP4 video links, YouTube video watch, or Vimeo links!
            </p>
          </div>

          {/* Ad Checkbox options */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-brand" />
                  Enable Ad Marketing Redirection
                </label>
                <p className="text-[9px] text-slate-400 font-semibold">Make this slot a clickable promotion with call-to-action details</p>
              </div>
              <input
                type="checkbox"
                checked={isAd}
                onChange={e => setIsAd(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                id="is-ad-toggle"
              />
            </div>

            {isAd && (
              <div className="space-y-3 pt-2 border-t border-slate-200/60 animate-fade-in">
                {/* Ad Title */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Campaign Title / CTA Label</label>
                  <input
                    required={isAd}
                    type="text"
                    value={adTitle}
                    onChange={e => setAdTitle(e.target.value)}
                    placeholder="e.g. Eid Mega Sale! Click to Save 25%"
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
                  />
                </div>

                {/* Ad Link */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Ad Redirection URL</label>
                  <input
                    required={isAd}
                    type="url"
                    value={adLink}
                    onChange={e => setAdLink(e.target.value)}
                    placeholder="e.g. https://www.yourshop.com/collections/sale"
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 cursor-pointer"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-6 py-3 rounded-xl bg-brand text-white text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Asset / Campaign
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
