import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Loader2, Plus, UserCircle } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleAdd() {
    await addDoc(collection(db, 'employees'), { name, role, email });
    setName(''); setRole(''); setEmail('');
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">Employee Management</h1>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <input className="w-full p-3 border rounded-xl" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full p-3 border rounded-xl" placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
        <input className="w-full p-3 border rounded-xl" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <button onClick={handleAdd} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase cursor-pointer">Add Employee</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
            <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase">
                <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Email</th></tr>
            </thead>
            <tbody className="divide-y">
                {employees.map(e => <tr key={e.id} className="text-sm font-bold text-slate-800"><td className="p-4">{e.name}</td><td className="p-4">{e.role}</td><td className="p-4">{e.email}</td></tr>)}
            </tbody>
        </table>
      </div>
    </div>
  );
}
