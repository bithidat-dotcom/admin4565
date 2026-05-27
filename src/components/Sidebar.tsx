import React from 'react';
import { LayoutDashboard, ShoppingBag, ShoppingCart, Image as ImageIcon, ChevronRight, Star, Users, X } from 'lucide-react';
import { View } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentView, onViewChange, isOpen = false, onClose = () => {} }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as View, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'products' as View, icon: ShoppingBag, label: 'Products' },
    { id: 'orders' as View, icon: ShoppingCart, label: 'Orders' },
    { id: 'banners' as View, icon: ImageIcon, label: 'Banners' },
    { id: 'reviews' as View, icon: Star, label: 'Reviews' },
    { id: 'users' as View, icon: Users, label: 'Customers' },
  ];

  return (
    <>
      {/* Mobile Sidebar backdrop glass overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
        />
      )}

      <aside className={cn(
        "w-64 bg-white border-r border-slate-200 h-screen fixed top-0 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 md:left-0",
        isOpen ? "translate-x-0 left-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-8 pb-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-1">
              BAZER<span className="text-brand">_BD</span>
            </h1>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 pr-1">
              Admin Control v3.0
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      <nav className="flex-1 p-4 space-y-1.5 mt-6">
        <div className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Store Management
        </div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onViewChange(item.id);
              onClose();
            }}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 group",
              currentView === item.id
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className={cn(
                "w-4 h-4",
                currentView === item.id ? "text-brand" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {item.label}
            </div>
            {item.id === 'orders' && (
              <span className={cn(
                "text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter",
                currentView === item.id ? "bg-brand text-white" : "bg-emerald-500 text-white"
              )}>
                Live
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-xs">
            BD
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[11px] font-black text-slate-900 uppercase truncate">SuperAdmin</span>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Active Now</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </>
);
}
