'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function AdminResultReviewPage() {
  const params = useParams();
  const id = params?.id as string;
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isReviewed, setIsReviewed] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, { isCorrect?: boolean; awardedPoints?: number }>>({});

  useEffect(() => {
    if (!user?.email) return;
    const load = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/admin/results/${id}`, {
          headers: { 'x-user-email': user.email || '' }
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed');
        setData(json.data);
        setAdminNotes(json.data.result.adminNotes || '');
        setIsReviewed(!!json.data.result.isReviewed);
        setIsPublished(!!json.data.result.isPublished);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      }
    };
    load();
  }, [id, user]);

  const merged = useMemo(() => {
    if (!data?.result || !data?.exam) return null;
    const r = data.result;
    const e = data.exam;
    // Build a merged view by aligning by question id
    const byId: Record<string, any> = {};
    for (const q of e.questions || []) byId[String(q.id)] = q;
    return (r.questions || []).map((rq: any, idx: number) => {
      const eq = byId[String(rq.id)] || {};
      const studentAns = r.answers?.[idx];
      const studentText = typeof studentAns === 'number' && eq.options?.[studentAns]?.text?.ar
        ? (eq.options[studentAns].text.ar || eq.options[studentAns].text.en)
        : r.essayAnswers?.[idx] || '';
      const correctIndex = rq.correctAnswer;
      const correctText = typeof correctIndex === 'number' && eq.options?.[correctIndex]?.text
        ? (eq.options[correctIndex].text.ar || eq.options[correctIndex].text.en)
        : '';
      const type = rq.type || eq.type || 'multiple-choice';
      const points = rq.points || eq.points || 1;
      const isAutoCorrect = type !== 'essay' && typeof studentAns === 'number' && studentAns === correctIndex;
      const ov = overrides[rq.id];
      const currentIsCorrect = ov?.isCorrect ?? isAutoCorrect;
      return { idx, id: rq.id, question: eq.text?.ar || rq.question, studentText, correctText, points, type, isAutoCorrect, currentIsCorrect };
    });
  }, [data, overrides]);

  const totalScore = useMemo(() => {
    if (!merged) return 0;
    let earned = 0;
    let total = 0;
    merged.forEach((item: any) => {
      total += item.points;
      if (item.type === 'essay') {
        const ov = overrides[item.id];
        const ap = ov?.awardedPoints ?? 0;
        earned += Math.max(0, Math.min(item.points, ap));
      } else {
        const ov = overrides[item.id];
        const isC = ov?.isCorrect ?? item.isAutoCorrect;
        if (isC) earned += item.points;
      }
    });
    return total > 0 ? Math.round((earned / total) * 100) : 0;
  }, [merged, overrides]);

  const save = async () => {
    if (!user?.email) return;
    try {
      setSaving(true);
      setError('');
      const perQuestionOverrides = Object.entries(overrides).map(([id, v]) => ({ id, ...v }));
      const res = await fetch(`http://localhost:3001/api/admin/results/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify({
          adminNotes,
          isReviewed,
          isPublished,
          perQuestionOverrides
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');
      alert('Saved');
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <div className="p-6 text-red-700">{error}</div>;
  }
  if (!data) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Result Review</h1>
              <p className="text-sm">Student: {data.result.userName} • {data.result.userEmail}</p>
              <p className="text-sm">Exam: {data.result.examTopic} • Current Score: {data.result.score}% • New Score: {totalScore}%</p>
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isReviewed} onChange={e => setIsReviewed(e.target.checked)} />
                <span>Reviewed</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
                <span>Publish Result</span>
              </label>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow divide-y">
          {merged?.map((item: any) => (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-semibold mb-1">Q{item.idx + 1}. {item.question}</div>
                  <div className="text-sm">Student: {item.studentText || '-'}</div>
                  {item.correctText && <div className="text-sm text-green-700">Correct: {item.correctText}</div>}
                  <div className="text-xs mt-1">Type: {item.type} • Points: {item.points}</div>
                </div>
                <div className="w-64">
                  {item.type === 'essay' ? (
                    <div className="flex items-center gap-2">
                      <label className="text-sm">Awarded Points:</label>
                      <input
                        type="number"
                        min={0}
                        max={item.points}
                        value={overrides[item.id]?.awardedPoints ?? ''}
                        onChange={e => setOverrides(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), awardedPoints: e.target.value === '' ? undefined : Number(e.target.value) } }))}
                        className="w-20 px-2 py-1 border rounded"
                      />
                    </div>
                  ) : (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={overrides[item.id]?.isCorrect ?? item.isAutoCorrect}
                        onChange={e => setOverrides(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), isCorrect: e.target.checked } }))}
                      />
                      <span className="text-sm">Mark Correct</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow p-4 mt-4">
          <label className="block text-sm font-semibold mb-1">Admin Notes / Feedback</label>
          <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
        </div>
      </main>
    </div>
  );
}
