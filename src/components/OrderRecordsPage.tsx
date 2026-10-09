import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Order, Product } from '../types';
import LoadingDots from './LoadingDots';
import { 
  FileSpreadsheet, Download, Printer, Search, Calendar, 
  Store, Package, ShieldCheck, CheckCircle2, Clock, 
  Truck, XCircle, Filter, ArrowUpDown, RefreshCw 
} from 'lucide-react';
import { formatCurrency, cn, exportToCSV } from '../lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderRecordsPageProps {
  userSession?: any;
}

export default function OrderRecordsPage({ userSession }: OrderRecordsPageProps) {
  const isSeller = userSession?.role === 'product_seller' || userSession?.role === 'food_seller';
  const currentSellerId = userSession?.sellerId || '';
  const currentSellerName = userSession?.name || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [hostSyncSuccess, setHostSyncSuccess] = useState(false);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load orders
    const qOrders = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(200));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          created_at: d.created_at?.toDate?.()?.toISOString() || d.created_at || new Date().toISOString()
        };
      }) as Order[];

      setOrders(data);
      setLoading(false);

      // Auto-save backup snapshots to host server
      if (data.length > 0) {
        data.slice(0, 30).forEach(ord => {
          fetch('/api/order_records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: ord.id,
              customer_name: ord.customer_name,
              whatsapp_number: ord.whatsapp_number,
              product_name: ord.product_name,
              seller: ord.seller,
              seller_id: ord.seller_id,
              status: ord.status,
              price: ord.price,
              quantity: ord.quantity,
              created_at: ord.created_at
            })
          }).then(() => setHostSyncSuccess(true)).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // Load products for matching photos
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    }, () => {});

    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, []);

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (isSeller) {
      const matchSeller = 
        (o.seller_id && o.seller_id.toLowerCase() === currentSellerId.toLowerCase()) ||
        (o.seller && o.seller.toLowerCase() === currentSellerName.toLowerCase());
      if (!matchSeller) return false;
    }

    if (statusFilter !== 'all' && o.status !== statusFilter) return false;

    if (dateFilter) {
      const orderDate = o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd') : '';
      if (orderDate !== dateFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        o.id.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.whatsapp_number && o.whatsapp_number.includes(q)) ||
        (o.product_name && o.product_name.toLowerCase().includes(q)) ||
        (o.seller && o.seller.toLowerCase().includes(q)) ||
        (o.seller_id && o.seller_id.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'confirmed': return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'packing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'shipping': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'completed': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // Export full PDF report
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');

      // Title & Branding
      doc.setFontSize(20);
      doc.setTextColor(30, 94, 243);
      doc.text("PBAZAR - OFFICIAL ORDER RECORDS & AUDIT REPORT", 40, 45);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${format(new Date(), 'dd MMMM yyyy, hh:mm a')} | Store: pbazar Partner Network`, 40, 62);
      doc.text(`Total Records: ${filteredOrders.length} | Exported by: ${userSession?.name || 'Administrator'}`, 40, 75);

      const tableRows = filteredOrders.map((o, idx) => {
        const orderDate = o.created_at ? format(new Date(o.created_at), 'dd/MM/yyyy') : 'N/A';
        const orderTime = o.created_at ? format(new Date(o.created_at), 'hh:mm a') : 'N/A';
        const total = (o.items && o.items.length > 0
          ? o.items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
          : (Number(o.price) || 0) * (Number(o.quantity) || 1)) + (Number(o.delivery_charge) || 120);

        return [
          idx + 1,
          `#${o.id.slice(-6).toUpperCase()}`,
          `${orderDate}\n${orderTime}`,
          `${o.customer_name || 'N/A'}\n${o.whatsapp_number || 'N/A'}`,
          o.location || 'N/A',
          `${o.product_name || 'Product'}\nID: ${(o.product_id || o.id).slice(0, 8)}`,
          o.quantity || 1,
          `${o.seller || 'pbazar'}\nID: ${o.seller_id || 'N/A'}`,
          `BDT ${total.toLocaleString()}`,
          (o.status || 'pending').toUpperCase()
        ];
      });

      autoTable(doc, {
        head: [['#', 'Order ID', 'Exact Timestamp', 'Customer Contact', 'Location', 'Product Details', 'Qty', 'Seller Partner', 'Total (BDT)', 'Status']],
        body: tableRows,
        startY: 90,
        styles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [30, 94, 243],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      doc.save(`pbazar_order_records_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF report. Please try again.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export full Excel / CSV report
  const handleExportExcel = () => {
    const csvData = filteredOrders.map((o, idx) => {
      const orderDate = o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A';
      const total = (o.items && o.items.length > 0
        ? o.items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
        : (Number(o.price) || 0) * (Number(o.quantity) || 1)) + (Number(o.delivery_charge) || 120);

      return {
        SL: idx + 1,
        OrderID: o.id,
        ExactTimestamp: orderDate,
        CustomerName: o.customer_name || '',
        WhatsAppPhone: o.whatsapp_number || '',
        DeliveryLocation: o.location || '',
        ProductName: o.product_name || '',
        ProductID: o.product_id || '',
        Quantity: o.quantity || 1,
        SellerName: o.seller || '',
        SellerID: o.seller_id || '',
        ItemPriceBDT: o.price || 0,
        DeliveryChargeBDT: o.delivery_charge || 120,
        GrandTotalBDT: total,
        Status: o.status,
        CancelledBy: o.cancelled_by || ''
      };
    });

    exportToCSV(csvData, `pbazar_orders_full_records_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const totalVolume = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, o) => {
    const tot = (o.items && o.items.length > 0
      ? o.items.reduce((s, it) => s + (Number(it.price) * (Number(it.quantity) || 1)), 0)
      : (Number(o.price) || 0) * (Number(o.quantity) || 1)) + (Number(o.delivery_charge) || 120);
    return sum + (o.status !== 'cancelled' ? tot : 0);
  }, 0);

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Official Pbazar Header with Real Logo */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img 
            src="https://i.postimg.cc/KvqR53hq/download-(1).png" 
            alt="pbazar Logo" 
            className="w-14 h-14 rounded-2xl object-contain bg-[#1E5EF3]/5 p-2 border border-[#1E5EF3]/20 shadow-sm shrink-0" 
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">pbazar Order Records & Archive</h1>
              <span className="text-[10px] font-black bg-[#1E5EF3]/10 text-[#1E5EF3] px-2.5 py-1 rounded-full uppercase tracking-wider">
                Audit Grade
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
              Historical ledger tracking exact date, year, time, seller profile, cancellation logs, and status transitions
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || filteredOrders.length === 0}
            className="px-4 py-2.5 bg-[#1E5EF3] hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isExportingPDF ? 'Generating...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel / CSV</span>
          </button>

          {hostSyncSuccess && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Host Server Synced
            </span>
          )}
        </div>
      </div>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtered Records</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalVolume}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Realized Gross Volume</p>
          <p className="text-2xl font-black text-[#1E5EF3] mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Packing & Shipping</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {filteredOrders.filter(o => o.status === 'packing' || o.status === 'shipping').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cancelled Records</p>
          <p className="text-2xl font-black text-rose-600 mt-1">
            {filteredOrders.filter(o => o.status === 'cancelled').length}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-1 bg-slate-50 rounded-xl border border-slate-200/70">
          {['all', 'pending', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                statusFilter === st ? "bg-[#1E5EF3] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Date & Search */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs font-bold text-slate-700"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-rose-500 font-black text-[10px] hover:underline">
                Clear
              </button>
            )}
          </div>

          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>
      </div>

      {/* Main Records Table */}
      {loading ? (
        <div className="flex justify-center py-24"><LoadingDots /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-auto min-w-[950px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">Exact Date & Time</th>
                  <th className="p-4">Customer Details</th>
                  <th className="p-4">Product Name & Photo</th>
                  <th className="p-4">Seller Merchant</th>
                  <th className="p-4 text-center">Quantity</th>
                  <th className="p-4 text-right">Grand Total</th>
                  <th className="p-4 text-center">Lifecycle Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredOrders.map((order, idx) => {
                  let imageToShow = order.product_image;
                  if (!imageToShow && products && products.length > 0) {
                    const matchedProduct = products.find(p => p.name?.toLowerCase() === order.product_name?.toLowerCase());
                    if (matchedProduct && matchedProduct.image) imageToShow = matchedProduct.image;
                  }

                  const formattedDate = order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : 'N/A';
                  const formattedTime = order.created_at ? format(new Date(order.created_at), 'hh:mm:ss a') : 'N/A';

                  const grandTotal = (order.items && order.items.length > 0
                    ? order.items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
                    : (Number(order.price) || 0) * (Number(order.quantity) || 1)) + (Number(order.delivery_charge) || 120);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-center text-slate-400 font-black">{idx + 1}</td>
                      
                      {/* Exact Date, Time, Year */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-black text-slate-900 text-xs">{formattedDate}</div>
                        <div className="text-[10px] text-[#1E5EF3] font-bold">{formattedTime}</div>
                        <div className="text-[8px] text-slate-400 font-mono">ID: #{order.id.slice(-6).toUpperCase()}</div>
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="font-black text-slate-900 uppercase text-xs">{order.customer_name || 'Walking Customer'}</div>
                        <a href={`tel:${order.whatsapp_number}`} className="text-[10px] text-emerald-600 font-bold hover:underline block">
                          {order.whatsapp_number || 'N/A'}
                        </a>
                        <div className="text-[9px] text-slate-400 line-clamp-1 max-w-[150px]">{order.location || 'N/A'}</div>
                      </td>

                      {/* Product Name & Photo */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {imageToShow ? (
                            <img 
                              src={imageToShow} 
                              alt="Product" 
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0 bg-slate-50" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-xs line-clamp-1 max-w-[200px]">
                              {order.product_name || 'Product'}
                            </p>
                            {order.product_id && (
                              <p className="text-[8px] text-slate-400 font-mono">PID: {order.product_id.slice(0, 8)}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Seller Merchant */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {order.seller_logo ? (
                            <img src={order.seller_logo} alt="Seller" className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200" />
                          ) : (
                            <Store className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{order.seller || 'pbazar Official'}</span>
                        </div>
                        {order.seller_id && <div className="text-[8px] text-indigo-600 font-bold uppercase">ID: {order.seller_id}</div>}
                      </td>

                      <td className="p-4 text-center font-black text-slate-800">{order.quantity || 1}</td>

                      {/* Total */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="text-xs font-black text-slate-900">{formatCurrency(grandTotal)}</div>
                        <div className="text-[9px] text-slate-400 font-bold">Inc. ৳{order.delivery_charge || 120} Del</div>
                      </td>

                      {/* Lifecycle Status Badge */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-xs inline-flex items-center gap-1",
                          getStatusBadge(order.status)
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {order.status}
                        </span>
                        {order.cancelled_by && (
                          <span className="text-[8px] text-rose-500 font-bold block mt-0.5">By {order.cancelled_by}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No order records match selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
