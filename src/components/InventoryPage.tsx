import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { Product, FoodItem } from '../types';
import LoadingDots from './LoadingDots';
import { 
  Warehouse, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, 
  Search, Loader2, ArrowUpDown, ChevronDown 
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock' | 'out'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load products
    const qProducts = collection(db, 'products');
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    // Load foods
    const qFoods = collection(db, 'foods');
    const unsubFoods = onSnapshot(qFoods, (snapshot) => {
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
    ...products.map(p => ({
      id: p.id,
      name: p.name,
      type: 'product' as const,
      stock: Number(p.stock) || Number(p.quantity) || 0,
      minimum_stock: 5,
      sold: p.sold || 0,
      last_updated: p.created_at || new Date().toISOString()
    })),
    ...foods.map(f => ({
      id: f.id,
      name: f.name,
      type: 'food' as const,
      stock: Number(f.stock) || 0,
      minimum_stock: 10,
      sold: f.sold_quantity || 0,
      last_updated: f.created_at || new Date().toISOString()
    }))
  ];

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status logic
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

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Warehouse className="w-5.5 h-5.5 text-[#1E5EF3]" />
          Real-time Stock & Inventory Engine
        </h2>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Automatic "Out of Stock" lockouts applied to customer baskets on threshold breach</p>
      </div>

      {/* Warnings bar */}
      {(lowStockItemsCount > 0 || outOfStockItemsCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs font-bold">
              <span>Attention: </span>
              <span className="font-black">{lowStockItemsCount} items</span> are running below safe thresholds and <span className="font-black">{outOfStockItemsCount} items</span> are completely sold out.
            </div>
          </div>
          <button 
            onClick={() => setStockFilter('lowstock')}
            className="px-4 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-colors shrink-0 self-start sm:self-auto"
          >
            Review Low Stock
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Catalog Items</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{inventoryItems.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Low Stock Warns</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{lowStockItemsCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Out Of Stock</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">{outOfStockItemsCount}</p>
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
                onClick={() => setStockFilter(filter as any)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  stockFilter === filter || (filter === 'all' && !stockFilter)
                    ? "bg-[#1E5EF3] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {filter === 'all' ? 'All Items' : filter === 'instock' ? 'In Stock' : filter === 'lowstock' ? 'Low Stock' : 'Out Of Stock'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search catalog stocks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><LoadingDots /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-4">Item Catalog Name</th>
                    <th className="p-4">Classification</th>
                    <th className="p-4 text-center">Available Stock</th>
                    <th className="p-4 text-center">Min Threshold</th>
                    <th className="p-4 text-center">Quantity Sold</th>
                    <th className="p-4 text-center">Status Badge</th>
                    <th className="p-4 text-right">Quick Stock Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {filteredItems.map(item => {
                    const isOut = item.stock === 0;
                    const isLow = !isOut && item.stock <= item.minimum_stock;
                    const isUpdating = updatingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-black uppercase text-slate-900 tracking-tight">{item.name}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider",
                            item.type === 'food' ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                          )}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-4 text-center font-black">{item.stock}</td>
                        <td className="p-4 text-center text-slate-400">{item.minimum_stock}</td>
                        <td className="p-4 text-center">{item.sold}</td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1",
                            isOut ? "bg-rose-50 text-rose-700" : isLow ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          )}>
                            <span className={cn("w-1 h-1 rounded-full", isOut ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500")} />
                            {isOut ? 'Out Of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickUpdateStock(item.id, item.type, item.stock - 5)}
                              className="w-7 h-7 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg flex items-center justify-center text-xs transition-all font-black"
                            >
                              -5
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickUpdateStock(item.id, item.type, item.stock + 5)}
                              className="w-7 h-7 bg-[#e8f5e9] text-[#2e7d32] border border-emerald-100 rounded-lg flex items-center justify-center text-xs transition-all font-black"
                            >
                              +5
                            </button>
                            {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-[#1E5EF3]" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest">
                        No catalog stocks match your active filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
