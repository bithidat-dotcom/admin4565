import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Loader2, Upload, Link as LinkIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder: 'products' | 'banners';
  className?: string;
}

export default function ImageUploader({ value, onChange, folder, className }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'gallery'>('url');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      onChange(downloadURL);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={cn(
            "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-all",
            activeTab === 'url' ? "bg-white shadow-sm text-brand" : "text-slate-400 hover:text-slate-600"
          )}
        >
          URL Input
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className={cn(
            "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-all",
            activeTab === 'gallery' ? "bg-white shadow-sm text-brand" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Gallery Upload
        </button>
      </div>

      {activeTab === 'url' ? (
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm font-medium"
          placeholder="https://..."
        />
      ) : (
        <label className="block w-full h-32 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand/50 hover:bg-slate-50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-300" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </>
          )}
        </label>
      )}

      {value && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm rounded-full text-slate-500 hover:text-red-500 shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
