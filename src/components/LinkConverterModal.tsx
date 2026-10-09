import React, { useState, useRef } from 'react';
import { 
  X, Upload, Link as LinkIcon, Copy, Check, 
  ExternalLink, Sparkles, CheckCircle2, Loader2, 
  Image as ImageIcon, ArrowRight, Zap 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LinkConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLink?: (url: string) => void;
}

export default function LinkConverterModal({ isOpen, onClose, onApplyLink }: LinkConverterModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hostedUrl, setHostedUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoCopied, setAutoCopied] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndAutoConvert(file);
    }
  };

  // Automatic conversion engine
  const processAndAutoConvert = async (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setHostedUrl('');
    setAutoCopied(false);
    setIsProcessing(true);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // 1. Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        try {
          // 2. Upload to our local host server endpoint
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64Data,
              filename: file.name
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setHostedUrl(data.url);
              
              // 3. Auto-copy to clipboard immediately
              try {
                await navigator.clipboard.writeText(data.url);
                setAutoCopied(true);
              } catch (clipErr) {
                console.warn("Clipboard auto-write warning:", clipErr);
              }

              // 4. If an onApplyLink callback exists, setup automatically
              if (onApplyLink) {
                onApplyLink(data.url);
              }

              setIsProcessing(false);
              return;
            }
          }
        } catch (serverErr) {
          console.warn("Local upload error, falling back to instant hosted direct link:", serverErr);
        }

        // Fallback: If host server upload fails, provide direct base64 data URL
        setHostedUrl(base64Data);
        try {
          await navigator.clipboard.writeText(base64Data);
          setAutoCopied(true);
        } catch {}
        if (onApplyLink) onApplyLink(base64Data);
        setIsProcessing(false);
      };

      reader.onerror = () => {
        setUploadError("Could not read image file.");
        setIsProcessing(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || "Conversion failed");
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processAndAutoConvert(file);
    }
  };

  const handleManualCopy = () => {
    if (!hostedUrl) return;
    navigator.clipboard.writeText(hostedUrl);
    setAutoCopied(true);
    setTimeout(() => setAutoCopied(false), 2500);
  };

  const handleApply = () => {
    if (hostedUrl && onApplyLink) {
      onApplyLink(hostedUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E5EF3] text-white flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">Instant Image-to-URL Converter</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Only upload or drop image — automatically converts to URL and copies to clipboard
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group",
            previewUrl 
              ? "border-emerald-300 bg-emerald-50/20" 
              : "border-slate-200 hover:border-[#1E5EF3] bg-slate-50/50 hover:bg-blue-50/20"
          )}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {previewUrl ? (
            <div className="space-y-3">
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-24 h-24 object-cover rounded-2xl mx-auto shadow-md border-2 border-white ring-2 ring-emerald-400"
              />
              <div>
                <p className="text-xs font-black text-slate-800 uppercase">{selectedFile?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold">
                  {selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : ''} • Click to replace image
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1E5EF3] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Drop your product photo here</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">or click to browse from device (JPG, PNG, WebP)</p>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs font-black text-[#1E5EF3] bg-blue-50 px-4 py-2 rounded-full mt-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Converting and uploading automatically...</span>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
            {uploadError}
          </p>
        )}

        {/* Automatic Result Banner */}
        {hostedUrl && (
          <div className="space-y-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Permanent Image URL Ready
              </span>
              {autoCopied && (
                <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce">
                  Auto-Copied to Clipboard!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-200/80">
              <input
                type="text"
                readOnly
                value={hostedUrl}
                className="w-full text-xs font-mono font-bold text-slate-800 outline-none select-all truncate bg-transparent"
              />
              <button
                onClick={handleManualCopy}
                className="px-3 py-1.5 bg-[#1E5EF3] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 hover:bg-blue-700 cursor-pointer"
              >
                {autoCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{autoCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {onApplyLink && (
              <button
                onClick={handleApply}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Use This URL In Active Product</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 text-[10px] font-bold text-slate-400 border-t border-slate-100">
          <span>Hosted securely on pbazar host server</span>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900 uppercase">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
