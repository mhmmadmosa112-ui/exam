'use client';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../lib/firebase';
import { useRouter } from 'next/navigation';

export default function AdminProfilePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    birthdate: '',
    imageUrl: '',
    specialization: '',
    bio: '',
    username: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    const load = async () => {
      if (!user?.email) return;
      try {
        const res = await fetch('http://localhost:3001/api/admin-profile', { headers: { 'x-user-email': user.email } });
        const data = await res.json();
        if (data.success) {
          const p = data.data.profile || {};
          setForm({
            fullName: p.fullName || '',
            birthdate: p.birthdate ? new Date(p.birthdate).toISOString().slice(0, 10) : '',
            imageUrl: p.imageUrl || '',
            specialization: p.specialization || '',
            bio: p.bio || '',
            username: p.username || ''
          });
        }
      } catch (e: any) {
        setError('Failed to load profile');
      }
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user?.email) return;
    try {
      setSaving(true);
      setError('');
      const payload = {
        profile: {
          fullName: form.fullName.trim(),
          birthdate: form.birthdate ? new Date(form.birthdate) : undefined,
          imageUrl: form.imageUrl.trim(),
          specialization: form.specialization.trim(),
          bio: form.bio.trim(),
          username: form.username.trim()
        }
      };
      const res = await fetch('http://localhost:3001/api/admin-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) setError(data.error || 'Failed to save');
    } catch (e: any) {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Profile</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Full Name</label>
            <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Birthdate</label>
            <input type="date" value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Profile Image URL</label>
            <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Specialization</label>
            <input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-black mb-1">Bio</label>
            <textarea rows={4} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </main>
    </div>
  );
}
