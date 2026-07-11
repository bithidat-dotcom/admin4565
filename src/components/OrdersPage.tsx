import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, where, getDocs, limit, or, addDoc, serverTimestamp } from 'firebase/firestore';
import { Order, Product } from '../types';
import Header from '../components/Header';
import Modal from './Modal';
import OrderTableView from './OrderTableView';
import LoadingDots from './LoadingDots';
import { Loader2, Phone, MapPin, Package, Clock, CheckCircle, Search, Trash2, ShieldCheck, Lock, Copy, Check, MessageSquare, Store, ShoppingBag, Truck, Coins, Printer, MoreVertical, Sparkles, Minus, PlusCircle } from 'lucide-react';
import { formatCurrency, cn, exportToCSV } from '../lib/utils';
import { Storage } from '../lib/storage';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from 'lucide-react';
import { decryptData, encryptData } from '../lib/security';
import { handlePrint } from '../lib/printing';

interface OrdersPageProps {
  userSession?: any;
}

export default function OrdersPage({ userSession }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isSeller = userSession?.role === 'seller';
  const currentSellerId = userSession?.sellerId || '';
  const currentSellerName = userSession?.name || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [otpVerifyOrderId, setOtpVerifyOrderId] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isTableView, setIsTableView] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [newOrderData, setNewOrderData] = useState({
    customer_name: '',
    whatsapp_number: '',
    location: '',
    area: '',
    post_code: '',
    seller_name: '',
    items: [{ product_id: '', custom_product_name: '', custom_price: '', quantity: 1 }],
    delivery_charge: 120
  });

  const addItem = () => {
    setNewOrderData({
      ...newOrderData,
      items: [...newOrderData.items, { product_id: '', custom_product_name: '', custom_price: '', quantity: 1 }]
    });
  };

  const removeItem = (index: number) => {
    if (newOrderData.items.length <= 1) return;
    const newItems = [...newOrderData.items];
    newItems.splice(index, 1);
    setNewOrderData({ ...newOrderData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...newOrderData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If selecting a product, clear custom fields
    if (field === 'product_id' && value) {
      newItems[index].custom_product_name = '';
      newItems[index].custom_price = '';
    }
    
    setNewOrderData({ ...newOrderData, items: newItems });
  };
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Record<string, any>>({});

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe Non-Blocking Confirmation States
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const [sellerSearch, setSellerSearch] = useState('');

  useEffect(() => {
    if (isQuotaExceeded()) return;
    // 0. Load cache for instant display
    const loadCache = async () => {
      const cachedOrders = await Storage.getLarge<Order[]>('orders_page_cache');
      if (cachedOrders && !isSeller && !sellerSearch) {
        setOrders(cachedOrders);
      }
      
      const cachedSellers = Storage.getSmall<Record<string, any>>('sellers_map_cache');
      if (cachedSellers) {
        setSellers(cachedSellers);
      }
    };
    loadCache();

    // 1. Listen to limited set of recent orders (quota saving)
    let q;
    if (isSeller) {
      q = query(
        collection(db, 'orders'), 
        or(
          where('seller_id', '==', currentSellerId),
          where('seller', '==', currentSellerName)
        ),
        limit(50)
      );
    } else if (sellerSearch.trim()) {
      // Admin searching for specific seller orders
      const search = sellerSearch.trim();
      const searchLower = search.toLowerCase();
      q = query(
        collection(db, 'orders'),
        where('seller_id', '==', searchLower),
        limit(50)
      );
    } else {
      q = query(collection(db, 'orders'), limit(50));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let ordersData = snapshot.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...rawData,
          customer_name: decryptData(rawData.customer_name),
          whatsapp_number: decryptData(rawData.whatsapp_number),
          location: decryptData(rawData.location),
          area: rawData.area ? decryptData(rawData.area) : '',
          post_code: rawData.post_code ? decryptData(rawData.post_code) : '',
          product_details: decryptData(rawData.product_details),
          created_at: rawData.created_at?.toDate?.()?.toISOString() || rawData.created_at || new Date().toISOString()
        };
      }) as Order[];
      
      // Client-side sort since we removed orderBy for index-free where queries
      ordersData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOrders(ordersData);
      if (!isSeller && !sellerSearch) {
        Storage.setLarge('orders_page_cache', ordersData);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // 2. Fetch sellers once (they don't change often)
    const fetchSellers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'sellers'));
        const sellersMap: Record<string, any> = {};
        snapshot.docs.forEach(doc => {
          sellersMap[doc.data().name] = { id: doc.id, ...doc.data() };
        });
        setSellers(sellersMap);
        Storage.setSmall('sellers_map_cache', sellersMap);
      } catch (err) {
        console.warn("Failed to fetch sellers map, might be quota issue:", err);
      }
    };
    fetchSellers();

    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), limit(50));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product));
      } catch (err) {
        console.warn("Failed to fetch products for order creation:", err);
      }
    };
    fetchProducts();

    return () => {
      unsubscribe();
    };
  }, [isSeller, currentSellerId, sellerSearch]);

  const syncUserStats = async (whatsappNumber: string) => {
    if (!whatsappNumber) return;
    try {
      // 1. Fetch user by whatsapp_number
      const usersQuery = query(
        collection(db, 'users'), 
        where('whatsapp_number', '==', whatsappNumber), 
        limit(1)
      );
      const userSnap = await getDocs(usersQuery);
      if (userSnap.empty) {
        console.log("No registered customer profile found for whatsapp number:", whatsappNumber);
        return;
      }
      const userDoc = userSnap.docs[0];
      const userId = userDoc.id;

      // 2. Fetch all orders for this WhatsApp number
      const ordersQuery = query(
        collection(db, 'orders'),
        where('whatsapp_number', '==', whatsappNumber)
      );
      const ordersSnap = await getDocs(ordersQuery);
      
      const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as Order);
      
      // Calculate stats based ONLY on completed orders
      const completedOrders = allOrders.filter(o => o.status === 'completed');
      const totalOrdersCount = completedOrders.length;
      const totalSpentAmount = completedOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
      
      // 10% Cashback earned on all completed orders!
      const rewardWalletBalance = Math.round(totalSpentAmount * 0.10); 

      await updateDoc(doc(db, 'users', userId), {
        total_orders: totalOrdersCount,
        total_spent: totalSpentAmount,
        wallet_balance: rewardWalletBalance
      });
    } catch (err) {
      console.error("Error syncing customer stats:", err);
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    if (newStatus === 'confirmed') {
      initiateOtpVerification(id);
      return;
    }
    
    setStatusUpdatingId(id);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'cancelled') {
        updates.cancelled_by = 'admin';
      }
      await updateDoc(doc(db, 'orders', id), updates);

      // Sync stats of the user
      const updatedOrder = orders.find(o => o.id === id);
      if (updatedOrder && updatedOrder.whatsapp_number) {
        setTimeout(() => {
          syncUserStats(updatedOrder.whatsapp_number);
        }, 500);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (order.customer_name?.toLowerCase() || '').includes(searchLower) ||
      (order.whatsapp_number || '').includes(searchQuery) ||
      (order.product_name?.toLowerCase() || '').includes(searchLower) ||
      (order.product_details?.toLowerCase() || '').includes(searchLower) ||
      (order.location?.toLowerCase() || '').includes(searchLower) ||
      (order.seller?.toLowerCase() || '').includes(searchLower) ||
      (order.seller_id?.toLowerCase() || '').includes(searchLower) ||
      (order.id.toLowerCase().includes(searchLower));

    const matchesDate = dateFilter 
      ? isSameDay(new Date(order.created_at), new Date(dateFilter))
      : true;

    return matchesSearch && matchesDate;
  });

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedOrders(newSelection);
  };

  const selectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleDeleteOrder = (id: string) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const id = orderToDelete;
    setOrderToDelete(null);
    setDeletingId(id);
    try {
      const orderToDeleteDoc = orders.find(o => o.id === id);
      const whatsappNumber = orderToDeleteDoc?.whatsapp_number;

      await deleteDoc(doc(db, 'orders', id));

      if (whatsappNumber) {
        setTimeout(() => {
          syncUserStats(whatsappNumber);
        }, 500);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const initiateOtpVerification = (id: string) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setOtpVerifyOrderId(id);
    setEnteredOtp('');
    setOtpError('');
    
    // Simulate sending SMS
    console.log(`[OTP SENT] To order ${id}: ${otp}`);
    alert(`Verification PIN: ${otp} (Simulated SMS sent to buyer)`);
  };

  const verifyOtp = async () => {
    if (enteredOtp === generatedOtp) {
      if (otpVerifyOrderId) {
        setStatusUpdatingId(otpVerifyOrderId);
        try {
          await updateDoc(doc(db, 'orders', otpVerifyOrderId), { status: 'confirmed' });
          setOtpVerifyOrderId(null);
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `orders/${otpVerifyOrderId}`);
        } finally {
          setStatusUpdatingId(null);
        }
      }
    } else {
      setOtpError('Invalid OTP code. Please check again.');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOrder(true);

    const validItems = newOrderData.items.filter(item => item.product_id || item.custom_product_name);
    
    if (validItems.length === 0) {
      alert("Please add at least one product");
      setSubmittingOrder(false);
      return;
    }

    try {
      // Process all items
      const processedItems = validItems.map(item => {
        const selectedProduct = products.find(p => p.id === item.product_id);
        return {
          name: selectedProduct ? selectedProduct.name : item.custom_product_name,
          price: selectedProduct ? selectedProduct.price : Number(item.custom_price || 0),
          quantity: item.quantity,
          image: selectedProduct ? selectedProduct.image : 'https://i.postimg.cc/KvqR53hq/download-(1).png',
          seller: isSeller ? currentSellerName : (newOrderData.seller_name || selectedProduct?.seller || 'pbazar Official'),
          seller_id: isSeller ? currentSellerId : (selectedProduct?.seller_id || '')
        };
      });

      const totalProductPrice = processedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const combinedNames = processedItems.map(item => `${item.name} (x${item.quantity})`).join(', ');

      const orderPayload = {
        customer_name: encryptData(newOrderData.customer_name),
        whatsapp_number: encryptData(newOrderData.whatsapp_number),
        location: encryptData(newOrderData.location),
        area: encryptData(newOrderData.area),
        post_code: encryptData(newOrderData.post_code),
        product_details: encryptData(combinedNames),
        product_name: processedItems[0].name + (processedItems.length > 1 ? ` (+${processedItems.length - 1} more)` : ''),
        product_image: processedItems[0].image,
        price: totalProductPrice / (processedItems.reduce((sum, item) => sum + item.quantity, 0) || 1),
        quantity: processedItems.reduce((sum, item) => sum + item.quantity, 0),
        delivery_charge: newOrderData.delivery_charge,
        status: 'pending',
        seller: processedItems[0].seller,
        seller_id: processedItems[0].seller_id,
        items: processedItems,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderPayload);
      setIsAddModalOpen(false);
      setNewOrderData({
        customer_name: '',
        whatsapp_number: '',
        location: '',
        area: '',
        post_code: '',
        seller_name: '',
        items: [{ product_id: '', custom_product_name: '', custom_price: '', quantity: 1 }],
        delivery_charge: 120
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const fillDemoData = () => {
    const demoNames = ['Arif Ahmed', 'Sumaiya Islam', 'Rakib Hasan', 'Nusrat Jahan'];
    const demoLocations = ['House 12, Road 5, Dhanmondi', 'Flat 4B, Sector 7, Uttara', 'Mirpur 10, Block C', 'Banani 11, Plot 88'];
    const demoAreas = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi'];
    
    const randomIdx = Math.floor(Math.random() * 4);
    const randomProduct = products.length > 0 ? products[Math.floor(Math.random() * products.length)].id : '';

    const demoSellers = ['Style Hub', 'ElectroWorld', 'Fashion Nova BD', 'Gaget Zone', 'Daily Mart'];
    
    setNewOrderData({
      customer_name: demoNames[randomIdx],
      whatsapp_number: `017${Math.floor(10000000 + Math.random() * 90000000)}`,
      location: demoLocations[randomIdx],
      area: demoAreas[randomIdx],
      post_code: `${1000 + Math.floor(Math.random() * 9000)}`,
      seller_name: demoSellers[Math.floor(Math.random() * demoSellers.length)],
      items: [{ 
        product_id: randomProduct, 
        custom_product_name: '', 
        custom_price: '', 
        quantity: 1 + Math.floor(Math.random() * 2) 
      }],
      delivery_charge: 120
    });
  };

  const handleDownloadPreview = async () => {
    const validItems = newOrderData.items.filter(item => item.product_id || item.custom_product_name);
    
    if (validItems.length === 0) {
      alert("Please add at least one product first.");
      return;
    }

    const { generateInvoicePDF } = await import('../lib/printing');
    
    const processedItems = validItems.map(item => {
      const selectedProduct = products.find(p => p.id === item.product_id);
      return {
        name: selectedProduct ? selectedProduct.name : item.custom_product_name,
        price: selectedProduct ? selectedProduct.price : Number(item.custom_price || 0),
        quantity: item.quantity,
        seller: isSeller ? currentSellerName : (selectedProduct?.seller || 'pbazar Official')
      };
    });

    const totalProductPrice = processedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const combinedNames = processedItems.map(item => `${item.name} (x${item.quantity})`).join(', ');

    const tempOrder = {
      id: 'PREVIEW-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      customer_name: newOrderData.customer_name || 'Walking Customer',
      whatsapp_number: newOrderData.whatsapp_number || '01XXXXXXXXX',
      location: newOrderData.location || 'N/A',
      area: newOrderData.area || 'N/A',
      post_code: newOrderData.post_code || 'N/A',
      product_name: combinedNames,
      price: totalProductPrice / processedItems.reduce((sum, i) => sum + i.quantity, 0), // Average price per unit for the simple PDF template
      quantity: processedItems.reduce((sum, item) => sum + item.quantity, 0),
      delivery_charge: newOrderData.delivery_charge,
      status: 'pending' as const,
      seller: processedItems[0].seller,
      items: processedItems,
      created_at: new Date().toISOString()
    };

    generateInvoicePDF(tempOrder);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'confirmed': return 'bg-teal-100 text-teal-700';
      case 'packing': return 'bg-blue-100 text-blue-700';
      case 'shipping': return 'bg-orange-100 text-orange-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'completed': return 'bg-brand text-white';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden pb-24 md:pb-0">
      <Header 
        title="Orders" 
        onAction={() => setIsAddModalOpen(true)}
        actionLabel="New Order"
        onSearch={setSearchQuery} 
      />

      <main className="p-4 md:p-8">
        {/* Quick Stats Summary Box */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Volume</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-tight">{orders.length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Orders Processed</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confirmed</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-tight">{orders.filter(o => o.status === 'confirmed').length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Ready to Ship</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivered</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Truck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-tight">{orders.filter(o => o.status === 'delivered' || o.status === 'completed').length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Successful Deliveries</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Sales</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-tight">৳{orders.reduce((acc, o) => acc + (o.price || 0), 0).toLocaleString()}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Revenue Stream</p>
              </div>
            </div>
          </div>
          <div className="bg-brand p-6 rounded-3xl shadow-xl shadow-brand/20 hover:shadow-brand/30 transition-all cursor-pointer group" onClick={() => setIsAddModalOpen(true)}>
             <div className="flex items-center justify-between mb-2">
                <Sparkles className="w-5 h-5 text-white/80 group-hover:rotate-12 transition-transform" />
                <span className="text-[8px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Demo System</span>
             </div>
             <p className="text-sm font-black text-white uppercase tracking-wider">Quick Demo Order</p>
             <p className="text-[9px] text-white/60 font-bold uppercase mt-1">Add sample data instantly</p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
             <button onClick={() => setIsTableView(true)} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", isTableView ? "bg-brand text-white shadow-md shadow-brand/20" : "text-slate-400 hover:text-slate-600")}>Table View</button>
             <button onClick={() => setIsTableView(false)} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", !isTableView ? "bg-brand text-white shadow-md shadow-brand/20" : "text-slate-400 hover:text-slate-600")}>Card View</button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer" onClick={selectAll}>
              <input 
                type="checkbox" 
                checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                onChange={selectAll}
                className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Select All
            </div>

            <button 
                onClick={() => exportToCSV(filteredOrders, 'orders')}
                className="bg-white border border-brand/20 text-brand rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-brand-light transition-all shadow-sm"
            >
                Export CSV
            </button>

            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest w-full"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-[10px] text-red-500 font-bold hover:underline ml-2">
                  CLEAR
                </button>
              )}
            </div>

            {!isSeller && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3 w-full sm:w-64">
                <Store className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="FIND SELLER ID..."
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest w-full"
                />
                {sellerSearch && (
                  <button onClick={() => setSellerSearch('')} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest w-full"
              />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 flex items-center gap-2 font-bold uppercase tracking-widest hidden lg:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Shipments Tracked
          </div>
        </div>



        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingDots />
          </div>
        ) : (
          <div className="space-y-4">
            {isTableView ? (
              <OrderTableView 
                orders={filteredOrders} 
                onStatusChange={updateStatus} 
                statusUpdatingId={statusUpdatingId}
                selectedOrders={selectedOrders}
                onToggleSelection={toggleSelection}
                onSelectAll={selectAll}
              />
            ) : (
                <AnimatePresence mode="popLayout">
                  {filteredOrders.map((order) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={order.id}
                      className={cn(
                        "bg-white rounded-[40px] border overflow-hidden shadow-2xl shadow-slate-200/50 hover:shadow-brand/10 transition-all duration-700 group relative",
                        selectedOrders.has(order.id) ? "border-brand ring-4 ring-brand/5" : "border-slate-100"
                      )}
                    >
                      {/* Selection Overlay */}
                      <div className="absolute top-8 right-8 z-20">
                        <input 
                          type="checkbox" 
                          className="w-6 h-6 rounded-xl border-slate-200 text-brand focus:ring-brand cursor-pointer shadow-sm transition-all"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => toggleSelection(order.id)}
                        />
                      </div>

                      {/* Status Indicator Bar */}
                      <div className={cn("h-2.5 w-full", getStatusColor(order.status).split(' ')[0])} />

                      <div className="p-10">
                        {/* Header: ID and Status */}
                        <div className="flex items-start justify-between mb-10 pr-12">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", getStatusColor(order.status).split(' ')[0])} />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">ORDER ID #{order.id.slice(-6).toUpperCase()}</p>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{order.customer_name || 'Generic Customer'}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(order.created_at), 'MMMM d, yyyy • h:mm a')}</p>
                          </div>
                          <div className={cn(
                            "px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-current/5 ring-1 ring-inset transition-all",
                            getStatusColor(order.status).replace('text-', 'ring-').replace('bg-', 'bg-opacity-50 ')
                          )}>
                            {order.status}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                          {/* Left Side: Contact and Location */}
                          <div className="lg:col-span-5 space-y-6">
                            <div className="flex items-center gap-5 bg-slate-50 p-5 rounded-[32px] border border-slate-100 group-hover:bg-white transition-all duration-500 hover:shadow-inner">
                              <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0 shadow-inner">
                                <Phone className="w-6 h-6 text-brand" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Primary Contact</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xl font-black text-slate-900 tracking-tight truncate">{order.whatsapp_number}</p>
                                  <a
                                    href={`https://wa.me/${order.whatsapp_number?.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all shadow-sm"
                                  >
                                    <MessageSquare className="w-5 h-5" />
                                  </a>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-5 p-4 bg-rose-50/30 rounded-[32px] border border-rose-100/50">
                              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                                <MapPin className="w-6 h-6 text-rose-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Shipping Hub</p>
                                <p className="text-sm font-bold text-slate-600 leading-relaxed line-clamp-2">{order.location}</p>
                                {(order.area || order.post_code) && (
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {order.area && (
                                      <span className="text-[9px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                        Area: {order.area}
                                      </span>
                                    )}
                                    {order.post_code && (
                                      <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                        Post: {order.post_code}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Product Details */}
                          <div className="lg:col-span-7 bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden group/payload shadow-2xl shadow-slate-900/20">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl transition-all duration-700 group-hover/payload:scale-150" />
                            <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4 items-start">
                                  {order.product_image && (
                                    <img src={order.product_image} referrerPolicy="no-referrer" alt="Product" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/10 shadow-xl shrink-0" />
                                  )}
                                  <div className="flex-1">
                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Item Payload</p>
                                    <h4 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">{order.product_name || 'Generic Product'}</h4>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black bg-brand/20 text-brand px-2 py-1 rounded-md uppercase">Batch 1.0</span>
                                      <span className="text-[10px] font-black bg-white/10 text-white/60 px-2 py-1 rounded-md uppercase">{order.quantity || 1} Units</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Grand Total</p>
                                  <p className="text-3xl font-black text-white tracking-tighter">৳{((order.price || 0) * (Number(order.quantity) || 1) + (order.delivery_charge || 120)).toLocaleString()}</p>
                                  {order.delivery_charge && order.delivery_charge !== 0 && (
                                    <p className="text-[8px] text-white/40 font-bold uppercase mt-1">Inc. ৳{order.delivery_charge} Delivery</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest shrink-0">Specs:</p>
                                <p className="text-xs font-medium text-white/60 truncate italic">
                                  {order.product_details || 'No specific parameters provided.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions and Footer */}
                        <div className="mt-10 pt-10 border-t border-slate-100 flex flex-wrap items-center justify-between gap-8">
                          <div className="flex items-center gap-4">
                            {order.seller_logo ? (
                              <img src={order.seller_logo} referrerPolicy="no-referrer" alt="S" className="w-14 h-14 rounded-2xl object-cover border-4 border-white shadow-xl" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border-4 border-white shadow-xl">
                                <Store className="w-6 h-6 text-slate-300" />
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fulfillment Partner</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{order.seller || 'pbazar Official'}</p>
                                {order.seller_id && (
                                  <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded border border-indigo-100">ID: {order.seller_id}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified Merchant</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handlePrint(order)}
                              className="flex items-center gap-3 px-8 py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border border-slate-200/50 shadow-sm"
                            >
                              <Printer className="w-4 h-4" />
                              Print Invoice
                            </button>
                            
                            <div className="relative group/menu">
                              <button className="p-4 bg-brand hover:bg-brand-dark text-white rounded-[24px] shadow-2xl shadow-brand/30 transition-all active:scale-95">
                                <MoreVertical className="w-6 h-6" />
                              </button>
                              
                              <div className="absolute bottom-full right-0 mb-4 w-64 bg-white rounded-[32px] p-4 shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-500 z-50 translate-y-4 group-hover/menu:translate-y-0 backdrop-blur-xl border border-slate-100">
                                <p className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-3">Lifecycle Control</p>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'completed', 'cancelled'].map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => updateStatus(order.id, status as Order['status'])}
                                      disabled={statusUpdatingId === order.id}
                                      className={cn(
                                        "px-5 py-2.5 text-left rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        order.status === status ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                      )}
                                    >
                                      {statusUpdatingId === order.id && order.status === status ? <Loader2 className="w-3 h-3 animate-spin mx-auto"/> : status}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-50">
                                  <button 
                                    onClick={() => handleDeleteOrder(order.id)}
                                    disabled={deletingId === order.id}
                                    className="w-full px-5 py-3 text-left text-rose-500 hover:bg-rose-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                    Purge Data Record
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
            )}
            
            {filteredOrders.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No active shipments found</p>
                <p className="text-sm">Real-time orders will appear here automatically.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        isOpen={otpVerifyOrderId !== null}
        onClose={() => setOtpVerifyOrderId(null)}
        title="Buyer OTP Verification"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Confirming Order For</p>
            {otpVerifyOrderId && orders.find(o => o.id === otpVerifyOrderId) && (
              <div className="text-center">
                <p className="text-lg font-black text-slate-900 uppercase">
                  {orders.find(o => o.id === otpVerifyOrderId)?.customer_name}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1 text-emerald-600">
                  <Phone className="w-3 h-3" />
                  <p className="text-sm font-bold tracking-tight">
                    {orders.find(o => o.id === otpVerifyOrderId)?.whatsapp_number}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Enter 4-Digit OTP Code</label>
            <div className="flex justify-center gap-3">
              <input
                type="text"
                maxLength={4}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="0 0 0 0"
                className="w-full max-w-[200px] text-center text-3xl font-black tracking-[0.5em] py-4 rounded-2xl bg-white border-2 border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all font-mono"
              />
            </div>
            {otpError && <p className="text-rose-500 text-[10px] font-black uppercase text-center">{otpError}</p>}
            <p className="text-[9px] text-slate-400 text-center font-bold">The buyer should have received an OTP via WhatsApp or SMS.</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={verifyOtp}
              disabled={enteredOtp.length < 4 || statusUpdatingId !== null}
              className="flex-1 py-4 bg-brand hover:bg-brand-dark active:bg-orange-700 active:scale-95 disabled:bg-slate-200 transition-all text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {statusUpdatingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify & Confirm
            </button>
            <button
              onClick={() => setOtpVerifyOrderId(null)}
              className="px-6 py-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <button 
            onClick={() => initiateOtpVerification(otpVerifyOrderId!)}
            className="w-full text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
          >
            Resend OTP Code
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Manual Order"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-brand/5 p-4 rounded-2xl border border-brand/10">
          <div>
            <p className="text-[10px] font-black text-brand uppercase tracking-widest">Demo System Active</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Use sample data for presentation</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleDownloadPreview}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Printer className="w-3 h-3" />
              Download PDF
            </button>
            <button 
              type="button"
              onClick={fillDemoData}
              className="px-4 py-2 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand/20 active:scale-95 transition-all"
            >
              Fill Demo Data
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer Name</label>
            <input
              required
              type="text"
              value={newOrderData.customer_name}
              onChange={e => setNewOrderData({...newOrderData, customer_name: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
              placeholder="Full Name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WhatsApp Number</label>
            <input
              required
              type="tel"
              value={newOrderData.whatsapp_number}
              onChange={e => setNewOrderData({...newOrderData, whatsapp_number: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
              placeholder="e.g. 01700000000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shipping Location</label>
            <textarea
              required
              value={newOrderData.location}
              onChange={e => setNewOrderData({...newOrderData, location: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
              placeholder="Full Address"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Area / City</label>
              <input
                required
                type="text"
                value={newOrderData.area}
                onChange={e => setNewOrderData({...newOrderData, area: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                placeholder="e.g. Dhaka"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Post Code</label>
              <input
                type="text"
                value={newOrderData.post_code}
                onChange={e => setNewOrderData({...newOrderData, post_code: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Name</label>
              <input
                type="text"
                value={newOrderData.seller_name}
                onChange={e => setNewOrderData({...newOrderData, seller_name: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                placeholder="Shop Name"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order Items</label>
              <button 
                type="button" 
                onClick={addItem}
                className="flex items-center gap-1.5 text-brand hover:text-brand-dark transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Add Product</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {newOrderData.items.map((item, index) => (
                <div key={index} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 relative group/item">
                  {newOrderData.items.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/item:opacity-100 transition-all z-10"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Product</label>
                      <select
                        value={item.product_id}
                        onChange={e => updateItem(index, 'product_id', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                      >
                        <option value="">Choose from inventory...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                        ))}
                      </select>
                    </div>

                    {!item.product_id && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custom Name</label>
                          <input
                            type="text"
                            value={item.custom_product_name}
                            onChange={e => updateItem(index, 'custom_product_name', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                            placeholder="Product name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Price (৳)</label>
                          <input
                            type="number"
                            value={item.custom_price}
                            onChange={e => updateItem(index, 'custom_price', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity</label>
              <input
                required
                type="number"
                min="1"
                value={newOrderData.quantity}
                onChange={e => setNewOrderData({...newOrderData, quantity: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Delivery Charge (৳)</label>
              <input
                required
                type="number"
                min="0"
                value={newOrderData.delivery_charge}
                onChange={e => setNewOrderData({...newOrderData, delivery_charge: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand text-xs font-bold"
              />
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Default is 120 Taka</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingOrder}
            className="w-full py-4 bg-brand hover:bg-brand-dark text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
          >
            {submittingOrder ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Manual Order'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={orderToDelete !== null}
        onClose={() => setOrderToDelete(null)}
        title="Delete Order Permanently?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you absolutely sure you want to permanently delete this order? This action cannot be undone.
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmDeleteOrder}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-black active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 cursor-pointer"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setOrderToDelete(null)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
