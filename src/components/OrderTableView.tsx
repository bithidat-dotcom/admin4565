import React from 'react';
import { Order } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface OrderTableViewProps {
  orders: Order[];
  onStatusChange: (id: string, status: Order['status']) => void;
  statusUpdatingId: string | null;
}

export default function OrderTableView({ orders, onStatusChange, statusUpdatingId }: OrderTableViewProps) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100/80 text-amber-800 border border-amber-200/50';
      case 'packing': return 'bg-blue-100/80 text-blue-800 border border-blue-200/50';
      case 'shipping': return 'bg-indigo-100/80 text-indigo-800 border border-indigo-200/50';
      case 'delivered': return 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/50';
      case 'completed': return 'bg-slate-100 text-slate-800 border border-slate-300/60';
      case 'cancelled': return 'bg-red-100/80 text-red-800 border border-red-200/50';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200/50';
    }
  };

  const handlePrint = (order: Order) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    // Draw fine aesthetics instead of black block
    doc.text(`BAZER_BD ORDER INVOICE`, 12, 15);
    doc.setFontSize(10);
    doc.text(`Printed on: ${format(new Date(), 'PPpp')}`, 12, 22);
    doc.setDrawColor(220, 225, 230);
    doc.line(10, 25, 200, 25);

    doc.setFontSize(11);
    doc.text(`Order reference: ${order.id}`, 12, 35);
    doc.text(`Customer Name: ${order.customer_name}`, 12, 43);
    doc.text(`WhatsApp Hub: ${order.whatsapp_number}`, 12, 51);
    doc.text(`Shipping Destination: ${order.location}`, 12, 59);
    
    doc.line(10, 65, 200, 65);
    doc.setFontSize(12);
    doc.text(`Line Items & Specifications`, 12, 75);
    doc.setFontSize(10);
    doc.text(`Product description: ${order.product_name || 'Generic Product Item'}`, 12, 85);
    doc.text(`Units Ordered: ${order.quantity || 1}`, 12, 93);
    doc.text(`Price Unit (Tk / BDT): ${formatCurrency(order.price)}`, 12, 101);
    doc.text(`Transaction Status: ${order.status.toUpperCase()}`, 12, 109);

    if (order.product_details) {
      doc.text(`Merchant Specifications:`, 12, 120);
      doc.setFontSize(9);
      const splitText = doc.splitTextToSize(order.product_details, 180);
      doc.text(splitText, 12, 126);
    }

    doc.setDrawColor(220, 225, 230);
    doc.line(10, 180, 200, 180);
    doc.setFontSize(9);
    doc.text(`Thank you for shopping at Bazer BD. Generated via Cloud Admin Platform.`, 12, 187);

    doc.save(`bazer_order_${order.id}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full scrollbar-none">
        <table className="w-full text-left border-collapse table-auto min-w-[640px]">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100">
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">User / Contact</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 sm:px-5 sm:py-4">
                  <div className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate max-w-[150px]">{order.customer_name}</div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-tight">{order.whatsapp_number}</div>
                </td>
                <td className="px-3 py-2.5 sm:px-5 sm:py-4 text-[11px] sm:text-xs font-bold text-slate-600 truncate max-w-[150px]">{order.location}</td>
                <td className="px-3 py-2.5 sm:px-5 sm:py-4">
                  <div className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[180px]">{order.product_name || 'Generic'}</div>
                </td>
                <td className="px-3 py-2.5 sm:px-5 sm:py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <div className="relative inline-block group/status">
                      <span className={cn("px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider cursor-pointer select-none whitespace-nowrap", getStatusColor(order.status))}>
                        {order.status}
                      </span>
                      <div className="absolute right-0 top-full mt-1.5 z-25 bg-white shadow-xl border border-slate-200/80 rounded-xl p-1.5 hidden group-hover/status:block hover:block transition-all min-w-[110px] text-left">
                        {['pending', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map(status => (
                          <button 
                            key={status} 
                            onClick={() => onStatusChange(order.id, status as any)} 
                            className="block w-full text-left px-2 py-1.5 text-[9px] font-black uppercase hover:bg-slate-50 rounded-lg text-slate-700 hover:text-slate-900"
                          >
                            {status.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => handlePrint(order)} 
                      className="p-1.5 sm:p-2 bg-slate-55 border border-slate-200/60 rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
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
