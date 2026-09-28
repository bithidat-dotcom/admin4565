import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { UserSession } from '../App';
import ImageUploader from './ImageUploader';

interface ProfilePageProps {
  userSession: UserSession | null;
}

export default function ProfilePage({ userSession }: ProfilePageProps) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!userSession?.sellerId) return;
    const loadProfile = async () => {
        const q = query(collection(db, 'sellers'), where('seller_id', '==', userSession.sellerId));
        const snap = await getDocs(q);
        if (!snap.empty) setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
    };
    loadProfile();
  }, [userSession]);

  const updateLogo = async (url: string) => {
    if (!profile?.id) return;
    await updateDoc(doc(db, 'sellers', profile.id), { logo: url });
    setProfile({ ...profile, logo: url });
  };

  if (!profile) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Store Profile</h2>
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
            <ImageUploader value={profile.logo} onChange={updateLogo} folder="sellers" />
            <div>
                <h3 className="font-bold text-lg">{profile.name}</h3>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">{profile.role}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
