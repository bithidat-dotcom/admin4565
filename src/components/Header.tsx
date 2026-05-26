import React from 'react';
import { Plus, Search, Circle } from 'lucide-react';

interface HeaderProps {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}

export default function Header({ title, onAction, actionLabel }: HeaderProps) {
  return (
    <header className="h-[72px] bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-10 flex-1">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] hidden lg:block">{title}</h2>
        
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl w-full max-w-sm group focus-within:ring-4 focus-within:ring-brand/5 focus-within:border-brand/30 transition-all duration-300">
          <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-brand transition-colors" />
          <input 
            type="text" 
            placeholder="Search resources..." 
            className="bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest w-full placeholder:text-slate-400 transition-all"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-50/50 px-4 py-2 rounded-full border border-emerald-100/50 shadow-sm shadow-emerald-100/20">
          <Circle className="w-1.5 h-1.5 fill-emerald-500 animate-pulse" />
          Gateway Active
        </div>

        <div className="w-px h-6 bg-slate-200/60 hidden md:block" />

        {onAction && (
          <button
            onClick={onAction}
            className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}
