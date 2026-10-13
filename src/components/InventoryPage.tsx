import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { Product, FoodItem, Seller } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Warehouse, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, 
  Search, Loader2, Store, ChevronLeft, ChevronRight, Package 
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [sellersMap, setSellersMap] = useState<Record<string, { name: string; logo: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock' | 'out'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Pagination: Default 30 items as requested
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load sellers for profile images & details
    const unsubSellers = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      const map: Record<string, { name: string; logo: string }> = {};
      snapshot.docs.forEach(docSnap => {
        const d = docSnap.data() as Seller;
        const keyId = (d.seller_id || docSnap.id).toLowerCase();
        const keyName = (d.name || '').toLowerCase();
        map[keyId] = { name: d.name, logo: d.logo };
        map[keyName] = { name: d.name, logo: d.logo };
      });
      setSellersMap(map);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sellers');
    });

    // Load products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    // Load foods
    const unsubFoods = onSnapshot(collection(db, 'foods'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodItem[];
      setFoods(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foods');
      setLoading(false);
    });

    return () => {
      unsubSellers();
      unsubProducts();
      unsubFoods();
    };
  }, []);

  const handleQuickUpdateStock = async (id: string, type: 'product' | 'food', newStock: number) => {
    setUpdatingId(id);
    try {
      const collectionName = type === 'product' ? 'products' : 'foods';
      await updateDoc(doc(db, collectionName, id), {
        stock: Math.max(0, newStock)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${type === 'product' ? 'products' : 'foods'}/${id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const inventoryItems = [
    ...products.map(p => {
      const sellerKey = (p.seller_id || p.seller || '').toLowerCase();
      const matchedSeller = sellersMap[sellerKey];
      const stockVal = p.stock !== undefined && p.stock !== null && !isNaN(Number(p.stock)) 
        ? Number(p.stock) 
        : (p.quantity !== undefined && p.quantity !== null && !isNaN(Number(p.quantity)) 
            ? Number(p.quantity) 
            : (p.qty !== undefined && p.qty !== null && !isNaN(Number(p.qty)) 
                ? Number(p.qty) 
                : 20));
      return {
        id: p.id,
        name: p.name,
        type: 'product' as const,
        stock: stockVal,
        minimum_stock: 5,
        sold: Number(p.sold || 0),
        price: Number(p.price || 0),
        image: p.image || (p.images && p.images[0]) || '',
        seller_name: p.seller || matchedSeller?.name || 'pbazar Partner',
        seller_id: p.seller_id || '',
        seller_logo: p.seller_logo || matchedSeller?.logo || '',
        last_updated: p.created_at || new Date().toISOString()
      };
    }),
    ...foods.map(f => {
      const sellerKey = (f.seller_id || f.seller || '').toLowerCase();
      const matchedSeller = sellersMap[sellerKey];
      const stockVal = f.stock !== undefined && f.stock !== null && !isNaN(Number(f.stock)) 
        ? Number(f.stock) 
        : 20;
      return {
        id: f.id,
        name: f.name,
        type: 'food' as const,
        stock: stockVal,
        minimum_stock: 10,
        sold: Number(f.sold_quantity || f.sold || 0),
        price: Number(f.price || 0),
        image: f.image || '',
        seller_name: f.seller || matchedSeller?.name || 'Food Vendor',
        seller_id: f.seller_id || '',
        seller_logo: matchedSeller?.logo || '',
        last_updated: f.created_at || new Date().toISOString()
      };
    })
  ];

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isOut = item.stock === 0;
    const isLow = !isOut && item.stock <= item.minimum_stock;
    const isIn = item.stock > item.minimum_stock;

    if (stockFilter === 'out') return matchesSearch && isOut;
    if (stockFilter === 'lowstock') return matchesSearch && isLow;
    if (stockFilter === 'instock') return matchesSearch && isIn;
    return matchesSearch;
  });

  const lowStockItemsCount = inventoryItems.filter(item => item.stock > 0 && item.stock <= item.minimum_stock).length;
  const outOfStockItemsCount = inventoryItems.filter(item => item.stock === 0).length;

  // Pagination calculation (30 items default)
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-[#1E5EF3]" />
            Real-time Inventory & Stock Directory
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Displaying product photos, seller profile icons, and 30 items per view with instant stock adjustments
          </p>
        </div>

        {/* View Size Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
          <span className="text-[10px] uppercase font-black px-2 text-slate-400">Page Size:</span>
          {[30, 60, 100].map(sz => (
            <button
              key={sz}
              onClick={() => { setItemsPerPage(sz); setCurrentPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer",
                itemsPerPage === sz ? "bg-[#1E5EF3] text-white shadow-sm" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Warnings bar */}
      {(lowStockItemsCount > 0 || outOfStockItemsCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs font-bold">
              <span>Attention: </span>
              <span className="font-black">{lowStockItemsCount} items</span> are running low on stock and <span className="font-black">{outOfStockItemsCount} items</span> are completely out of stock.
            </div>
          </div>
          <button 
            onClick={() => { setStockFilter('lowstock'); setCurrentPage(1); }}
            className="px-4 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Review Low Stock
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Catalog Items</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{inventoryItems.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Low Stock Warning</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{lowStockItemsCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Out Of Stock (Sold Out)</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">{outOfStockItemsCount}</p>
          </div>
        </div>
      </div>

      {/* Controls & Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto">
            {['all', 'instock', 'lowstock', 'out'].map(filter => (
              <button
                key={filter}
                onClick={() => { setStockFilter(filter as any); setCurrentPage(1); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                  stockFilter === filter
                    ? "bg-[#1E5EF3] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {filter === 'all' ? 'All Items' : filter === 'instock' ? 'In Stock' : filter === 'lowstock' ? 'Low Stock' : 'Out Of Stock'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product or seller..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><LoadingDots /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4">Product Name & Photo</th>
                    <th className="p-4">Seller & Profile</th>
                    <th className="p-4 text-center">Available Stock</th>
                    <th className="p-4 text-center">Min Threshold</th>
                    <th className="p-4 text-center">Units Sold</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Stock Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {paginatedItems.map((item, idx) => {
                    const isOut = item.stock === 0;
                    const isLow = !isOut && item.stock <= item.minimum_stock;
                    const isUpdating = updatingId === item.id;
                    const itemIndex = (currentPage - 1) * itemsPerPage + idx + 1;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 text-center text-slate-400 font-black">{itemIndex}</td>
                        
                        {/* 1. Name side product image show */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-100" 
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 uppercase tracking-tight text-xs truncate max-w-[220px]">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                  item.type === 'food' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-[#1E5EF3]"
                                )}>
                                  {item.type}
                                </span>
                                {item.price && (
                                  <span className="text-[10px] text-slate-500 font-black">
                                    ৳{item.price.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Which seller product & seller image icon show (small profile side) */}
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            {item.seller_logo ? (
                              <img 
                                src={item.seller_logo} 
                                alt={item.seller_name} 
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0 bg-white" 
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-[#1E5EF3] flex items-center justify-center shrink-0">
                                <Store className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[140px]">
                                {item.seller_name}
                              </p>
                              {item.seller_id && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                  ID: {item.seller_id}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <span className={cn(
                            "text-sm font-black px-2.5 py-1 rounded-lg",
                            isOut ? "text-rose-600 bg-rose-50" : isLow ? "text-amber-600 bg-amber-50" : "text-slate-900 bg-slate-100"
                          )}>
                            {item.stock}
                          </span>
                        </td>

                        <td className="p-4 text-center text-slate-400 font-bold">{item.minimum_stock}</td>
                        <td className="p-4 text-center font-black text-emerald-600">{item.sold}</td>

                        <td className="p-4 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1",
                            isOut ? "bg-rose-50 text-rose-700" : isLow ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", isOut ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500")} />
                            {isOut ? 'Out Of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>

                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickUpdateStock(item.id, item.type, item.stock - 5)}
                              className="w-7 h-7 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg flex items-center justify-center text-xs transition-all font-black cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Decrease 5 units"
                            >
                              -5
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickUpdateStock(item.id, item.type, item.stock + 5)}
                              className="w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center text-xs transition-all font-black cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Increase 5 units"
                            >
                              +5
                            </button>
                            {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-[#1E5EF3]" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest">
                        No catalog items match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination bar (Showing 30 per page by default) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-500">
                Showing <span className="font-black text-slate-900">{Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                <span className="font-black text-slate-900">{Math.min(filteredItems.length, currentPage * itemsPerPage)}</span> of{' '}
                <span className="font-black text-slate-900">{filteredItems.length}</span> items
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-black uppercase text-[10px] flex items-center gap-1 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <span className="px-3 py-1 text-slate-700 font-black text-xs">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-black uppercase text-[10px] flex items-center gap-1 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
