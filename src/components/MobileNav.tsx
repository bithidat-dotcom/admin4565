import React from 'react';
import { Home, ShoppingBag, ShoppingCart, User, Store } from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../types';

interface MobileNavProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  const tabs = [
    { id: 'dashboard' as View, icon: Home, label: 'Home' },
    { id: 'products' as View, icon: ShoppingBag, label: 'Products' },
    { id: 'orders' as View, icon: ShoppingCart, label: 'Orders' },
    { id: 'sellers' as View, icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between md:hidden z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300 min-w-[50px]",
            currentView === tab.id ? "text-brand scale-110" : "text-slate-400"
          )}
        >
          <div className={cn(
            "p-1.5 rounded-xl transition-all",
            currentView === tab.id ? "bg-brand/10" : ""
          )}>
            <tab.icon className={cn("w-5 h-5", currentView === tab.id ? "fill-brand/20" : "")} />
          </div>
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
          {currentView === tab.id && (
            <div className="w-1 h-1 bg-brand rounded-full mt-0.5" />
          )}
        </button>
      ))}
    </nav>
  );
}
