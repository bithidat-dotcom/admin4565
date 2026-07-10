import React from 'react';
import { Order } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Printer, Package } from 'lucide-react';
import { format } from 'date-fns';
import { handlePrint } from '../lib/printing';

interface OrderTableViewProps {
  orders: Order[];
  onStatusChange: (id: string, status: Order['status']) => void;
  statusUpdatingId: string | null;
  selectedOrders: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
}

export default function OrderTableView({ orders, onStatusChange, statusUpdatingId, selectedOrders, onToggleSelection, onSelectAll }: OrderTableViewProps) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100/80 text-amber-800 border border-amber-200/50';
      case 'confirmed': return 'bg-teal-100/80 text-teal-800 border border-teal-200/50';
      case 'packing': return 'bg-blue-100/80 text-blue-800 border border-blue-200/50';
      case 'shipping': return 'bg-orange-100/80 text-orange-800 border border-orange-200/50';
      case 'delivered': return 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/50';
      case 'completed': return 'bg-brand/10 text-brand border border-brand/20';
      case 'cancelled': return 'bg-red-100/80 text-red-800 border border-red-200/50';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200/50';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full scrollbar-none">
        <table className="w-full text-left border-collapse table-auto min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100">
              <th className="px-3 py-3 w-10">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                  checked={orders.length > 0 && selectedOrders.size === orders.length}
                  onChange={onSelectAll}
                />
              </th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">SL</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ordered At</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">User / Contact</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order, index) => (
              <tr key={order.id} className={cn("group hover:bg-slate-50/50 transition-colors", selectedOrders.has(order.id) && "bg-brand/5")}>
                <td className="px-3 py-4">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => onToggleSelection(order.id)}
                  />
                </td>
                <td className="px-3 py-4 text-xs text-slate-500 font-bold">{index + 1}</td>
                <td className="px-3 py-4">
                  <div className="text-[10px] font-black text-slate-900 uppercase">{order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : 'N/A'}</div>
                  <div className="text-[9px] text-indigo-600 font-bold">{order.created_at ? format(new Date(order.created_at), 'h:mm a') : 'N/A'}</div>
                </td>
                <td className="px-3 py-4">
                  <div className="text-sm font-black text-slate-900 uppercase">{order.customer_name}</div>
                  <div className="text-[10px] text-slate-400 font-bold tracking-tight">{order.whatsapp_number}</div>
                </td>
                <td className="px-3 py-4">
                  <div className="text-xs font-bold text-slate-600 line-clamp-1 max-w-[150px]" title={order.location}>{order.location}</div>
                  {(order.area || order.post_code) && (
                    <div className="flex gap-1.5 mt-1">
                      {order.area && (
                        <span className="text-[8px] font-black bg-rose-50 text-rose-500 px-1 py-0.5 rounded uppercase tracking-tighter">
                          {order.area}
                        </span>
                      )}
                      {order.post_code && (
                        <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded uppercase tracking-tighter">
                          {order.post_code}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    {order.product_image ? (
                      <img src={order.product_image} referrerPolicy="no-referrer" alt="P" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-sm shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                        <Package className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800">{order.product_name || 'Generic'}</span>
                  </div>
                </td>
                <td className="px-3 py-4 text-xs text-slate-600">{order.quantity || 1}</td>
                <td className="px-3 py-4">
                   <div className="text-xs font-bold text-slate-800 line-clamp-1">{order.seller || 'N/A'}</div>
                   {order.seller_id && <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-tight">ID: {order.seller_id}</div>}
                </td>
                <td className="px-3 py-4 text-right">
                   <div className="text-xs font-black text-slate-900">{formatCurrency(((order.price || 0) * (Number(order.quantity) || 1)) + (order.delivery_charge || 120))}</div>
                   <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Inc. ৳{order.delivery_charge || 120} Del</div>
                </td>
                <td className="px-3 py-4">
                   <select 
                     value={order.status}
                     onChange={(e) => onStatusChange(order.id, e.target.value as Order['status'])}
                     disabled={statusUpdatingId === order.id}
                     className={cn(
                       "text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border-0 focus:ring-2 focus:ring-slate-200 outline-none transition-all cursor-pointer",
                       getStatusColor(order.status)
                     )}
                   >
                     {['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map(s => (
                       <option key={s} value={s}>{s}</option>
                     ))}
                   </select>
                </td>
                <td className="px-3 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handlePrint(order)} 
                      className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                      title="Print PDF Invoice"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
