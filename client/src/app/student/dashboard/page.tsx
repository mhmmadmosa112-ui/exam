'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  BookOpen, Calendar as CalendarIcon, Award, 
  ChevronRight, AlertCircle, Bell, Check, User, Camera
} from 'lucide-react';

const FullCalendar = dynamic(
  () => import('@fullcalendar/react').then((mod) => mod.default as any),
  { ssr: false }
) as any;

// --- Helper Component: ToggleSwitch ---
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void; }) => {
  return (
    <div 
      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}
      onClick={() => onChange(!checked)}
    >
      <div 
        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </div>
  );
};
// --- Mock Data ---
const subjects = [
  { id: '1', name: 'الفيزياء', progress: 75, nextExam: '2026-03-15', isPublished: true },
  { id: '2', name: 'الرياضيات', progress: 40, nextExam: '2026-03-20', isPublished: false },
  { id: '3', name: 'الكيمياء', progress: 90, nextExam: '2026-03-10', isPublished: true },
];

const grades = [
  { id: '1', subject: 'الفيزياء', exam: 'امتحان نصف الفصل', score: 85, maxScore: 100, status: 'passed' },
  { id: '2', subject: 'الكيمياء', exam: 'امتحان قصير 1', score: 18, maxScore: 20, status: 'passed' },
  { id: '3', subject: 'الرياضيات', exam: 'امتحان تجريبي', score: 45, maxScore: 100, status: 'failed' },
];

const events = [
  { title: 'امتحان فيزياء', date: '2026-03-15', color: '#4F46E5' }, // Indigo
  { title: 'امتحان رياضيات', date: '2026-03-20', color: '#10B981' }, // Emerald
  { title: 'امتحان كيمياء', date: '2026-03-10', color: '#F59E0B' }, // Amber
];

const notifications = [
    { id: 1, title: 'تحديث جدول الامتحانات', content: 'تم نقل امتحان الفيزياء إلى يوم الأحد.', date: 'منذ ساعتين', priority: 'high', read: false },
    { id: 2, title: 'مرحباً بك في الفصل الدراسي الجديد', content: 'نتمنى لكم كل التوفيق...', date: 'منذ يومين', priority: 'normal', read: true },
];

