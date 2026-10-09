import React from 'react';
import { Home, ShoppingBag, ShoppingCart, Warehouse, FileSpreadsheet, ShieldAlert, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../types';

interface MobileNavProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  const tabs = [
    { id: 'dashboard' as View, icon: Home, label: 'Home' },
    { id: 'orders' as View, icon: ShoppingCart, label: 'Orders' },
    { id: 'records' as View, icon: FileSpreadsheet, label: 'Records' },
    { id: 'inventory' as View, icon: Warehouse, label: 'Stock' },
    { id: 'seo' as View, icon: Search, label: 'SEO' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-around md:hidden z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {tabs.map((tab) => {
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 transition-all duration-200 min-w-[50px] cursor-pointer",
              isActive ? "text-[#1E5EF3] scale-105" : "text-slate-400 hover:text-slate-700"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-all",
              isActive ? "bg-blue-50 text-[#1E5EF3]" : ""
            )}>
              <tab.icon className="w-5 h-5" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-wider">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
