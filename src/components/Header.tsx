import React from 'react';
import { Plus, Search, Circle, Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
  onSearch?: (term: string) => void;
  children?: React.ReactNode;
}

export default function Header({ title, onAction, actionLabel, onSearch, children }: HeaderProps) {
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-sidebar'));
  };

  return (
    <header className="h-[72px] bg-brand border-b border-brand-dark px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-lg shadow-brand/10">
      <div className="flex items-center gap-3 md:gap-10 flex-1 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={handleMenuClick}
          className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/20 shrink-0"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <img src="https://i.postimg.cc/KvqR53hq/download-(1).png" alt="Logo" className="w-8 h-8 rounded-full hidden sm:block object-contain bg-white/10 p-0.5" />
        <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-[0.2em] truncate pr-2 max-w-[124px] sm:max-w-none">{title}</h2>
        
        <div className="flex items-center gap-2 md:gap-3 bg-white/10 border border-white/20 px-3 md:px-4 py-2 md:py-2.5 rounded-xl w-full max-w-[180px] sm:max-w-xs group focus-within:ring-4 focus-within:ring-white/10 focus-within:bg-white/20 transition-all duration-300">
          <Search className="w-3.5 h-3.5 text-white/60 group-focus-within:text-white transition-colors shrink-0" />
          <input 
            type="text" 
            placeholder="Search..." 
            onChange={(e) => onSearch?.(e.target.value)}
            className="bg-transparent border-none outline-none text-[10px] md:text-[11px] font-black uppercase tracking-widest w-full placeholder:text-white/40 text-white transition-all"
          />
        </div>
        {children}
      </div>
      
      <div className="flex items-center gap-3 md:gap-6 ml-2 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-[9px] font-black text-white uppercase tracking-[0.2em] bg-white/10 px-4 py-2 rounded-full border border-white/20 shadow-sm">
          <Circle className="w-1.5 h-1.5 fill-white animate-pulse" />
          Gateway Active
        </div>

        <div className="w-px h-6 bg-white/20 hidden lg:block" />

        {onAction && (
          <button
            onClick={onAction}
            className="bg-white text-brand hover:bg-brand-light px-3 md:px-6 py-2 md:py-2.5 rounded-xl flex items-center gap-1.5 md:gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-dark/20 active:scale-95"
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
