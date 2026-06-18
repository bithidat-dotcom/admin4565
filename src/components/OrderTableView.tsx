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

  const handlePrint = async (order: Order) => {
    if (!window.confirm("Do you want to print this order?")) {
      return;
    }

    const doc = new jsPDF();
    
    // Add Logo
    try {
      const img = new Image();
      img.src = 'https://i.postimg.cc/KvqR53hq/download-(1).png';
      await new Promise((resolve) => { img.onload = resolve; });
      doc.addImage(img, 'PNG', 12, 10, 30, 15);
    } catch (e) {
      console.error("Failed to load logo", e);
    }

    doc.setFontSize(18);
    doc.text(`BAZER_BD`, 45, 20);
    doc.setFontSize(10);
    doc.text(`Invoice generated on: ${format(new Date(), 'PPpp')}`, 12, 30);
    doc.setDrawColor(220, 225, 230);
    doc.line(10, 35, 200, 35);

    // User Details Box
    doc.setFontSize(11);
    doc.rect(10, 40, 190, 30);
    doc.text(`Order Reference: ${order.id.slice(0, 8).toUpperCase()}`, 12, 45);
    doc.text(`Customer Name: ${order.customer_name}`, 12, 53);
    doc.text(`Phone: ${order.whatsapp_number}`, 12, 61);
    doc.text(`Location: ${order.location}`, 12, 69);
    
    // Product Details
    doc.setFontSize(12);
    doc.text(`Order Details`, 12, 80);
    doc.setFontSize(10);
    doc.text(`Product: ${order.product_name || 'Item'}`, 12, 90);
    doc.text(`Quantity: ${order.quantity || 1}`, 12, 98);
    doc.text(`Seller: ${order.seller || 'N/A'}`, 12, 106);
    
    // Signature
    doc.text('Signature:', 150, 250);
    doc.line(150, 260, 190, 260);

    doc.save(`order_${order.id}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full scrollbar-none">
        <table className="w-full text-left border-collapse table-auto min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100">
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">SL</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">User / Contact</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller</th>
              <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order, index) => (
              <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-4 text-xs text-slate-500 font-bold">{index + 1}</td>
                <td className="px-3 py-4">
                  <div className="text-sm font-black text-slate-900 uppercase">{order.customer_name}</div>
                  <div className="text-[10px] text-slate-400 font-bold tracking-tight">{order.whatsapp_number}</div>
                </td>
                <td className="px-3 py-4 text-xs font-bold text-slate-600 truncate max-w-[120px]">{order.location}</td>
                <td className="px-3 py-4 text-xs font-bold text-slate-800">{order.product_name || 'Generic'}</td>
                <td className="px-3 py-4 text-xs text-slate-600">{order.quantity || 1}</td>
                <td className="px-3 py-4 text-xs text-slate-600">{order.seller || 'N/A'}</td>
                <td className="px-3 py-4 text-right">
                  <button 
                    onClick={() => handlePrint(order)} 
                    className="p-2 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
                    title="Print PDF Invoice"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
