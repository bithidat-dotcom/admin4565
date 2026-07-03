import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Store, ShieldCheck, UserPlus, LogIn, ChevronRight, Phone, Eye, EyeOff, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Seller } from '../types';
import ImageUploader from './ImageUploader';
import { cn } from '../lib/utils';

export interface UserSession {
  role: 'admin' | 'seller';
  name?: string;
  sellerId?: string;
}

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'seller' | 'register'>('seller');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [sellerIdInput, setSellerIdInput] = useState('');
  const [sellerPasswordInput, setSellerPasswordInput] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showSellerPass, setShowSellerPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration Form State
  const [regData, setRegData] = useState({
    name: '',
    seller_id: '',
    password: '',
    logo: '',
    whatsapp_number: '',
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
    if (!sellerIdInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const q = query(collection(db, 'sellers'), where('seller_id', '==', sellerIdInput.trim().toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const sellerData = snap.docs[0].data() as Seller;
        
        // Safety check for password - MANDATORY for all sellers now
        if (!sellerData.password) {
          setError('Account has no security password. Please contact admin.');
          setLoading(false);
          return;
        }

        if (sellerData.password !== sellerPasswordInput) {
          setError('Invalid password. Access denied.');
          setLoading(false);
          return;
        }

        onLogin({ role: 'seller', name: sellerData.name, sellerId: sellerData.seller_id });
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
    if (!regData.name || !regData.seller_id || !regData.whatsapp_number || !regData.password) {
      setError('Please fill all required fields (including password)');
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
        <div className="flex px-8 gap-2">
            {[
                { id: 'seller', label: 'Partner Login', icon: LogIn },
                { id: 'register', label: 'Register', icon: UserPlus },
                { id: 'admin', label: 'Admin', icon: ShieldCheck }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setError(''); }}
                    className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all duration-300 border-2",
                        activeTab === tab.id 
                            ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                            : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                    )}
                >
                    <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-brand" : "text-slate-300")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
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
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Safety Password</label>
                            <div className="relative">
                                <input
                                    type={showSellerPass ? "text" : "password"}
                                    value={sellerPasswordInput}
                                    onChange={(e) => setSellerPasswordInput(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSellerPass(!showSellerPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showSellerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
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
                                    placeholder="Enter business name"
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold uppercase tracking-tight outline-none focus:border-brand"
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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Safety Password</label>
                                <div className="relative">
                                    <input
                                        type={showRegPass ? "text" : "password"}
                                        required
                                        value={regData.password}
                                        onChange={e => setRegData({...regData, password: e.target.value})}
                                        placeholder="Minimum 6 characters"
                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:border-brand"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRegPass(!showRegPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
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
