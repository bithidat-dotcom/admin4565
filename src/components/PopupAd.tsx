import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isQuotaExceeded } from '../lib/firebase';
import { Storage } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Banner } from '../types';

export default function PopupAd() {
  const [show, setShow] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [currentAdId, setCurrentAdId] = useState<string | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isQuotaExceeded()) return;
    
    // Reset image loaded state when banner changes
    setImageLoaded(false);
    
    // Listen for ad settings changes
    const unsubscribe = onSnapshot(doc(db, 'settings', 'adPopup'), async (snapshot) => {
      if (snapshot.exists()) {
        const adData = snapshot.data() as { isActive: boolean; bannerId: string };
        
        if (adData.isActive && adData.bannerId) {
          // If the banner ID changed, or it hasn't been seen yet
          const seenKey = `popupSeen_${adData.bannerId}`;
          const hasSeen = Storage.getSmall(seenKey);

          if (adData.bannerId !== currentAdId || !hasSeen) {
            const bannerDoc = await getDoc(doc(db, 'banners', adData.bannerId));
            if (bannerDoc.exists()) {
              setBanner({ id: bannerDoc.id, ...bannerDoc.data() } as Banner);
              setCurrentAdId(adData.bannerId);
              setShow(true);
              Storage.setSmall(seenKey, 'true');
              
              // Auto-hide after 3 seconds as requested
              setTimeout(() => {
                setShow(false);
              }, 3000);
            }
          }
        } else {
          setShow(false);
        }
      }
    });

    return () => unsubscribe();
  }, [currentAdId]);

  if (!show || !banner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Close button always visible */}
          <button 
            onClick={() => setShow(false)}
            className="absolute top-4 right-4 z-20 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative overflow-hidden flex items-center justify-center bg-slate-900">
            <img 
              src={banner.image} 
              alt={banner.title} 
              className="w-full h-auto object-contain max-h-[80vh]"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
