import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { Order } from '../types';
import { formatCurrency } from './utils';

export const generateInvoicePDF = async (order: any) => {
  const pdf = new jsPDF();
  const qrData = `https://pbazar.vercel.app`;
  
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
    pdf.text("Go to Website", 168, 42); 
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
  pdf.text((order.customer_name || '').toUpperCase(), 12, 62);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`BUYER MOBILE: ${order.whatsapp_number || 'N/A'}`, 12, 68);
  pdf.setFont('helvetica', 'normal');
  
  // Multi-line address handling
  const addressText = `Address: ${order.location || 'N/A'}`;
  const splitAddress = pdf.splitTextToSize(addressText, 80);
  pdf.text(splitAddress, 12, 74);
  
  // Explicit Post Code display
  if (order.post_code) {
    const postCodeY = 74 + (splitAddress.length * 5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Post Code: ${order.post_code}`, 12, postCodeY);
    pdf.setFont('helvetica', 'normal');
  }

  // Order Meta Info
  pdf.setFont('helvetica', 'bold');
  pdf.text("ORDER & SELLER DETAILS:", 110, 55);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Ref ID: #${(order.id || '').slice(0, 8).toUpperCase()}`, 110, 62);
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
  
  const tableBody = order.items && order.items.length > 0 
    ? order.items.map((item: any, idx: number) => [
        (idx + 1).toString(),
        item.name || 'Generic Item',
        item.seller || 'pbazar Official',
        item.quantity || 1,
        formatCurrency(item.price),
        formatCurrency((Number(item.quantity) || 1) * item.price)
      ])
    : [
        [
          '1',
          order.product_name || 'Generic Item',
          order.seller || 'pbazar Official',
          order.quantity || 1,
          formatCurrency(order.price / (Number(order.quantity) || 1)),
          formatCurrency(order.price)
        ]
      ];

  autoTable(pdf, {
    startY: 110,
    head: [['SL', 'Product Name', 'Seller Name', 'Qty', 'Unit Price', 'Item Total']],
    body: tableBody,
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
  
  const subtotal = order.items && order.items.length > 0
    ? order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    : order.price;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text("Sub-total:", 135, finalY + 5);
  pdf.text(formatCurrency(subtotal), 195, finalY + 5, { align: 'right' });
  pdf.text("Delivery Charge:", 135, finalY + 12);
  pdf.text(formatCurrency(order.delivery_charge || 120), 195, finalY + 12, { align: 'right' });

  pdf.setFont('helvetica', 'bold');
  pdf.text("GRAND TOTAL:", 135, finalY + 22);
  pdf.setTextColor(249, 115, 22);
  const grandTotal = subtotal + (order.delivery_charge || 120);
  pdf.text(formatCurrency(grandTotal), 195, finalY + 22, { align: 'right' });

  // Delivery By Section (left side of the table bottom)
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text("DELIVERY BY:", 12, finalY + 5);
  
  try {
    const deliveryImg = new window.Image();
    deliveryImg.src = 'https://www.mawbiz.com.bd/application/views/module/logo_image/Steadfast_Courier_Rajshahi_logo.jpg'; 
    await new Promise((resolve, reject) => { 
      deliveryImg.onload = resolve;
      deliveryImg.onerror = () => reject(new Error("Failed to load Steadfast logo"));
      setTimeout(() => reject(new Error("Timeout loading logo")), 5000);
    });
    
    const ratio = (deliveryImg.naturalWidth || deliveryImg.width || 1) / (deliveryImg.naturalHeight || deliveryImg.height || 1);
    const width = 28;
    const height = width / ratio;
    
    // Add image directly, bypassing canvas CORS taint if browser allows it, or it falls back to text.
    pdf.addImage(deliveryImg, 'JPEG', 12, finalY + 8, width, height);
    
    // Add text under the image
    pdf.setFontSize(8);
    pdf.setTextColor(30, 41, 59);
    pdf.text("STEADFAST COURIER", 12, finalY + 8 + height + 5);
  } catch (e) {
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text("STEADFAST COURIER", 12, finalY + 15);
  }

  // Footer Signature
  const footerY = 280;
  pdf.line(12, footerY - 10, 60, footerY - 10);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Warehouse Supervisor", 12, footerY - 5);

  pdf.line(140, footerY - 10, 190, footerY - 10);
  pdf.text("Authorized Signature", 140, footerY - 5);

  pdf.save(`pbazar_INV_${(order.id || 'N_A').slice(0, 8).toUpperCase()}.pdf`);
};

export const handlePrint = async (order: Order) => {
  if (!window.confirm("Do you want to print this order invoice?")) {
    return;
  }
  await generateInvoicePDF(order);
};

export const exportOrderRecordsPDF = async (orders: Order[]) => {
  const pdf = new jsPDF('landscape');
  
  // Header with pbazar Logo
  try {
    const img = new window.Image();
    img.src = 'https://i.postimg.cc/KvqR53hq/download-(1).png'; 
    await new Promise((resolve, reject) => { 
      img.onload = resolve; 
      img.onerror = reject;
      setTimeout(resolve, 2000);
    });
    pdf.addImage(img, 'PNG', 14, 10, 18, 18);
  } catch (e) {
    console.error("Failed to load logo in PDF report", e);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(30, 41, 59);
  pdf.text("PBAZAR COMPLETE ORDER RECORDS REPORT", 36, 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Official eCommerce Audit Sheet · Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm:ss a')}`, 36, 24);

  // Status Summary Badges
  const totalCount = orders.length;
  const completedCount = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
  const activeCount = orders.filter(o => ['pending', 'confirmed', 'packing', 'shipping'].includes(o.status)).length;
  const totalRevenue = orders.reduce((sum, o) => {
    const orderPrice = o.items && o.items.length > 0
      ? o.items.reduce((s: number, i: any) => s + (Number(i.price) * (Number(i.quantity) || 1)), 0)
      : (Number(o.price) || 0) * (Number(o.quantity) || 1);
    return sum + orderPrice + (Number(o.delivery_charge) || 120);
  }, 0);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(`TOTAL ORDERS: ${totalCount}  |  DELIVERED/COMPLETED: ${completedCount}  |  ACTIVE/SHIPPING: ${activeCount}  |  CANCELLED: ${cancelledCount}  |  REVENUE: ${formatCurrency(totalRevenue)}`, 14, 34);

  // Table Data
  const tableRows = orders.map((order, idx) => {
    const exactDate = order.created_at 
      ? format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')
      : 'N/A';
    
    const itemsSummary = order.items && order.items.length > 0
      ? order.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ')
      : `${order.product_name || 'Generic Product'} (x${order.quantity || 1})`;

    const grandTotal = (
      (order.items && order.items.length > 0
        ? order.items.reduce((sum: number, item: any) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
        : (Number(order.price) || 0) * (Number(order.quantity) || 1)) + (Number(order.delivery_charge) || 120)
    );

    const sellerInfo = `${order.seller || 'pbazar'}${order.seller_id ? ` (ID: ${order.seller_id})` : ''}`;

    let statusDisplay = (order.status || 'pending').toUpperCase();
    if (order.status === 'cancelled' && order.cancelled_by) {
      statusDisplay += ` (${order.cancelled_by.toUpperCase()})`;
    }

    return [
      idx + 1,
      order.id.slice(0, 8).toUpperCase(),
      exactDate,
      `${order.customer_name}\n${order.whatsapp_number}\n${order.location || ''}`,
      itemsSummary,
      sellerInfo,
      `BDT ${grandTotal.toLocaleString()}`,
      statusDisplay
    ];
  });

  autoTable(pdf, {
    head: [['SL', 'ORDER ID', 'DATE & EXACT TIME', 'CUSTOMER / LOCATION', 'PRODUCT(S) & QTY', 'SELLER / SHOP', 'TOTAL', 'STATUS']],
    body: tableRows,
    startY: 38,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [30, 94, 243], // pbazar brand blue
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 50 },
      4: { cellWidth: 55 },
      5: { cellWidth: 35 },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 35 }
    }
  });

  pdf.save(`pbazar_order_records_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`);
};
