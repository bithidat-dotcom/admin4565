import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Store, ShieldCheck, UserPlus, LogIn, ChevronRight, Phone, Eye, EyeOff, Lock, Users, Upload, Camera, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Seller } from '../types';
import ImageUploader from './ImageUploader';
import { cn } from '../lib/utils';

export interface UserSession {
  role: 'admin' | 'product_seller' | 'food_seller' | 'seller' | 'customer';
  name?: string;
  sellerId?: string;
  phone?: string;
  image?: string;
  userId?: string;
}

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'seller' | 'customer' | 'register'>('seller');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [sellerIdInput, setSellerIdInput] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Customer Login Form State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custLocation, setCustLocation] = useState('Dhaka, Bangladesh');
  const [custImage, setCustImage] = useState('');
  const [isUploadingCustImg, setIsUploadingCustImg] = useState(false);

  // Registration Form State
  const [regData, setRegData] = useState({
    name: '',
    owner_name: '',
    shop_address: '',
    role: 'product_seller' as 'product_seller' | 'food_seller',
    pin: '',
    seller_id: '',
    logo: '',
    whatsapp_number: '',
    facebook: '',
    instagram: '',
    email: ''
  });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Admin2026!' && pin === '4565') {
      onLogin({ role: 'admin' });
    } else {
      setError('Invalid admin credentials');
    }
  };

  const handleSellerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerIdInput.trim() || !pin) return;

    setLoading(true);
    setError('');

    try {
      const q = query(collection(db, 'sellers'), where('seller_id', '==', sellerIdInput.trim().toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const sellerData = snap.docs[0].data() as Seller;
        if (sellerData.pin === pin) {
            onLogin({ role: sellerData.role, name: sellerData.name, sellerId: sellerData.seller_id });
        } else {
            setError('Invalid PIN.');
        }
      } else {
        setError('Seller ID not found. Please register first.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.name || !regData.seller_id || !regData.whatsapp_number) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if seller_id already exists
      const q = query(collection(db, 'sellers'), where('seller_id', '==', regData.seller_id.toLowerCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setError('This Seller ID is already taken. Try another.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'sellers'), {
        ...regData,
        seller_id: regData.seller_id.toLowerCase(),
        is_verified: false,
        rating: 5.0,
        created_at: serverTimestamp()
      });

      alert('Registration successful! You can now login with your Seller ID.');
      setActiveTab('seller');
      setSellerIdInput(regData.seller_id);
    } catch (err) {
      console.error(err);
      setError('Failed to register. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      setError('Please enter your full name and phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const finalImage = custImage || `https://i.pravatar.cc/150?img=${(custPhone.slice(-2) ? parseInt(custPhone.slice(-2)) % 70 : 12) + 1}`;
      const payload = {
        name: custName.trim(),
        whatsapp_number: custPhone.trim(),
        phone: custPhone.trim(),
        image: finalImage,
        location: custLocation.trim() || 'Dhaka, Bangladesh',
        ip_address: '103.145.23.18'
      };

      // 1. Sync to Host Server
      let serverUser: any = null;
      try {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const sData = await res.json();
          serverUser = sData.user;
        }
      } catch (err) {
        console.warn('Server user login error:', err);
      }

      // Check if user is blocked from placing orders
      if (serverUser?.is_order_blocked) {
        setError('Notice: Your account is currently suspended from placing orders by Admin policy. Please contact pbazar support.');
        setLoading(false);
        return;
      }

      // 2. Sync to Firestore
      const userId = serverUser?.id || `USER_${custPhone.replace(/\D/g, '') || Date.now()}`;
      try {
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          name: custName.trim(),
          whatsapp_number: custPhone.trim(),
          image: finalImage,
          location: custLocation.trim() || 'Dhaka, Bangladesh',
          created_at: serverTimestamp(),
          last_login: new Date().toISOString(),
          status: 'active',
          is_order_blocked: false
        }, { merge: true });
      } catch (fbErr) {
        console.warn('Firestore user save warning:', fbErr);
      }

      // 3. Complete login session
      onLogin({
        role: 'customer',
        name: custName.trim(),
        phone: custPhone.trim(),
        image: finalImage,
        userId
      });
    } catch (err: any) {
      setError(err.message || 'Customer login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCustImg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, filename: file.name })
        });
        if (res.ok) {
          const data = await res.json();
          setCustImage(data.url || base64);
        } else {
          setCustImage(base64);
        }
      } catch {
        setCustImage(base64);
      } finally {
        setIsUploadingCustImg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand to-indigo-600" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative z-10 flex flex-col">
        
        {/* Logo & Header */}
        <div className="p-8 pb-4 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-slate-200">
                <Store className="w-8 h-8 text-brand" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">pbazar Partner Hub</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Version 3.0 • Secure Access</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex px-6 gap-1.5">
            {[
                { id: 'seller', label: 'Partner', icon: LogIn },
                { id: 'customer', label: 'Customer', icon: Users },
                { id: 'register', label: 'Enroll', icon: UserPlus },
                { id: 'admin', label: 'Admin', icon: ShieldCheck }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setError(''); }}
                    className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-300 border-2 cursor-pointer",
                        activeTab === tab.id 
                            ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                            : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                    )}
                >
                    <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-brand" : "text-slate-300")} />
                    <span className="text-[8.5px] font-black uppercase tracking-wider">{tab.label}</span>
                </button>
            ))}
        </div>

        <div className="p-8 pt-6">
            <AnimatePresence mode="wait">
                {activeTab === 'admin' && (
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Root Password</label>
                            <div className="relative">
                                <input
                                    type={showAdminPass ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Root Password"
                                    required
                                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAdminPass(!showAdminPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secure PIN</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="••••"
                                required
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-mono text-center tracking-[1em]"
                            />
                        </div>
                        {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2 rounded-lg">{error}</p>}
                        <button
                            type="submit"
                            className="w-full py-4 bg-slate-900 text-brand rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-brand/10 hover:bg-black transition-all group flex items-center justify-center gap-2"
                        >
                            Execute Login
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                    </form>
                )}

                {activeTab === 'seller' && (
                    <form onSubmit={handleSellerLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Partner Seller ID</label>
                            <input
                                type="text"
                                value={sellerIdInput}
                                onChange={(e) => setSellerIdInput(e.target.value)}
                                placeholder="e.g. trendy_bd_01"
                                required
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-black uppercase tracking-widest text-[#6366f1]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secure PIN</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="••••"
                                required
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-mono text-center tracking-[1em]"
                            />
                        </div>
                        {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2 rounded-lg">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 text-brand rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-brand/10 hover:bg-black transition-all group flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Dashboard"}
                            {!loading && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight px-4">
                            Sellers must be pre-registered or authorized by admin to gain catalog access.
                        </p>
                    </form>
                )}

                {activeTab === 'customer' && (
                    <form onSubmit={handleCustomerLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Customer Name</label>
                            <input
                                type="text"
                                value={custName}
                                onChange={(e) => setCustName(e.target.value)}
                                placeholder="e.g. Rahim Ahmed"
                                required
                                className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-bold text-slate-900"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone / WhatsApp Number</label>
                            <div className="relative">
                                <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    value={custPhone}
                                    onChange={(e) => setCustPhone(e.target.value)}
                                    placeholder="017xxxxxxxx"
                                    required
                                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-bold text-slate-900"
                                />
                            </div>
                        </div>

                        {/* Customer Profile Image */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Profile Photo</label>
                                <span className="text-[9px] text-brand font-bold">Auto-assigned if empty</span>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                                <img
                                    src={custImage || "https://i.pravatar.cc/150?img=12"}
                                    alt="Preview"
                                    className="w-12 h-12 rounded-full object-cover border-2 border-brand/30 shadow-xs shrink-0"
                                />
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-xs transition-all">
                                        <Upload className="w-3.5 h-3.5 text-brand" />
                                        <span>{isUploadingCustImg ? "Uploading..." : "Upload Photo"}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCustomerImageUpload}
                                            className="hidden"
                                            disabled={isUploadingCustImg}
                                        />
                                    </label>
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                        {['11', '12', '32', '60', '68'].map(id => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setCustImage(`https://i.pravatar.cc/150?img=${id}`)}
                                                className={cn(
                                                    "w-6 h-6 rounded-full overflow-hidden border-2 transition-all shrink-0 cursor-pointer",
                                                    custImage === `https://i.pravatar.cc/150?img=${id}` ? "border-brand scale-110" : "border-transparent opacity-70 hover:opacity-100"
                                                )}
                                            >
                                                <img src={`https://i.pravatar.cc/150?img=${id}`} alt="avatar" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Delivery City / Area</label>
                            <input
                                type="text"
                                value={custLocation}
                                onChange={(e) => setCustLocation(e.target.value)}
                                placeholder="e.g. Dhanmondi, Dhaka"
                                className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-bold text-xs text-slate-900"
                            />
                        </div>

                        {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2.5 rounded-xl border border-rose-200">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading || isUploadingCustImg}
                            className="w-full py-4 bg-[#1E5EF3] text-white hover:bg-blue-700 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all group flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In Customer"}
                            {!loading && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight px-4">
                            Your profile photo and phone number are automatically synced to Customer CRM & Server.
                        </p>
                    </form>
                )}

                {activeTab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4 scrollbar-none overflow-y-auto max-h-[350px] pr-1">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Store / Partner Name</label>
                                <input
                                    type="text"
                                    required
                                    value={regData.name}
                                    onChange={e => setRegData({...regData, name: e.target.value})}
                                    placeholder="Enter shop name"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold uppercase tracking-tight outline-none focus:border-brand"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Owner Name</label>
                                <input
                                    type="text"
                                    required
                                    value={regData.owner_name}
                                    onChange={e => setRegData({...regData, owner_name: e.target.value})}
                                    placeholder="Enter owner name"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold uppercase tracking-tight outline-none focus:border-brand"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Shop Address</label>
                                <input
                                    type="text"
                                    required
                                    value={regData.shop_address}
                                    onChange={e => setRegData({...regData, shop_address: e.target.value})}
                                    placeholder="Enter shop address"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold uppercase tracking-tight outline-none focus:border-brand"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Role</label>
                                <select
                                    required
                                    value={regData.role}
                                    onChange={e => setRegData({...regData, role: e.target.value as any})}
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold uppercase tracking-tight outline-none focus:border-brand"
                                >
                                    <option value="product_seller">Product Seller</option>
                                    <option value="food_seller">Food Seller</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">PIN (4 digits)</label>
                                <input
                                    type="password"
                                    required
                                    maxLength={4}
                                    value={regData.pin}
                                    onChange={e => setRegData({...regData, pin: e.target.value.replace(/\D/g, '')})}
                                    placeholder="••••"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-black uppercase tracking-widest text-indigo-600 outline-none focus:border-brand text-center"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Desired Seller ID (Unique)</label>
                                <input
                                    type="text"
                                    required
                                    value={regData.seller_id}
                                    onChange={e => setRegData({...regData, seller_id: e.target.value.replace(/\s+/g, '_').toLowerCase()})}
                                    placeholder="e.g. fashion_hub"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-black uppercase tracking-widest text-indigo-600 outline-none focus:border-brand"
                                />
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider pl-1">This will be your permanent login key</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="tel"
                                        required
                                        value={regData.whatsapp_number}
                                        onChange={e => setRegData({...regData, whatsapp_number: e.target.value})}
                                        placeholder="017xxxxxxxx"
                                        className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:border-brand"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facebook Profile URL</label>
                                <input
                                    type="url"
                                    value={regData.facebook}
                                    onChange={e => setRegData({...regData, facebook: e.target.value})}
                                    placeholder="facebook.com/..."
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:border-brand"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Instagram Profile URL (Optional)</label>
                                <input
                                    type="url"
                                    value={regData.instagram}
                                    onChange={e => setRegData({...regData, instagram: e.target.value})}
                                    placeholder="instagram.com/..."
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:border-brand"
                                />
                            </div>
                            <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                                    Store Logo
                                    <span className="text-[8px] bg-slate-100 px-1.5 rounded">Optional</span>
                                </label>
                                <ImageUploader 
                                    value={regData.logo}
                                    onChange={url => setRegData({...regData, logo: url})}
                                    folder="sellers"
                                />
                            </div>
                        </div>
                        {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2 rounded-lg">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all group flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Request Enrollment"}
                            {!loading && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </form>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
