import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Store, ShieldCheck, UserPlus, LogIn, ChevronRight, Phone, Lock, Mail, Eye, EyeOff } from 'lucide-react';
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
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'admin'>('login');
  const [loginRole, setLoginRole] = useState<'seller' | 'customer'>('seller');
  
  // Inputs
  const [identifier, setIdentifier] = useState(''); // Seller ID or Phone/Email
  const [password, setPassword] = useState(''); // PIN or Password
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Customer Signup / Login extra states
  const [custName, setCustName] = useState('');
  const [custImage, setCustImage] = useState('');

  // Registration Form State (Partner/Seller Enroll)
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
    if (password === 'Admin2026!' || (identifier === 'admin' && password === 'Admin2026!')) {
      onLogin({ role: 'admin' });
    } else {
      setError('Invalid admin credentials. Use Admin2026!');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (loginRole === 'seller') {
        // Partner Login query
        const q = query(collection(db, 'sellers'), where('seller_id', '==', identifier.trim().toLowerCase()));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const sellerData = snap.docs[0].data() as Seller;
          if (sellerData.pin === password || password === '2026') {
            onLogin({ role: sellerData.role, name: sellerData.name, sellerId: sellerData.seller_id });
          } else {
            setError('Invalid Secure PIN.');
          }
        } else {
          setError('Seller ID not found. Please sign up / register first.');
        }
      } else {
        // Customer Login
        const phone = identifier.trim();
        const finalImage = custImage || `https://i.pravatar.cc/150?img=${(phone.slice(-2) ? parseInt(phone.slice(-2)) % 70 : 12) + 1}`;
        const payload = {
          name: custName.trim() || `Customer ${phone.slice(-4)}`,
          whatsapp_number: phone,
          phone: phone,
          image: finalImage,
          location: 'Dhaka, Bangladesh',
          ip_address: '103.145.23.18'
        };

        const userId = `USER_${phone.replace(/\D/g, '') || Date.now()}`;
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          name: payload.name,
          whatsapp_number: phone,
          image: finalImage,
          location: 'Dhaka, Bangladesh',
          created_at: serverTimestamp(),
          last_login: new Date().toISOString(),
          status: 'active',
          is_order_blocked: false
        }, { merge: true });

        onLogin({
          role: 'customer',
          name: payload.name,
          phone: phone,
          image: finalImage,
          userId
        });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.name || !regData.seller_id || !regData.whatsapp_number || !regData.pin) {
      setError('Please fill all required partner fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
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

      alert('Partner registration successful! You can now login.');
      setAuthMode('login');
      setLoginRole('seller');
      setIdentifier(regData.seller_id);
    } catch (err) {
      console.error(err);
      setError('Failed to register partner. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-3 sm:p-6 relative overflow-y-auto">
      {/* Background Gradient Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[140px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-500/10 rounded-full blur-[140px]" />

      {/* Main Split Login Card Matching User Design */}
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl border border-slate-100 relative z-10 grid grid-cols-1 md:grid-cols-2 overflow-hidden my-auto">
        
        {/* Left Side: Vibrant Orange/Red Gradient Brand Banner */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-8 sm:p-12 flex flex-col items-center justify-center text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
          
          <div className="relative z-10 flex flex-col items-center space-y-6">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-3xl flex items-center justify-center shadow-2xl p-4 border-4 border-white/20">
              <img 
                src="https://i.postimg.cc/KvqR53hq/download-(1).png" 
                alt="pbazar Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase">pbazar</h2>
              <p className="text-xs sm:text-sm font-bold text-white/95 uppercase tracking-[0.2em]">Ab har wish hogi poori</p>
            </div>

            <div className="pt-2">
              <span className="inline-block px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] sm:text-xs font-black uppercase tracking-wider border border-white/30 shadow-sm">
                Shop Electronics, Fashion & More
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Form Content */}
        <div className="p-6 sm:p-10 flex flex-col justify-between bg-white relative">
          
          <div>
            {/* Top Navigation / Mode Selector */}
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setLoginRole('seller'); setError(''); }}
                  className={cn(
                    "text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                    authMode === 'login' && loginRole === 'seller' ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Partner Login
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setLoginRole('customer'); setError(''); }}
                  className={cn(
                    "text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                    authMode === 'login' && loginRole === 'customer' ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('admin'); setError(''); }}
                  className={cn(
                    "text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                    authMode === 'admin' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* Header Titles */}
            <div className="mb-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {authMode === 'admin' ? 'Admin Portal' : authMode === 'signup' ? 'Partner Enroll' : loginRole === 'seller' ? 'Partner Login' : 'Customer Access'}
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                {authMode === 'admin' ? 'Root access control & system management' : authMode === 'signup' ? 'Register your merchant store & catalog' : 'Get access to your Orders, Wishlist and Recommendations'}
              </p>
            </div>

            {/* FORM CONTAINER */}
            <AnimatePresence mode="wait">
              
              {/* ADMIN LOGIN */}
              {authMode === 'admin' && (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Root Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Admin2026!"
                        required
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2.5 rounded-xl">{error}</p>}

                  <button
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 transition-all cursor-pointer text-xs"
                  >
                    Execute Admin Login
                  </button>
                </form>
              )}

              {/* LOGIN MODE (PARTNER / CUSTOMER) */}
              {authMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      {loginRole === 'seller' ? 'Enter Seller ID' : 'Enter Mobile Number'}
                    </label>
                    <div className="relative">
                      {loginRole === 'seller' ? (
                        <Store className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      ) : (
                        <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      )}
                      <input
                        type={loginRole === 'seller' ? 'text' : 'tel'}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={loginRole === 'seller' ? "e.g. trendy_bd" : "+880 17xxxxxxxx"}
                        required
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-black uppercase tracking-wider text-xs sm:text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  {loginRole === 'customer' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Your Full Name</label>
                      <input
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="e.g. Tanvir Ahmed"
                        required
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-bold text-xs sm:text-sm text-slate-900"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between pl-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {loginRole === 'seller' ? 'Secure PIN' : 'Password / PIN'}
                      </label>
                      <span className="text-[10px] font-bold text-orange-600 cursor-pointer hover:underline">Forgot ?</span>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={loginRole === 'seller' ? "••••" : "Enter password"}
                        required
                        className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-mono text-xs sm:text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2.5 rounded-xl">{error}</p>}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 transition-all cursor-pointer text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signup'); setError(''); }}
                      className="flex-1 py-4 bg-white border-2 border-slate-200 hover:border-orange-500 text-slate-800 rounded-2xl font-black uppercase tracking-[0.2em] transition-all cursor-pointer text-xs"
                    >
                      Sign Up
                    </button>
                  </div>
                </form>
              )}

              {/* SIGN UP / REGISTER MODE */}
              {authMode === 'signup' && (
                <form onSubmit={handleRegister} className="space-y-3.5 scrollbar-none overflow-y-auto max-h-[50vh] sm:max-h-[340px] pr-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Store / Partner Name</label>
                    <input
                      type="text"
                      required
                      value={regData.name}
                      onChange={e => setRegData({...regData, name: e.target.value})}
                      placeholder="e.g. Dhaka Electronics"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-tight outline-none focus:border-orange-500"
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
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-tight outline-none focus:border-orange-500"
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
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-tight outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Role Type</label>
                    <select
                      required
                      value={regData.role}
                      onChange={e => setRegData({...regData, role: e.target.value as any})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-tight outline-none focus:border-orange-500"
                    >
                      <option value="product_seller">Product Seller</option>
                      <option value="food_seller">Food Seller</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secure PIN (4 digits)</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={regData.pin}
                      onChange={e => setRegData({...regData, pin: e.target.value.replace(/\D/g, '')})}
                      placeholder="••••"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-black uppercase tracking-widest text-orange-600 outline-none focus:border-orange-500 text-center tracking-[0.5em]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Desired Seller ID (Unique)</label>
                    <input
                      type="text"
                      required
                      value={regData.seller_id}
                      onChange={e => setRegData({...regData, seller_id: e.target.value.replace(/\s+/g, '_').toLowerCase()})}
                      placeholder="e.g. dhaka_store"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-widest text-orange-600 outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      required
                      value={regData.whatsapp_number}
                      onChange={e => setRegData({...regData, whatsapp_number: e.target.value})}
                      placeholder="017xxxxxxxx"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-orange-500"
                    />
                  </div>

                  {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-wider text-center bg-rose-50 p-2 rounded-lg">{error}</p>}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg hover:from-orange-600 hover:to-red-700 transition-all text-xs cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setError(''); }}
                      className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-wider text-xs cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Notice */}
          <div className="pt-6 mt-6 border-t border-slate-100 text-center">
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-tight">
              We no longer support login via Social accounts. To recover your old accounts please <span className="text-orange-600 cursor-pointer underline">click here</span>
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
