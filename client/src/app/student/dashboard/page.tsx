'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';

type ExamStatus = 'draft' | 'scheduled' | 'active' | 'closed' | 'published';

interface Exam {
  _id: string;
  title: { ar: string; en: string }; 
  subjectId?: any;
  status: ExamStatus;
  availability?: { startDate?: string; endDate?: string };
  settings: { duration: number; allowRetake?: boolean; showResults: 'immediate' | 'after-publish' | 'never' };
}

interface ExamResultItem {
  _id: string;
  examId?: string;
  examTopic: string;
  score: number;
  submittedAt: string;
  isReviewed: boolean;
}

interface StudentProfile extends UserProfile {
  major?: string;
  bio?: string;
  enrolledSubjectIds?: string[];
}

interface UserProfile {
  fullName: string; photoURL: string; email: string; currentPassword: string; newPassword: string;
}

export default function StudentDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [tab, setTab] = useState<'profile' | 'exams' | 'completed' | 'calendar' | 'grades'>('exams');
  const [profile, setProfile] = useState<StudentProfile>({ fullName: '', photoURL: '', email: '', currentPassword: '', newPassword: '', major: 'Computer Science', bio: 'Aspiring developer.', enrolledSubjectIds: [] });
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResultItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.email) return;
    setProfile({
      fullName: user.displayName || '',
      photoURL: user.photoURL || '',
      email: user.email || '',
      major: profile.major, // Keep existing custom fields
      bio: profile.bio,
      currentPassword: '', 
      newPassword: ''
    });
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (!user?.email || !user?.uid) return;
      try {
        setLoadingData(true);
        setError('');
        const examsRes = await fetch('http://localhost:3001/api/student-exams', { headers: { 'x-user-email': user.email } });
        const examsData = await examsRes.json(); 
        const histRes = await fetch(`http://localhost:3001/api/student-exams/history/${user.uid}?limit=100&page=1`, { headers: { 'x-user-email': user.email } });
        const histData = await histRes.json();
        // MOCK: Fetch student profile with enrolled subjects
        // const profileRes = await fetch(`http://localhost:3001/api/students/profile/${user.uid}`);
        // const profileData = await profileRes.json();
        // if (profileData.success) setProfile(p => ({...p, ...profileData.data}));
        setExams(Array.isArray(examsData?.data) ? examsData.data : []);
        setResults(Array.isArray(histData?.data?.results) ? histData.data.results : []);
      } catch (e: any) {
        setError('Failed to load dashboard data');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user]);

  const completedExamIds = useMemo(() => new Set(results.map(r => String(r.examId || ''))), [results]);

  const publishedExams = useMemo(
    () => exams.filter(e => e.status === 'published'),
    [exams]
  );

  const availableExams = useMemo(
    () => publishedExams.filter(e => {
      const isCompleted = completedExamIds.has(String(e._id));
      // const isEnrolled = profile.enrolledSubjectIds?.includes(String(e.subjectId)); // UNCOMMENT WHEN API IS READY
      const isEnrolled = true; // MOCK: Assume enrolled in all for now
      return !isCompleted && isEnrolled;
    }),
    [publishedExams, completedExamIds, profile.enrolledSubjectIds]
  );

  const completedExamsList = useMemo(
    () => exams.filter(e => completedExamIds.has(String(e._id))),
    [exams, completedExamIds]
  );

  const upcomingByDate = useMemo(() => {
    const map: Record<string, Exam[]> = {};
    for (const e of publishedExams) {
      const d = e.availability?.startDate ? new Date(e.availability.startDate) : null;
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [publishedExams]);

  const saveProfile = async () => {
    if (!user) return;
    try {
      setSavingProfile(true);
      setError('');
      // TODO: Add API call to save custom profile fields like bio and major
      // await fetch(`/api/students/profile/${user.uid}`, { method: 'PATCH', body: JSON.stringify({ bio: profile.bio, major: profile.major }) });

      if (profile.fullName !== (user.displayName || '') || profile.photoURL !== (user.photoURL || '')) {
        await updateProfile(user, { displayName: profile.fullName, photoURL: profile.photoURL });
      }
      if (profile.newPassword) {
        if (!profile.currentPassword) {
          setError('Please enter current password to change password.');
        } else {
          const cred = EmailAuthProvider.credential(user.email || '', profile.currentPassword);
          await reauthenticateWithCredential(user, cred);
          await updatePassword(user, profile.newPassword);
        }
      }
      alert('Profile updated');
    } catch (e: any) {
      setError(e.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const averageScore = useMemo(() => results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length) : 0, [results]);

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTab('exams')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'exams' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}>Available Exams</button>
            <button onClick={() => setTab('completed')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'completed' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}>Completed</button>
            <button onClick={() => setTab('calendar')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}>Calendar</button>
            <button onClick={() => setTab('grades')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'grades' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}>Grades</button>
            <button onClick={() => setTab('profile')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'profile' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}>Profile</button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
        {loadingData && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">Loading...</div>}

        {tab === 'exams' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-bold mb-3">Available Exams</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Exam</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Status</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Start</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {availableExams.map(e => (
                    <tr key={e._id}>
                      <td className="px-4 py-2">{e.title?.ar || e.title?.en}</td>
                      <td className="px-4 py-2">{e.status}</td>
                      <td className="px-4 py-2">{e.availability?.startDate ? new Date(e.availability.startDate).toLocaleString() : '-'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => router.push(`/exam?id=${e._id}`)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-lg"
                        >
                          Start
                        </button>
                      </td>
                    </tr>
                  ))}
                  {availableExams.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-black" colSpan={4}>No available exams</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'completed' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-bold mb-3">Completed Exams</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Exam</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Start</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Re-Enter</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {completedExamsList.map(e => (
                    <tr key={e._id}>
                      <td className="px-4 py-2">{e.title?.ar || e.title?.en}</td>
                      <td className="px-4 py-2">{e.availability?.startDate ? new Date(e.availability.startDate).toLocaleString() : '-'}</td>
                      <td className="px-4 py-2">
                        <button disabled className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg cursor-not-allowed">Completed</button>
                      </td>
                    </tr>
                  ))}
                  {completedExamsList.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-black" colSpan={3}>No completed exams</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'calendar' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-bold mb-3">Exam Calendar</h2>
            <div className="space-y-4">
              {upcomingByDate.map(([date, list]) => (
                <div key={date} className="border rounded-lg">
                  <div className="px-4 py-2 bg-gray-50 font-semibold">{new Date(date).toLocaleDateString()}</div>
                  <ul className="divide-y">
                    {list.map(e => (
                      <li key={e._id} className="px-4 py-2 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{e.title?.ar || e.title?.en}</div>
                          <div className="text-sm text-black">Status: {e.status}</div>
                        </div>
                        <button onClick={() => router.push(`/exam?id=${e._id}`)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg">Open</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {upcomingByDate.length === 0 && <div className="p-4 text-center text-black">No upcoming exams</div>}
            </div>
          </div>
        )}

        {tab === 'grades' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-bold mb-3">Grades</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Exam</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Score</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Date</th>
                    <th className="px-4 py-2 text-start text-sm font-semibold text-black">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map(r => (
                    <tr key={r._id}>
                      <td className="px-4 py-2">{r.examTopic}</td>
                      <td className="px-4 py-2">{r.score}</td>
                      <td className="px-4 py-2">{new Date(r.submittedAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={async () => {
                            if (!user?.email) return;
                            const res = await fetch(`http://localhost:3001/api/student-exams/result/${r._id}`, { headers: { 'x-user-email': user.email } });
                            const data = await res.json();
                            const d = data?.data;
                            alert(`Exam: ${r.examTopic}\nScore: ${r.score}\nReviewed: ${r.isReviewed ? 'Yes' : 'No'}`);
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-lg"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-black" colSpan={4}>No grades yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-bold mb-6">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 flex flex-col items-center">
                <img src={profile.photoURL || '/avatar.png'} alt="Profile" className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-gray-200" />
                <input type="file" id="photoUpload" className="hidden" accept="image/*" />
                <button onClick={() => document.getElementById('photoUpload')?.click()} className="px-4 py-2 text-sm bg-gray-200 text-black rounded-lg">Upload Photo</button>
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">Average Score / GPA</p>
                  <p className="text-4xl font-bold text-indigo-600">{averageScore}%</p>
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-1">Full Name</label>
                <input value={profile.fullName} onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-1">Email</label>
                <input value={profile.email} disabled className="w-full px-3 py-2 border rounded-lg font-bold text-black bg-gray-100 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-1">Major (التخصص)</label>
                <input value={profile.major} onChange={e => setProfile(p => ({ ...p, major: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-1">Bio</label>
                <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" rows={3}></textarea>
              </div>
              </div>
            </div>
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-bold mb-3">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-1">Current Password</label>
                <input type="password" value={profile.currentPassword} onChange={e => setProfile(p => ({ ...p, currentPassword: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-1">New Password</label>
                <input type="password" value={profile.newPassword} onChange={e => setProfile(p => ({ ...p, newPassword: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
              </div>
            </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={saveProfile} disabled={savingProfile} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                {savingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
