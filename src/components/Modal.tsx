import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, fullScreen = false }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="fixed inset-0 z-[51] flex items-center justify-center pointer-events-none p-4"
          >
            <div className={cn("bg-white rounded-3xl shadow-2xl w-full pointer-events-auto overflow-hidden border border-slate-200/50", fullScreen ? "max-w-5xl h-[90vh]" : "max-w-xl")}>
              <div className="flex items-center justify-between p-8 pb-4 border-b border-slate-50">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Resource Provider Interface</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-90 border border-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
