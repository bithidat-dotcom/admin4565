import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  ExternalLink, 
  Compass, 
  CloudLightning, 
  Info, 
  Image as ImageIcon,
  Loader2,
  FileImage,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LinkConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLink?: (url: string) => void;
}

export default function LinkConverterModal({ isOpen, onClose, onApplyLink }: LinkConverterModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'convert' | 'guide'>('convert');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [base64Url, setBase64Url] = useState<string>('');
  const [cloudUrl, setCloudUrl] = useState<string>('');
  
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedType, setCopiedType] = useState<'base64' | 'cloud' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isShortening, setIsShortening] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setCloudUrl('');
    
    // Generate browser-local object URL for preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Convert to Base64 (Local Direct Link)
    setIsConverting(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const baseString = reader.result as string;
      setBase64Url(baseString);
      setIsConverting(false);
    };
    reader.onerror = () => {
      setBase64Url('');
      setIsConverting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  // Upload anonymously to tmpfiles.org and auto-shorten with TinyURL
  const handleUploadToCloud = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    setCloudUrl('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload returned status ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success' && result.data?.url) {
        // Tmpfiles returns a viewer url like https://tmpfiles.org/12345/filename.png
        // Direct download URL is https://tmpfiles.org/dl/12345/filename.png
        const rawUrl = result.data.url;
        const directUrl = rawUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        
        // Auto-shorten with TinyURL API to provide "more small name" URL instantly
        try {
          setIsShortening(true);
          const shortRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(directUrl)}`);
          if (shortRes.ok) {
            const shortText = await shortRes.text();
            if (shortText && shortText.startsWith('http')) {
              setCloudUrl(shortText);
              setIsShortening(false);
              return;
            }
          }
        } catch (shortErr) {
          console.error("Auto shortening via TinyURL failed, using original direct link:", shortErr);
        } finally {
          setIsShortening(false);
        }

        setCloudUrl(directUrl);
      } else {
        throw new Error('Could not retrieve URL from hosting response.');
      }
    } catch (err: any) {
      console.error('Error uploading to tmpfiles:', err);
      // Fallback: try file.io
      try {
        console.log('Trying fallback file.io...');
        const fmData = new FormData();
        fmData.append('file', selectedFile);
        const res = await fetch('https://file.io/?expires=1d', {
          method: 'POST',
          body: fmData,
        });
        if (res.ok) {
          const fallbackRes = await res.json();
          if (fallbackRes.success && fallbackRes.link) {
            const rawLink = fallbackRes.link;
            try {
              setIsShortening(true);
              const fallbackShort = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(rawLink)}`);
              if (fallbackShort.ok) {
                const shortText = await fallbackShort.text();
                if (shortText && shortText.startsWith('http')) {
                  setCloudUrl(shortText);
                  setIsShortening(false);
                  return;
                }
              }
            } catch (sE) {
              console.error("Fallback shortening failed:", sE);
            } finally {
              setIsShortening(false);
            }
            setCloudUrl(rawLink);
            return;
          }
        }
      } catch (fErr) {
        console.error('Fallback failed too:', fErr);
      }
      setUploadError('Anonymous upload failed. Use Base64 or one of our free external hosting guides below!');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'base64' | 'cloud') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleApply = (url: string) => {
    if (onApplyLink) {
      onApplyLink(url);
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setBase64Url('');
    setCloudUrl('');
    setUploadError(null);
  };

  const suggestedSites = [
    {
      name: 'ImgBB Free Hosting',
      desc: 'Highly reliable with direct image links. No account required.',
      url: 'https://imgbb.com/',
      tip: 'Upload, then choose "Direct links" from the dropdown.'
    },
    {
      name: 'Postimages',
      desc: 'Super fast permanent image hosting. Great for banners & cards.',
      url: 'https://postimages.org/',
      tip: 'Select "Direct Link" and paste the copied URL.'
    },
    {
      name: 'Imgur',
      desc: 'The internet standard for community uploads and sharing.',
      url: 'https://imgur.com/upload',
      tip: 'Upload, right-click the image, and choose "Copy Image Address".'
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
              <h3 className="font-black text-slate-950 text-lg uppercase tracking-tight flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-brand" />
                Image To Link Converter
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Convert your photos into permanent, high-speed direct links
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('convert')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeSubTab === 'convert' 
                ? "bg-slate-900 border border-slate-900 text-white shadow-md shadow-slate-200" 
                : "text-slate-500 hover:bg-slate-100 border border-transparent"
            )}
          >
            <CloudLightning className="w-3.5 h-3.5" />
            Direct Converter
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('guide')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeSubTab === 'guide' 
                ? "bg-slate-900 border border-slate-900 text-white shadow-md shadow-slate-200" 
                : "text-slate-500 hover:bg-slate-100 border border-transparent"
            )}
          >
            <Compass className="w-3.5 h-3.5" />
            Free Web Hosts Guide
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeSubTab === 'convert' ? (
            <div className="space-y-6">
              {!selectedFile ? (
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-brand/50 hover:bg-slate-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4 transition-all cursor-pointer group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:scale-105 transition-transform duration-300 flex items-center justify-center border border-indigo-100">
                    <Upload className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Select or drop your gallery image
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Works with JPG, PNG, WEBP, and GIF formats.
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-white bg-slate-900 uppercase tracking-widest px-4 py-1.5 rounded-full leading-none group-hover:bg-brand transition-colors">
                    Browse Files
                  </span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* File Metadata & Preview */}
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-150">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-sm">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 truncate uppercase mt-0.5">{selectedFile.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleClear}
                      className="text-xs font-black uppercase text-red-500 hover:text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl transition-all"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Converter Outputs */}
                  <div className="space-y-4">
                    {/* OPTION 1: Base64 */}
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black bg-indigo-50 border border-indigo-100 text-indigo-600 uppercase tracking-widest px-2.5 py-1 rounded-full">
                            Method 1 (Instant)
                          </span>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Offline Data URI (Base64)</h4>
                        </div>
                        {base64Url && (
                          <div className="flex items-center gap-2">
                            {onApplyLink && (
                              <button
                                type="button"
                                onClick={() => handleApply(base64Url)}
                                className="text-[10px] font-bold uppercase tracking-wider bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-all flex items-center gap-1"
                              >
                                Apply Direct
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(base64Url, 'base64')}
                              className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1"
                            >
                              {copiedType === 'base64' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {copiedType === 'base64' ? 'Copied' : 'Copy Link'}
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Convert your image into a direct, inline Base64 data string. It works offline instantly and does not rely on foreign cloud storage.
                      </p>
                      {isConverting ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 py-2">
                          <Loader2 className="w-4 h-4 text-brand animate-spin" />
                          Processing direct local link...
                        </div>
                      ) : (
                        base64Url && (
                          <div className="bg-slate-50 rounded-xl px-4 py-3 font-mono text-xs text-slate-500 break-all max-h-16 overflow-y-auto border border-slate-100">
                            {base64Url}
                          </div>
                        )
                      )}
                    </div>

                    {/* OPTION 2: Temporary Cloud Upload */}
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black bg-emerald-50 border border-emerald-100 text-emerald-600 uppercase tracking-widest px-2.5 py-1 rounded-full">
                            Method 2 (Cloud)
                          </span>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Anonymous Host Link</h4>
                        </div>
                        {cloudUrl && (
                          <div className="flex items-center gap-2">
                            {onApplyLink && (
                              <button
                                type="button"
                                onClick={() => handleApply(cloudUrl)}
                                className="text-[10px] font-bold uppercase tracking-wider bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-all flex items-center gap-1"
                              >
                                Apply Direct
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(cloudUrl, 'cloud')}
                              className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1"
                            >
                              {copiedType === 'cloud' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {copiedType === 'cloud' ? 'Copied' : 'Copy Link'}
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Upload to anonymous temporary web storage. Returns a neat direct image address (expires after 1 day). 
                      </p>
                      
                      {!cloudUrl && !isUploading && (
                        <button
                          type="button"
                          onClick={handleUploadToCloud}
                          className="text-[11px] font-black uppercase tracking-wider bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2 mt-2"
                        >
                          <CloudLightning className="w-3.5 h-3.5 text-brand" />
                          Upload to Anonymous Cloud
                        </button>
                      )}

                       {isUploading && (
                        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500 py-3">
                          <Loader2 className="w-4 h-4 text-brand animate-spin" />
                          Uploading securely to temporary folder... Please wait
                        </div>
                      )}

                      {isShortening && (
                        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500 py-3">
                          <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                          Generating shortened TinyURL... More small name active!
                        </div>
                      )}

                      {cloudUrl && (
                        <div className="bg-slate-50 rounded-xl px-4 py-3 font-mono text-xs text-brand-dark font-black break-all border border-slate-100 flex items-center justify-between gap-4">
                          <span className="truncate">{cloudUrl}</span>
                          <a href={cloudUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-600 shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      {uploadError && (
                        <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-medium flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-5 text-brand shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-black text-indigo-950 uppercase tracking-wider">Permanent Solution (Recommended)</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    If you want your store pictures to never expire, online free hosters like <strong>ImgBB</strong> or <strong>Postimages</strong> provide completely free permanent storage. Use any of the trustworthy site portals below:
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {suggestedSites.map((site) => (
                  <div key={site.name} className="p-5 border border-slate-200 rounded-2xl flex items-start justify-between gap-4 hover:border-slate-300 hover:bg-slate-50/50 transition-all">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{site.name}</h4>
                      <p className="text-xs text-slate-500">{site.desc}</p>
                      <div className="inline-block mt-2 bg-indigo-50/60 border border-indigo-100/50 px-2.5 py-0.5 rounded text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                        Tip: {site.tip}
                      </div>
                    </div>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black uppercase text-indigo-600 hover:text-indigo-700 bg-white border border-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      Open Site
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>

              {/* Instructions on how to get Direct link */}
              <div className="border border-slate-200 bg-slate-50 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase mb-2">How to fetch the Direct Link:</h4>
                <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li>Click one of the <strong>Open Site</strong> buttons above (e.g. ImgBB).</li>
                  <li>Upload your desired gallery image.</li>
                  <li>On the upload complete screen, look for the dropdown menu labeled <strong>Embed codes</strong>.</li>
                  <li>Select <strong>Direct link</strong> (it must start with <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">https://i.ibb.co/</code> or look like an image extension like <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">.png</code> / <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">.jpg</code>).</li>
                  <li>Copy that URL, return here, and paste it directly into input.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand" />
            Designed for BAZER_BD Merchant Dashboard
          </span>
          <button 
            type="button"
            onClick={onClose}
            className="text-xs font-extrabold uppercase text-slate-700 bg-white border border-slate-200 px-5  py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
