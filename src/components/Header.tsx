import React from 'react';
import { Plus, Search, Circle, Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}

export default function Header({ title, onAction, actionLabel }: HeaderProps) {
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-sidebar'));
  };

  return (
    <header className="h-[72px] bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3 md:gap-10 flex-1 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={handleMenuClick}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shrink-0"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <img src="https://i.postimg.cc/KvqR53hq/download-(1).png" alt="Logo" className="w-8 h-8 rounded-full hidden sm:block object-contain" />
        <h2 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-[0.2em] truncate pr-2 max-w-[124px] sm:max-w-none">{title}</h2>
        
        <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-200/60 px-3 md:px-4 py-2 md:py-2.5 rounded-xl w-full max-w-[180px] sm:max-w-xs group focus-within:ring-4 focus-within:ring-brand/5 focus-within:border-brand/30 transition-all duration-300">
          <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-brand transition-colors shrink-0" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-transparent border-none outline-none text-[10px] md:text-[11px] font-black uppercase tracking-widest w-full placeholder:text-slate-400 transition-all"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-6 ml-2 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-50/50 px-4 py-2 rounded-full border border-emerald-100/50 shadow-sm shadow-emerald-100/20">
          <Circle className="w-1.5 h-1.5 fill-emerald-500 animate-pulse" />
          Gateway Active
        </div>

        <div className="w-px h-6 bg-slate-200/60 hidden lg:block" />

        {onAction && (
          <button
            onClick={onAction}
            className="bg-slate-900 hover:bg-black text-white px-3 md:px-6 py-2 md:py-2.5 rounded-xl flex items-center gap-1.5 md:gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{actionLabel}</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
      </div>
    </header>
  );
}
