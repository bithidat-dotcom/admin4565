import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { Order } from '../types';
import { formatCurrency } from './utils';

export const handlePrint = async (order: Order) => {
  if (!window.confirm("Do you want to print this order invoice?")) {
    return;
  }

  const pdf = new jsPDF();
  const qrData = `https://pbazar-bd.com/product/${order.product_details || order.id}`;
  
  // Add Logo
  try {
    const img = new window.Image();
    img.src = 'https://i.postimg.cc/KvqR53hq/download-(1).png'; 
    await new Promise((resolve) => { img.onload = resolve; });
    pdf.addImage(img, 'PNG', 12, 8, 22, 22);
  } catch (e) {
    console.error("Failed to load logo", e);
    pdf.setFontSize(22);
    pdf.setTextColor(249, 115, 22); 
    pdf.setFont('helvetica', 'bold');
    pdf.text("pbazar", 12, 22);
  }

  // QR Code for Tracking
  try {
    const qrDataUrl = await QRCode.toDataURL(qrData);
    pdf.addImage(qrDataUrl, 'PNG', 165, 10, 30, 30);
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text("SCAN TO VERIFY", 168, 42); 
  } catch (e) {
    console.error("Failed to generate QR code", e);
  }

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`OFFICIAL INVOICE`, 45, 20);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Processed by pbazar Logistics BD`, 45, 25);
  pdf.text(`Printed: ${format(new Date(), 'PPpp')}`, 45, 30);
  
  pdf.setDrawColor(226, 232, 240);
  pdf.line(10, 45, 200, 45);

  // Shipping & Customer Info Section
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text("SHIP TO / BUYER INFO:", 12, 55);
  pdf.setFont('helvetica', 'normal');
  pdf.text(order.customer_name.toUpperCase(), 12, 62);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`BUYER MOBILE: ${order.whatsapp_number}`, 12, 68);
  pdf.setFont('helvetica', 'normal');
  
  // Multi-line address handling
  const splitAddress = pdf.splitTextToSize(`Address: ${order.location}`, 80);
  pdf.text(splitAddress, 12, 74);

  // Order Meta Info
  pdf.setFont('helvetica', 'bold');
  pdf.text("ORDER & SELLER DETAILS:", 110, 55);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Ref ID: #${order.id.slice(0, 8).toUpperCase()}`, 110, 62);
  pdf.text(`Date: ${order.created_at ? format(new Date(order.created_at), 'PPP') : 'N/A'}`, 110, 68);
  
  // Highlighted Seller Name
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(249, 115, 22); 
  pdf.text(`SELLER: ${order.seller || 'pbazar Official'}`, 110, 74);
  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'normal');
  
  // Items Table
  pdf.setFontSize(11);
  pdf.text("PRODUCT SUMMARY", 12, 105);
  
  autoTable(pdf, {
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
  const finalY = (pdf as any).lastAutoTable.finalY + 10;
  pdf.setDrawColor(241, 245, 249);
  pdf.setFillColor(248, 250, 252);
  pdf.rect(130, finalY - 5, 70, 35, 'F');
  pdf.setDrawColor(30, 41, 59);
  pdf.line(130, finalY - 5, 200, finalY - 5);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text("Sub-total:", 135, finalY + 5);
  pdf.text(formatCurrency((Number(order.quantity) || 1) * order.price), 195, finalY + 5, { align: 'right' });

  pdf.text("Delivery Charge:", 135, finalY + 12);
  pdf.text(formatCurrency(order.delivery_charge || 120), 195, finalY + 12, { align: 'right' });

  pdf.text("Admin Adjust:", 135, finalY + 19);
  pdf.text("- ৳0.00", 195, finalY + 19, { align: 'right' });

  pdf.setFont('helvetica', 'bold');
  pdf.text("GRAND TOTAL:", 135, finalY + 28);
  pdf.setTextColor(249, 115, 22);
  const grandTotal = ((Number(order.quantity) || 1) * order.price) + (order.delivery_charge || 120);
  pdf.text(formatCurrency(grandTotal), 195, finalY + 28, { align: 'right' });

  // Footer Signature
  const footerY = 280;
  pdf.line(12, footerY - 10, 60, footerY - 10);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Warehouse Supervisor", 12, footerY - 5);

  pdf.line(140, footerY - 10, 190, footerY - 10);
  pdf.text("Authorized Signature", 140, footerY - 5);

  pdf.save(`pbazar_INV_${order.id.slice(0, 8).toUpperCase()}.pdf`);
};