export default function StudentDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get('examId');
  const [activeTab, setActiveTab] = useState<'subjects' | 'calendar' | 'grades' | 'notifications' | 'profile'>('subjects');

  // --- Profile State & Logic ---
  const [profile, setProfile] = useState({
    fullName: 'أحمد محمد علي محمود', // Quadruple Name placeholder
    parentPhone: '0599123456',
    isPhonePrivate: true,
    avatar: ''
  });

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Security Check: Forbidden File Types
    const forbiddenExts = ['exe', 'js', 'bat', 'sh', 'php'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && forbiddenExts.includes(ext)) {
      alert('Forbidden File Type: Uploading executable files is not allowed.');
      e.target.value = ''; // Reset input
      return;
    }

    // Mock Upload
    const imageUrl = URL.createObjectURL(file);
    setProfile(prev => ({ ...prev, avatar: imageUrl }));
  };

  const handleRequestReview = (gradeId: string) => {
    // Logic to send automated ticket
    alert(`تم إرسال طلب مراجعة للنتيجة رقم ${gradeId}`);
  };

  const handleEventClick = (info: any) => {
    alert(`تفاصيل الامتحان:\nالمادة: ${info.event.title}\nالتاريخ: ${info.event.startStr}`);
  };

  // ✅ وضع الامتحان: إذا كان هناك examId في الرابط
  if (examId) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col" dir="rtl">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">نظام الامتحانات</h1>
          <button 
            onClick={() => router.push('/student/dashboard')}
            className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded"
          >
            خروج من الامتحان
          </button>
        </header>
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-2xl w-full text-center">
            <h2 className="text-2xl font-bold mb-4">جاري تحميل الامتحان...</h2>
            <p className="text-gray-600 mb-6">معرف الامتحان: {examId}</p>
            <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">سيتم عرض واجهة الأسئلة هنا.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">لوحة التحكم الأكاديمية</h1>
        <p className="text-gray-500">نظرة شاملة على تقدمك الدراسي والامتحانات القادمة</p>
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-8 border-b bg-white p-2 rounded-xl shadow-sm">
        {[
            { key: 'subjects', label: 'المواد الدراسية', icon: BookOpen },
            { key: 'calendar', label: 'التقويم', icon: CalendarIcon },
            { key: 'grades', label: 'الدرجات', icon: Award },
            { key: 'notifications', label: 'الإشعارات', icon: Bell },
            { key: 'profile', label: 'الملف الشخصي', icon: User },
        ].map(item => (
            <button 
                key={item.key}
                onClick={() => setActiveTab(item.key as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-colors rounded-lg ${activeTab === item.key ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.key === 'notifications' && notifications.some(n => !n.read) && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>}
            </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        
        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map(subject => (
              <div key={subject.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                  </div>
                  {subject.isPublished ? (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">متاح</span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">قريباً</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{subject.name}</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>التقدم</span>
                    <span>{subject.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${subject.progress}%` }}></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                  <CalendarIcon className="w-4 h-4" />
                  <span>الامتحان القادم: {subject.nextExam}</span>
                </div>
                <button 
                  disabled={!subject.isPublished}
                  onClick={() => router.push(`/student/dashboard?examId=mock_exam_${subject.id}`)}
                  className="w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  دخول الامتحان <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="ar"
              direction="rtl"
              headerToolbar={{
                right: 'prev,next today',
                center: 'title',
                left: 'dayGridMonth,dayGridWeek'
              }}
              events={events}
              height="auto"
              eventClick={handleEventClick}
            />
          </div>
        )}

        {/* Grades Tab */}
        {activeTab === 'grades' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">المادة</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">الامتحان</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">الدرجة</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">الحالة</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {grades.map(grade => (
                  <tr key={grade.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900 max-w-40 truncate" title={grade.subject}>{grade.subject}</td>
                    <td className="p-4 text-gray-600">{grade.exam}</td>
                    <td className="p-4 font-bold">
                      <span className={grade.score / grade.maxScore >= 0.5 ? 'text-green-600' : 'text-red-600'}>
                        {grade.score}
                      </span>
                      <span className="text-gray-400 text-sm">/{grade.maxScore}</span>
                    </td>
                    <td className="p-4">
                      {grade.status === 'passed' ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <Award className="w-3 h-3" /> ناجح
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" /> راسب
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleRequestReview(grade.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        طلب مراجعة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notification Center Tab */}
        {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-6 text-gray-800">مركز الإشعارات</h2>
                <div className="space-y-4">
                {notifications.map(notification => (
                <div 
                    key={notification.id} 
                    className={`p-5 rounded-xl border-r-4 transition-all hover:shadow-lg ${!notification.read ? 'bg-indigo-50 border-r-indigo-500' : 'bg-white border-r-gray-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                        {notification.priority === 'high' && <AlertCircle className="w-5 h-5 text-red-500" />}
                        <h3 className={`font-bold ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>{notification.title}</h3>
                    </div>
                    <span className="text-xs text-gray-400">{notification.date}</span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pr-8">{notification.content}</p>
                    {!notification.read && (
                    <div className="mt-4 flex justify-end">
                        <button className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                        <Check className="w-3 h-3" /> تحديد كمقروء
                        </button>
                    </div>
                    )}
                </div>
                ))}
            </div>
            </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-6 text-gray-800">إدارة الملف الشخصي</h2>
            
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32">
                  <img 
                    src={profile.avatar || "https://via.placeholder.com/150"} 
                    alt="Avatar" 
                    className="w-full h-full rounded-full object-cover border-4 border-indigo-50"
                  />
                  <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <p className="text-xs text-gray-500">JPG, PNG allowed</p>
              </div>

              {/* Form Section */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الرباعي <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={profile.fullName}
                    onChange={e => setProfile({...profile, fullName: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم هاتف ولي الأمر <span className="text-red-500">*</span></label>
                  <input 
                    type="tel" 
                    value={profile.parentPhone}
                    onChange={e => setProfile({...profile, parentPhone: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-bold text-gray-800 mb-3">إعدادات الخصوصية</h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">إظهار رقم الهاتف في الدليل</p>
                      <p className="text-xs text-gray-500">عند التفعيل، سيظهر الرقم للمعلمين والطلاب الآخرين</p>
                    </div>
                    <ToggleSwitch 
                      checked={!profile.isPhonePrivate}
                      onChange={(checked) => setProfile(prev => ({ ...prev, isPhonePrivate: !checked }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">
                    حفظ التغييرات
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
