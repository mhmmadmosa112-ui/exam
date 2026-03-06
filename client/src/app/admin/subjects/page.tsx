'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import { Plus, Edit, Trash2, Search, X, Check, BookOpen } from 'lucide-react';

interface Subject {
  _id: string;
  name: { ar: string; en: string };
  description?: { ar: string; en: string };
  code?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminSubjectsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { language, toggleLanguage, dir } = useLanguage();  // ✅ تأكد من وجود dir
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: { ar: '', en: '' },
    description: { ar: '', en: '' },
    code: ''
  });

  // التحقق من صلاحية الأدمن
  useEffect(() => {
    if (!loading && user) {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',');
      if (user.email && !adminEmails.includes(user.email)) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  // جلب المواد - ✅ مسار API الصحيح
  const fetchSubjects = async () => {
    if (!user?.email) return;
    
    try {
      setLoadingData(true);
      const params = search ? `?search=${search}` : '';
      const res = await fetch(`http://localhost:3001/api/subjects${params}`, {  // ✅ /api/subjects
        headers: { 'x-user-email': user.email }
      });
      const result = await res.json();
      if (result.success) setSubjects(result.data);
      else setError(result.error);
    } catch (err: any) {
      setError('فشل جلب المواد');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchSubjects(); }, [user, search]);

  // فتح النافذة
  const openModal = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({
        name: { ...subject.name },
        description: subject.description || { ar: '', en: '' },
        code: subject.code || ''
      });
    } else {
      setEditingSubject(null);
      setFormData({ name: { ar: '', en: '' }, description: { ar: '', en: '' }, code: '' });
    }
    setShowModal(true);
  };

  // حفظ المادة - ✅ مسار API الصحيح
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    
    try {
      const url = editingSubject 
        ? `http://localhost:3001/api/subjects/${editingSubject._id}`  // ✅
        : 'http://localhost:3001/api/subjects';  // ✅
      
      const method = editingSubject ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email 
        },
        body: JSON.stringify(formData)
      });
      
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchSubjects();
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError('فشل الحفظ');
    }
  };

  // حذف مادة - ✅ مسار API الصحيح
  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    if (!user?.email) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/subjects/${id}`, {  // ✅
        method: 'DELETE',
        headers: { 'x-user-email': user.email }
      });
      const result = await res.json();
      if (result.success) fetchSubjects();
      else setError(result.error);
    } catch (err: any) {
      setError('فشل الحذف');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" dir={dir}>
      <Header />
      
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* الشريط العلوي */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {language === 'ar' ? 'إدارة المواد الدراسية' : 'Manage Subjects'}
              </h1>
              <p className="text-gray-700 mt-1 font-medium">
                {language === 'ar' ? 'أضف، عدّل، أو احذف المواد' : 'Add, edit, or delete subjects'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>{language === 'ar' ? 'إضافة مادة' : 'Add Subject'}</span>
            </button>
          </div>
          
{/* شريط البحث - بدون شروط معقدة */}
<div className="mt-4 relative">
  {/* أيقونة البحث - تظهر دائماً على اليمين للعربية */}
  <Search className="absolute top-3 right-3 w-5 h-5 text-gray-700 rtl:left-3 rtl:right-auto" />
  
  <input
    type="text"
    placeholder={language === 'ar' ? 'بحث باسم المادة أو الرمز...' : 'Search by name or code...'}
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-800 pr-10 pl-4 rtl:pl-10 rtl:pr-4"
  />
  
  {/* زر المسح */}
  {search && (
    <button
      onClick={() => setSearch('')}
      className="absolute top-3 left-3 text-gray-700 hover:text-gray-700 rtl:right-3 rtl:left-auto"
      type="button"
    >
      <X className="w-5 h-5" />
    </button>
  )}
</div>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* جدول المواد */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-800">
                    {language === 'ar' ? 'المادة' : 'Subject'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-800 hidden sm:table-cell">
                    {language === 'ar' ? 'الرمز' : 'Code'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-800 hidden md:table-cell">
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-gray-800">
                    {language === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subjects.map((subject) => (
                  <tr key={subject._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {language === 'ar' ? subject.name.ar : subject.name.en}
                          </p>
                          {subject.description && (
                            <p className="text-sm text-gray-700">
                              {language === 'ar' ? subject.description.ar : subject.description.en}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 hidden sm:table-cell">
                      {subject.code || '-'}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        subject.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {subject.isActive 
                          ? (language === 'ar' ? 'نشط' : 'Active') 
                          : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(subject)}
                          className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(subject._id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {subjects.length === 0 && (
            <div className="p-12 text-center text-gray-700">
              {language === 'ar' 
                ? 'لا توجد مواد. انقر "إضافة مادة" للبدء.' 
                : 'No subjects yet. Click "Add Subject" to start.'}
            </div>
          )}
        </div>
      </main>

      {/* نافذة الإضافة/التعديل */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSubject 
                  ? (language === 'ar' ? 'تعديل المادة' : 'Edit Subject')
                  : (language === 'ar' ? 'إضافة مادة جديدة' : 'Add New Subject')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {language === 'ar' ? 'اسم المادة (عربي)' : 'Subject Name (Arabic)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name.ar}
                  onChange={(e) => setFormData(f => ({ ...f, name: { ...f.name, ar: e.target.value } }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {language === 'ar' ? 'اسم المادة (English)' : 'Subject Name (English)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name.en}
                  onChange={(e) => setFormData(f => ({ ...f, name: { ...f.name, en: e.target.value } }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {language === 'ar' ? 'رمز المادة (اختياري)' : 'Subject Code (Optional)'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase text-gray-900"
                  maxLength={10}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}
                </label>
                <textarea
                  rows={2}
                  value={formData.description.ar}
                  onChange={(e) => setFormData(f => ({ ...f, description: { ...f.description, ar: e.target.value } }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {language === 'ar' ? 'الوصف (English)' : 'Description (English)'}
                </label>
                <textarea
                  rows={2}
                  value={formData.description.en}
                  onChange={(e) => setFormData(f => ({ ...f, description: { ...f.description, en: e.target.value } }))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}