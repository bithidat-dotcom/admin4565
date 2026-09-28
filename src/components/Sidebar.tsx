import React from 'react';
import { 
  LayoutDashboard, ShoppingBag, ShoppingCart, Star, Users, X, 
  Link as LinkIcon, Store, Settings, LogOut, BarChart3, 
  Warehouse, Tag, Bell, Menu, ShieldAlert 
} from 'lucide-react';
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
    { id: 'dashboard' as View, icon: LayoutDashboard, label: 'Dashboard', allowedRoles: ['admin', 'product_seller'] },
    { id: 'orders' as View, icon: ShoppingCart, label: 'Product Orders', allowedRoles: ['admin', 'product_seller'] },
    { id: 'analytics' as View, icon: BarChart3, label: 'Analytics', allowedRoles: ['admin'] },
    { id: 'products' as View, icon: ShoppingBag, label: 'Products', allowedRoles: ['admin', 'product_seller'] },
    { id: 'inventory' as View, icon: Warehouse, label: 'Inventory', allowedRoles: ['admin', 'product_seller'] },
    { id: 'sellers' as View, icon: Store, label: 'Sellers Hub', allowedRoles: ['admin'] },
    { id: 'customers' as View, icon: Users, label: 'Customers', allowedRoles: ['admin'] },
    { id: 'offers' as View, icon: Tag, label: 'Coupons & Banners', allowedRoles: ['admin'] },
    { id: 'notifications' as View, icon: Bell, label: 'Notifications', allowedRoles: ['admin', 'product_seller'] },
  ].filter(item => !userSession || item.allowedRoles.includes(userSession.role));

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
        "w-64 bg-[#1E5EF3] text-white h-screen fixed top-0 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 md:left-0 shadow-2xl",
        isOpen ? "translate-x-0 left-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand Header */}
        <div className="p-6 pb-6 border-b border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://i.postimg.cc/KvqR53hq/download-(1).png" 
                alt="Logo" 
                className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shadow-inner" 
              />
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none flex items-center gap-0.5 text-white">
                  pbazar
                </h1>
                <span className="text-[9px] font-bold text-white/60 tracking-wider uppercase">Partner Suite</span>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="md:hidden p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  onClose();
                }}
                title={item.label}
                className={cn(
                  "w-full flex items-center justify-start gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 group cursor-pointer relative font-semibold text-xs tracking-wide uppercase",
                  isActive
                    ? "bg-white text-[#1E5EF3] shadow-lg shadow-black/10 font-bold scale-[1.02]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-[#1E5EF3]" : "text-white/70 group-hover:text-white"
                )} />
                <span>{item.label}</span>
                {item.id === 'food' && (
                  <span className="text-[8px] font-black bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto shrink-0">New</span>
                )}
                {item.id === 'orders' && !isSeller && (
                  <span className={cn(
                    "absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 rounded-full",
                    isActive ? "bg-[#1E5EF3]" : "bg-red-400 animate-pulse"
                  )} />
                )}
              </button>
            );
          })}

          <div className="pt-4 pb-1 px-4 text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
            Quick Actions
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
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <LinkIcon className="w-4.5 h-4.5 text-white/60 animate-pulse" />
            <span>Link Converter</span>
          </button>
        </nav>

        {/* Footer Admin Profile */}
        <div className="p-4 border-t border-white/10 bg-black/10">
          <button
            type="button"
            onClick={() => onViewChange('profile')}
            className="w-full flex items-center gap-3 p-2 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-white text-[#1E5EF3] flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
              {userSession?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden text-left">
              <span className="text-[10px] font-black text-white uppercase truncate">
                {userSession?.name}
              </span>
              <span className="text-[8px] text-white/60 font-bold uppercase tracking-wider leading-none">
                View Profile
              </span>
            </div>
          </button>
          
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mt-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-white hover:bg-red-500/40 transition-all duration-300 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
