import React from 'react';
import { LayoutDashboard, ShoppingBag, ShoppingCart, Image as ImageIcon, ChevronRight, Star, Users, X, Link as LinkIcon, Store, Settings, LogOut } from 'lucide-react';
import { View } from '../types';
import { cn } from '../lib/utils';
import { UserSession } from '../App';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onLogout: () => void;
  userSession: UserSession | null;
}

export default function Sidebar({ currentView, onViewChange, isOpen = false, onClose = () => {}, onLogout, userSession }: SidebarProps) {
  const isSeller = userSession?.role === 'seller';

  const menuItems = [
    { id: 'dashboard' as View, icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
    { id: 'products' as View, icon: ShoppingBag, label: 'Products', adminOnly: false },
    { id: 'orders' as View, icon: ShoppingCart, label: 'Orders', adminOnly: false },
    { id: 'banners' as View, icon: ImageIcon, label: 'Banners', adminOnly: true },
    { id: 'reviews' as View, icon: Star, label: 'Reviews', adminOnly: true },
    { id: 'sellers' as View, icon: Store, label: 'Sellers', adminOnly: false },
    { id: 'settings' as View, icon: Settings, label: 'Settings', adminOnly: true },
  ].filter(item => !isSeller || !item.adminOnly);

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
        <div className="p-8 pb-6 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <img src="https://i.postimg.cc/KvqR53hq/download-(1).png" alt="Logo" className="w-12 h-12 rounded-2xl object-contain bg-slate-50 p-1 border border-slate-100 shadow-sm" />
            
            <button
              onClick={onClose}
              className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-1 leading-none">
              p<span className="text-brand">bazar</span>
            </h1>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 pr-1">
              PartNet v3.0 • {userSession?.role?.toUpperCase()}
            </div>
          </div>
        </div>

      <nav className="flex-1 p-4 space-y-4 mt-6 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onViewChange(item.id);
              onClose();
            }}
            title={item.label}
            className={cn(
              "w-full flex items-center justify-start gap-4 p-4 rounded-2xl transition-all duration-300 group cursor-pointer relative",
              currentView === item.id
                ? "bg-brand text-white shadow-lg shadow-brand/20"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className={cn(
              "w-6 h-6",
              currentView === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-600"
            )} />
            <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            {item.id === 'orders' && !isSeller && (
              <span className={cn(
                "absolute top-3 right-3 w-2.5 h-2.5 rounded-full",
                currentView === item.id ? "bg-white" : "bg-red-500"
              )} />
            )}
          </button>
        ))}

        <div className="px-4 pt-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Utilities
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent('open-link-converter'));
            } catch (e) {
              const event = document.createEvent('CustomEvent');
              event.initCustomEvent('open-link-converter', true, true, {});
              window.dispatchEvent(event);
            }
            onClose();
          }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-all duration-300 group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <LinkIcon className="w-4 h-4 text-slate-400 group-hover:text-brand animate-pulse" />
            Link Converter
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all duration-300 group cursor-pointer mt-4"
        >
          <LogOut className="w-4 h-4" />
          Logout System
        </button>
      </nav>

      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-black text-xs">
            {userSession?.role === 'admin' ? 'BA' : userSession?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[11px] font-black text-slate-900 uppercase truncate">
              {userSession?.role === 'admin' ? 'pbazar Admin' : userSession?.name}
            </span>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                 {userSession?.role === 'admin' ? 'Root Access' : `ID: ${userSession?.sellerId}`}
               </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </>
);
}
