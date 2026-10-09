import React from 'react';
import { Plus, Search, Menu, Link as LinkIcon, ShieldCheck, FileSpreadsheet, FileText } from 'lucide-react';

interface HeaderProps {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
  onSearch?: (term: string) => void;
  children?: React.ReactNode;
}

export default function Header({ title, onAction, actionLabel, onSearch, children }: HeaderProps) {
  const handleMenuClick = () => {
    try {
      window.dispatchEvent(new CustomEvent('open-sidebar'));
    } catch {
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent('open-sidebar', true, true, {});
      window.dispatchEvent(event);
    }
  };

  const handleOpenConverter = () => {
    try {
      window.dispatchEvent(new CustomEvent('open-link-converter'));
    } catch {
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent('open-link-converter', true, true, {});
      window.dispatchEvent(event);
    }
  };

  return (
    <header className="h-[72px] bg-[#1E5EF3] text-white border-b border-blue-600 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={handleMenuClick}
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-xl transition-all border border-white/20 shrink-0 cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>

        {/* Real pbazar Official Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img 
            src="https://i.postimg.cc/KvqR53hq/download-(1).png" 
            alt="pbazar Logo" 
            className="w-9 h-9 rounded-xl object-contain bg-white p-1 border border-white/20 shadow-sm" 
          />
          <span className="font-black text-xs md:text-sm uppercase tracking-wider text-white hidden sm:inline">
            pbazar
          </span>
        </div>

        <div className="h-6 w-px bg-white/20 hidden sm:block shrink-0" />

        <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-wider truncate pr-2 max-w-[130px] sm:max-w-none">
          {title}
        </h2>
        
        {onSearch && (
          <div className="flex items-center gap-2 bg-white/15 border border-white/25 px-3 py-1.5 md:py-2 rounded-xl w-full max-w-[160px] sm:max-w-xs focus-within:bg-white focus-within:text-slate-900 group transition-all">
            <Search className="w-3.5 h-3.5 text-white/70 group-focus-within:text-slate-500 transition-colors shrink-0" />
            <input 
              type="text" 
              placeholder="Search..." 
              onChange={(e) => onSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold w-full text-white placeholder:text-white/60 group-focus-within:text-slate-900 group-focus-within:placeholder:text-slate-400"
            />
          </div>
        )}
        {children}
      </div>
      
      <div className="flex items-center gap-2 md:gap-3 ml-2 shrink-0">
        {/* Quick Link Converter Button */}
        <button
          onClick={handleOpenConverter}
          className="hidden lg:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
          title="Convert image to URL automatically"
        >
          <LinkIcon className="w-3.5 h-3.5 text-blue-200" />
          <span>Image to URL</span>
        </button>

        {/* Anti-Scam Shield Active Badge */}
        <div className="hidden xl:flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>Scam Shield Active</span>
        </div>

        {onAction && (
          <button
            onClick={onAction}
            className="bg-white text-[#1E5EF3] hover:bg-blue-50 px-3 md:px-5 py-2 rounded-xl flex items-center gap-1.5 text-[10px] md:text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
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
