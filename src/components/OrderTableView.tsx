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
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'packing': return 'bg-blue-100 text-blue-700';
      case 'shipping': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'completed': return 'bg-slate-900 text-white';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handlePrint = (order: Order) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Order Details - ${order.id}`, 10, 10);
    doc.setFontSize(12);
    doc.text(`Customer Name: ${order.customer_name}`, 10, 20);
    doc.text(`WhatsApp: ${order.whatsapp_number}`, 10, 30);
    doc.text(`Location: ${order.location}`, 10, 40);
    doc.text(`Product: ${order.product_name}`, 10, 50);
    doc.text(`Quantity: ${order.quantity || 1}`, 10, 60);
    doc.text(`Price: ${formatCurrency(order.price)}`, 10, 70);
    doc.text(`Status: ${order.status}`, 10, 80);
    doc.save(`order_${order.id}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User / Contact</th>
            <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</th>
            <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</th>
            <th className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id} className="group hover:bg-slate-50 transition-colors">
              <td className="px-5 py-4">
                <div className="text-sm font-black text-slate-900 uppercase">{order.customer_name}</div>
                <div className="text-[10px] text-slate-400 font-bold tracking-tight">{order.whatsapp_number}</div>
              </td>
              <td className="px-5 py-4 text-xs font-bold text-slate-600">{order.location}</td>
              <td className="px-5 py-4">
                <div className="text-sm font-bold text-slate-800">{order.product_name || 'Generic'}</div>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                    <div className="relative inline-block group">
                        <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer", getStatusColor(order.status))}>
                            {order.status}
                        </span>
                        <div className="absolute top-full left-0 z-20 bg-white shadow-xl border border-slate-200 rounded-xl p-2 hidden group-hover:block transition-all min-w-[120px]">
                            {['pending', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map(status => (
                                <button key={status} onClick={() => onStatusChange(order.id, status as any)} className="block w-full text-left px-3 py-2 text-[10px] font-black uppercase hover:bg-slate-50 rounded-lg">
                                    {status.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => handlePrint(order)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200">
                      <Printer className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
