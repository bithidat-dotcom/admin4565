import React from 'react';
import { 
  LayoutDashboard, ShoppingBag, ShoppingCart, Users, X, 
  Link as LinkIcon, Store, LogOut, BarChart3, 
  Warehouse, Tag, Bell, ShieldAlert, FileSpreadsheet, Search, 
  FileText, Sparkles, DollarSign 
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
  const isSeller = userSession?.role === 'product_seller' || userSession?.role === 'food_seller';

  interface MenuItem {
    id: View;
    icon: any;
    label: string;
    allowedRoles: string[];
    badge?: string;
  }

  const allMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', allowedRoles: ['admin', 'product_seller'] },
    { id: 'orders', icon: ShoppingCart, label: 'Product Orders', allowedRoles: ['admin', 'product_seller', 'customer'] },
    { id: 'records', icon: FileSpreadsheet, label: 'Order Records (PDF/Excel)', allowedRoles: ['admin', 'product_seller'], badge: 'PRO' },
    { id: 'products', icon: ShoppingBag, label: 'Products', allowedRoles: ['admin', 'product_seller', 'customer'] },
    { id: 'seo', icon: Search, label: 'Product SEO & Growth', allowedRoles: ['admin', 'product_seller'], badge: 'NEW' },
    { id: 'inventory', icon: Warehouse, label: 'Inventory (Stock)', allowedRoles: ['admin', 'product_seller'] },
    { id: 'scam_catcher', icon: ShieldAlert, label: '🛡️ Anti-Scam Shield', allowedRoles: ['admin', 'product_seller'], badge: 'SAFE' },
    { id: 'policies', icon: FileText, label: 'Terms & Policies', allowedRoles: ['admin', 'product_seller'] },
    { id: 'sellers', icon: Store, label: 'Sellers Hub', allowedRoles: ['admin'] },
    { id: 'customers', icon: Users, label: 'Customer Intelligence', allowedRoles: ['admin', 'product_seller'] },
    { id: 'offers', icon: Tag, label: 'Coupons & Banners', allowedRoles: ['admin'] },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', allowedRoles: ['admin'] },
    { id: 'notifications', icon: Bell, label: 'Notifications', allowedRoles: ['admin', 'product_seller'] },
    { id: 'profile', icon: Users, label: 'My Customer Account', allowedRoles: ['customer'] },
  ];

  const menuItems = allMenuItems.filter(item => !userSession || item.allowedRoles.includes(userSession.role));

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
        <div className="p-6 pb-5 border-b border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://i.postimg.cc/KvqR53hq/download-(1).png" 
                alt="pbazar Logo" 
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-white/20 shadow-sm" 
              />
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none flex items-center gap-0.5 text-white">
                  pbazar
                </h1>
                <span className="text-[9px] font-bold text-white/70 tracking-wider uppercase">Partner & Admin</span>
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
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
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
                  "w-full flex items-center justify-start gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer relative font-bold text-[11px] tracking-wide uppercase",
                  isActive
                    ? "bg-white text-[#1E5EF3] shadow-md shadow-black/10 font-black scale-[1.01]"
                    : "text-white/85 hover:bg-white/15 hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-transform duration-200 group-hover:scale-110 shrink-0",
                  isActive ? "text-[#1E5EF3]" : "text-white/80 group-hover:text-white"
                )} />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ml-auto shrink-0",
                    isActive ? "bg-[#1E5EF3]/10 text-[#1E5EF3]" : "bg-white/20 text-white"
                  )}>
                    {item.badge}
                  </span>
                )}
                {item.id === 'orders' && !isSeller && (
                  <span className={cn(
                    "w-2 h-2 rounded-full ml-auto shrink-0",
                    isActive ? "bg-[#1E5EF3]" : "bg-red-300 animate-pulse"
                  )} />
                )}
              </button>
            );
          })}

          <div className="pt-3 pb-1 px-3 text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
            Instant Tools
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
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white/80 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
          >
            <LinkIcon className="w-4 h-4 text-white/70 animate-pulse shrink-0" />
            <span>Image Link Converter</span>
          </button>
        </nav>

        {/* Footer Admin Profile */}
        <div className="p-3 border-t border-white/10 bg-black/10">
          <button
            type="button"
            onClick={() => onViewChange('profile')}
            className="w-full flex items-center gap-2.5 p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/15 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-white text-[#1E5EF3] flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              {userSession?.name ? userSession.name.slice(0, 2).toUpperCase() : 'PB'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black text-white uppercase truncate">
                {userSession?.name || 'Administrator'}
              </span>
              <span className="text-[8px] text-white/60 font-bold uppercase tracking-wider leading-none">
                {userSession?.role || 'pbazar Admin'}
              </span>
            </div>
          </button>
          
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-100 hover:bg-rose-500/35 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}
