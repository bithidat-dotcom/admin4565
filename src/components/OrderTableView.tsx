import React from 'react';
import { Order } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Printer, Package, Trash2, Ban, Store } from 'lucide-react';
import { format } from 'date-fns';
import { handlePrint } from '../lib/printing';

interface OrderTableViewProps {
  orders: Order[];
  onStatusChange: (id: string, status: Order['status']) => void;
  statusUpdatingId: string | null;
  selectedOrders: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  products?: any[];
  onDeleteOrder?: (id: string) => void;
  onCancelOrder?: (id: string) => void;
}

export default function OrderTableView({ 
  orders, 
  onStatusChange, 
  statusUpdatingId, 
  selectedOrders, 
  onToggleSelection, 
  onSelectAll, 
  products = [],
  onDeleteOrder,
  onCancelOrder
}: OrderTableViewProps) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'confirmed': return 'bg-teal-100 text-teal-800 border border-teal-300';
      case 'packing': return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'shipping': return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'completed': return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border border-slate-300';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full scrollbar-thin">
        <table className="w-full text-left border-collapse table-auto min-w-[950px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-3 w-10 text-center">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-[#1E5EF3] focus:ring-[#1E5EF3] cursor-pointer"
                  checked={orders.length > 0 && selectedOrders.size === orders.length}
                  onChange={onSelectAll}
                />
              </th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">SL</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Exact Timestamp</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Customer Contact</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Delivery Location</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Item & Photo</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Qty</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Seller</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Amount</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Status</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {orders.map((order, index) => {
              let imageToShow = order.product_image;
              if (!imageToShow && products && products.length > 0) {
                const matchedProduct = products.find(p => p.name?.toLowerCase() === order.product_name?.toLowerCase());
                if (matchedProduct && matchedProduct.image) {
                  imageToShow = matchedProduct.image;
                }
              }

              const formattedDate = order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : 'N/A';
              const formattedTime = order.created_at ? format(new Date(order.created_at), 'hh:mm:ss a') : 'N/A';

              const grandTotal = (order.items && order.items.length > 0
                ? order.items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
                : (Number(order.price) || 0) * (Number(order.quantity) || 1)) + (Number(order.delivery_charge) || 120);

              return (
                <tr key={order.id} className={cn("hover:bg-slate-50/70 transition-colors", selectedOrders.has(order.id) && "bg-blue-50/40")}>
                  <td className="px-3 py-3 text-center">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-[#1E5EF3] focus:ring-[#1E5EF3] cursor-pointer"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => onToggleSelection(order.id)}
                    />
                  </td>
                  
                  <td className="px-3 py-3 font-black text-slate-400">{index + 1}</td>
                  
                  {/* Exact Time, Date, Year */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="text-[10px] font-black text-slate-900 uppercase">{formattedDate}</div>
                    <div className="text-[9px] text-blue-600 font-bold">{formattedTime}</div>
                    <div className="text-[8px] text-slate-400 font-mono">ID: #{order.id.slice(-6).toUpperCase()}</div>
                  </td>

                  {/* Customer Contact */}
                  <td className="px-3 py-3">
                    <div className="font-black text-slate-900 uppercase text-xs">{order.customer_name || 'Customer'}</div>
                    <a href={`tel:${order.whatsapp_number}`} className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-1">
                      {order.whatsapp_number}
                    </a>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3">
                    <div className="text-xs font-semibold text-slate-700 line-clamp-1 max-w-[140px]" title={order.location}>
                      {order.location}
                    </div>
                    {(order.area || order.post_code) && (
                      <div className="flex gap-1 mt-0.5">
                        {order.area && (
                          <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1 py-0.2 rounded uppercase">
                            {order.area}
                          </span>
                        )}
                        {order.post_code && (
                          <span className="text-[8px] font-black bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                            {order.post_code}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Product & Photo */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      {imageToShow ? (
                        <img 
                          src={imageToShow} 
                          referrerPolicy="no-referrer" 
                          alt="Product" 
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-50" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 line-clamp-1">
                          {order.product_name || 'Product'}
                        </span>
                        {order.product_id && (
                          <span className="text-[8px] text-slate-400 font-mono block">PID: {order.product_id.slice(0, 8)}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3 text-center font-black text-slate-800">{order.quantity || 1}</td>

                  {/* Seller */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {order.seller_logo ? (
                        <img src={order.seller_logo} alt="Seller" className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200" />
                      ) : (
                        <Store className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[110px]">{order.seller || 'pbazar Official'}</span>
                    </div>
                    {order.seller_id && <div className="text-[8px] text-indigo-600 font-bold uppercase tracking-tight">ID: {order.seller_id}</div>}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="text-xs font-black text-slate-900">{formatCurrency(grandTotal)}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Inc. ৳{order.delivery_charge || 120} Del</div>
                  </td>

                  {/* Status Dropdown */}
                  <td className="px-3 py-3 text-center">
                    <select 
                      value={order.status}
                      onChange={(e) => onStatusChange(order.id, e.target.value as Order['status'])}
                      disabled={statusUpdatingId === order.id}
                      className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer shadow-xs",
                        getStatusColor(order.status)
                      )}
                    >
                      {['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  {/* Actions: Cancel, Delete, Print */}
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {/* Cancel Button */}
                      {order.status !== 'cancelled' && (
                        <button
                          onClick={() => onCancelOrder ? onCancelOrder(order.id) : onStatusChange(order.id, 'cancelled')}
                          className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Cancel Order"
                        >
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span className="hidden xl:inline">Cancel</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteOrder && onDeleteOrder(order.id)}
                        className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Delete Order Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Print Invoice Button */}
                      <button 
                        onClick={() => handlePrint(order)} 
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Print PDF Invoice"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {orders.length === 0 && (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  No orders match active query parameters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
