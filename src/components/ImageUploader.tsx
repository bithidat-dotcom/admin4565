import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Loader2, Upload, Link as LinkIcon, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import LinkConverterModal from './LinkConverterModal';
import imageCompression from 'browser-image-compression';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder: 'products' | 'banners' | 'sellers';
  className?: string;
}

export default function ImageUploader({ value, onChange, folder, className }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'gallery'>('url');
  const [isConverterOpen, setIsConverterOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Image compression logic
      const options = {
        maxSizeMB: 0.5, // Max 500KB
        maxWidthOrHeight: 1280,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(storageRef);
      onChange(downloadURL);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload image. Please try again. Try using the Link Converter button above for easy alternatives.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex-1 flex p-1 bg-slate-100 rounded-lg shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={cn(
              "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-all cursor-pointer",
              activeTab === 'url' ? "bg-white shadow-sm text-brand" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Direct Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={cn(
              "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-all cursor-pointer",
              activeTab === 'gallery' ? "bg-white shadow-sm text-brand" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Instant Upload
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsConverterOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white hover:bg-brand-dark rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shrink-0 shadow-lg shadow-brand/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          Easy Converter
        </button>
      </div>

      {activeTab === 'url' ? (
        <div className="relative">
            <input
              type="url"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
              placeholder="Paste image link here (https://...)"
            />
            {value && <LinkIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand/40" />}
        </div>
      ) : (
        <label className="group block w-full h-32 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand/50 hover:bg-brand-light/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden relative">
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
                <span className="text-[10px] font-black text-brand uppercase tracking-widest">Optimizing Image...</span>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-50 rounded-full group-hover:bg-brand-light transition-colors">
                <Upload className="w-6 h-6 text-slate-300 group-hover:text-brand" />
              </div>
              <span className="text-[10px] font-black text-slate-400 group-hover:text-brand uppercase tracking-widest">Tap to Upload Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </>
          )}
        </label>
      )}

      {value && (
        <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100/50 shadow-inner group">
          <img 
            src={value} 
            alt="Preview" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-slate-500 hover:text-rose-500 shadow-lg hover:shadow-rose-100 transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <LinkConverterModal 
        isOpen={isConverterOpen} 
        onClose={() => setIsConverterOpen(false)} 
        onApplyLink={onChange} 
      />
    </div>
  );
}
