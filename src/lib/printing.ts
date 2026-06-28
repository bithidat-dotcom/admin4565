import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { Order } from '../types';
import { formatCurrency } from './utils';

export const handlePrint = async (order: Order) => {
  if (!window.confirm("Do you want to print this order invoice?")) {
    return;
  }

  const doc = new jsPDF();
  const qrData = `https://pbazar-bd.com/product/${order.product_details || order.id}`;
  
  // Add Logo
  try {
    const img = new Image();
    img.src = 'https://i.postimg.cc/KvqR53hq/download-(1).png'; 
    await new Promise((resolve) => { img.onload = resolve; });
    doc.addImage(img, 'PNG', 12, 8, 22, 22);
  } catch (e) {
    console.error("Failed to load logo", e);
    doc.setFontSize(22);
    doc.setTextColor(249, 115, 22); 
    doc.setFont('helvetica', 'bold');
    doc.text("pbazar", 12, 22);
  }

  // QR Code for Tracking
  try {
    const qrDataUrl = await QRCode.toDataURL(qrData);
    doc.addImage(qrDataUrl, 'PNG', 165, 10, 30, 30);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("SCAN TO VERIFY", 168, 42); 
  } catch (e) {
    console.error("Failed to generate QR code", e);
  }

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`OFFICIAL INVOICE`, 45, 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Processed by pbazar Logistics BD`, 45, 25);
  doc.text(`Printed: ${format(new Date(), 'PPpp')}`, 45, 30);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(10, 45, 200, 45);

  // Shipping & Customer Info Section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("SHIP TO / BUYER INFO:", 12, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_name.toUpperCase(), 12, 62);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`BUYER MOBILE: ${order.whatsapp_number}`, 12, 68);
  doc.setFont('helvetica', 'normal');
  
  // Multi-line address handling
  const splitAddress = doc.splitTextToSize(`Address: ${order.location}`, 80);
  doc.text(splitAddress, 12, 74);

  // Order Meta Info
  doc.setFont('helvetica', 'bold');
  doc.text("ORDER & SELLER DETAILS:", 110, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref ID: #${order.id.slice(0, 8).toUpperCase()}`, 110, 62);
  doc.text(`Date: ${order.created_at ? format(new Date(order.created_at), 'PPP') : 'N/A'}`, 110, 68);
  
  // Highlighted Seller Name
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(249, 115, 22); 
  doc.text(`SELLER: ${order.seller || 'pbazar Official'}`, 110, 74);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  
  // Items Table
  doc.setFontSize(11);
  doc.text("PRODUCT SUMMARY", 12, 105);
  
  autoTable(doc, {
    startY: 110,
    head: [['SL', 'Product Name', 'Seller Name', 'Qty', 'Unit Price', 'Item Total']],
    body: [
      [
        '1',
        `${order.product_name || 'Generic Item'}\nSeller: ${order.seller || 'pbazar Official'}`,
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
  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(248, 250, 252);
  doc.rect(130, finalY - 5, 70, 35, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.line(130, finalY - 5, 200, finalY - 5);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text("Sub-total:", 135, finalY + 5);
  doc.text(formatCurrency((Number(order.quantity) || 1) * order.price), 195, finalY + 5, { align: 'right' });

  doc.text("Logistics Fee:", 135, finalY + 12);
  doc.text("৳0.00", 195, finalY + 12, { align: 'right' });

  doc.text("Admin Adjust:", 135, finalY + 19);
  doc.text("- ৳0.00", 195, finalY + 19, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text("GRAND TOTAL:", 135, finalY + 28);
  doc.setTextColor(249, 115, 22);
  doc.text(formatCurrency((Number(order.quantity) || 1) * order.price), 195, finalY + 28, { align: 'right' });

  // Footer Signature
  const footerY = 280;
  doc.line(12, footerY - 10, 60, footerY - 10);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Warehouse Supervisor", 12, footerY - 5);

  doc.line(140, footerY - 10, 190, footerY - 10);
  doc.text("Authorized Signature", 140, footerY - 5);

  doc.save(`pbazar_INV_${order.id.slice(0, 8).toUpperCase()}.pdf`);
};
