import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null) {
  const safeAmount = Number(amount) || 0;
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(safeAmount);
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportProductsToPDF(products: Product[]) {
  if (products.length === 0) {
    alert("No products to export.");
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Pbazar Product Catalog PDF', 14, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()} | Total Products: ${products.length}`, 14, 21);

  const tableRows = products.map((p, index) => {
    const stockVal = p.stock ?? p.quantity ?? p.qty ?? 20;
    const discountStr = (p.discount && Number(p.discount) > 0) ? `${p.discount}% OFF` : 'None';
    const priceStr = formatCurrency(p.price);
    const priceDisplay = `${priceStr}\nDiscount: ${discountStr}`;

    return [
      (index + 1).toString(),
      '', // Placeholder for image thumbnail column
      p.name || 'Unnamed Product',
      p.category || 'General',
      p.seller || 'Pbazar Store',
      stockVal.toString(),
      priceDisplay
    ];
  });

  // Pre-load images as base64 for embedding
  const loadedImages: { [key: number]: string } = {};
  await Promise.all(
    products.map(async (p, idx) => {
      if (!p.image) return;
      try {
        const response = await fetch(p.image, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onloadend = () => {
              loadedImages[idx] = reader.result as string;
              resolve(true);
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        // Fallback if image fetch fails
      }
    })
  );

  autoTable(doc, {
    startY: 26,
    head: [['#', 'Image', 'Product Name', 'Category', 'Seller', 'Stock', 'Price & Discount']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3, valign: 'middle', minCellHeight: 18 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 50 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 35 }
    },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const rowIndex = data.row.index;
        const imgData = loadedImages[rowIndex];
        const cell = data.cell;
        if (imgData) {
          try {
            doc.addImage(imgData, 'JPEG', cell.x + 2, cell.y + 2, 14, 14);
          } catch (err) {
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text('[Image]', cell.x + 3, cell.y + 10);
          }
        } else {
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text('No Img', cell.x + 3, cell.y + 10);
        }
      }
    },
    didDrawPage: (data: any) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
      doc.text('Pbazar Partner Ecosystem - Automated Product Catalog PDF', 14, doc.internal.pageSize.height - 10);
    }
  });

  doc.save(`pbazar_products_catalog_${new Date().toISOString().split('T')[0]}.pdf`);
}
