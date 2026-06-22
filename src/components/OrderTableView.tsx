import React from 'react';
import { Order } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
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
    if (!window.confirm("Do you want to print this order invoice?")) {
      return;
    }

    const doc = new jsPDF();
    const qrData = `https://pbazar-bd.com/product/${order.product_details || order.id}`; // Updated to pbazar domain
    
    // Add Logo
    try {
      const img = new Image();
      // Using pbazar logo URL
      img.src = 'https://i.postimg.cc/KvqR53hq/download-(1).png'; 
      await new Promise((resolve) => { img.onload = resolve; });
      doc.addImage(img, 'PNG', 12, 8, 30, 15); // Refined dimensions for rectangular profile
    } catch (e) {
      console.error("Failed to load logo", e);
      doc.setFontSize(24);
      doc.setTextColor(249, 115, 22); // Orange brand color
      doc.setFont('helvetica', 'bold');
      doc.text("pbazar", 12, 22);
    }

    // QR Code for Tracking
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData);
      doc.addImage(qrDataUrl, 'PNG', 165, 10, 30, 30);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("SCAN FOR PRODUCT", 168, 42); // Clarified tracking purpose
    } catch (e) {
      console.error("Failed to generate QR code", e);
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Official Invoice & Product Info`, 60, 20);
    doc.setFontSize(8);
    doc.text(`Printed: ${format(new Date(), 'PPpp')}`, 60, 25);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(10, 45, 200, 45);

    // Shipping & Customer Info Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIP TO:", 12, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customer_name.toUpperCase(), 12, 62);
    doc.setFontSize(9);
    doc.text(`Contact: ${order.whatsapp_number}`, 12, 68);
    
    // Multi-line address handling
    const splitAddress = doc.splitTextToSize(order.location, 80);
    doc.text(splitAddress, 12, 74);

    // Order Meta Info
    doc.setFont('helvetica', 'bold');
    doc.text("ORDER & SELLER:", 110, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref ID: #${order.id.slice(0, 8).toUpperCase()}`, 110, 62);
    doc.text(`Date: ${order.created_at ? format(new Date(order.created_at), 'PPP') : 'N/A'}`, 110, 68);
    
    // Highlighted Seller Name
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(249, 115, 22); // Brand color for seller
    doc.text(`Seller: ${order.seller || 'pbazar Official'}`, 110, 74);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    
    // Status Badge
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(110, 78, 60, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`STATUS: ${order.status.toUpperCase()}`, 115, 84);

    // Items Table
    doc.setFontSize(11);
    doc.text("PRODUCT INFORMATION", 12, 105);
    
    autoTable(doc, {
      startY: 110,
      head: [['SL', 'Product Description', 'Seller Name', 'Qty', 'Unit Price', 'Total']],
      body: [
        [
          '1',
          order.product_name || 'Generic Item',
          order.seller || 'pbazar Official',
          order.quantity || 1,
          formatCurrency(order.price),
          formatCurrency((Number(order.quantity) || 1) * order.price)
        ]
      ],
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
      theme: 'grid'
    });

    // Summary Box
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(130, finalY, 200, finalY);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("SUBTOTAL:", 130, finalY + 10);
    doc.text(formatCurrency((Number(order.quantity) || 1) * order.price), 200, finalY + 10, { align: 'right' });
    
    doc.text("GRAND TOTAL:", 130, finalY + 20);
    doc.text(formatCurrency((Number(order.quantity) || 1) * order.price), 200, finalY + 20, { align: 'right' });

    // Parcel Footer / Attachment Clause
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Note: This document serves as a parcel attachment for product verification.", 12, finalY + 40);
    doc.text("Verify the seal and seller information upon arrival.", 12, finalY + 45);

    // Signature Area
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text('Receiver\'s Signature:', 12, 260);
    doc.line(12, 270, 70, 270);
    
    doc.text('Authorized pbazar Delegate:', 130, 260); // Updated name
    doc.line(130, 270, 190, 270);

    doc.save(`pbazar_INVOICE_${order.id.slice(0, 8)}.pdf`); // Updated filename

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
