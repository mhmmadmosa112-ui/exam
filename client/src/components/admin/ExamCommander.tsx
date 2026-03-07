'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { AlertCircle, Loader2, Send, Users, Clock } from 'lucide-react';

interface ExamCommanderProps {
  examId: string;
  examTitle: string;
  adminEmail: string;
}

interface StudentDetails {
  userId: string;
  userName: string;
  userEmail: string;
  status: 'active' | 'completed' | 'inactive';
  timeSpent: number;
  progress: number;
}

export default function ExamCommander({ examId, examTitle, adminEmail }: ExamCommanderProps) {
  const { language, dir } = useLanguage();
  const [students, setStudents] = useState<StudentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch active students for this exam
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/exam-monitor?examId=${examId}`);
        
        if (!response.ok) {
          throw new Error(language === 'ar' ? 'فشل في جلب البيانات' : 'Failed to fetch data');
        }
        
        const data = await response.json();
        setStudents(data.students || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    const interval = setInterval(fetchStudents, 3000); // Poll every 3 seconds
    fetchStudents();
    
    return () => clearInterval(interval);
  }, [examId, language]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    try {
      setSendingMessage(true);
      const response = await fetch('/api/admin/broadcast-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          message: message.trim(),
          senderEmail: adminEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message');
      }

      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">{language === 'ar' ? 'قيادة الامتحان' : 'Exam Commander'}</h2>
          <p className="text-gray-600 text-sm">{examTitle}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg">
          <Users className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-indigo-600">{students.filter(s => s.status === 'active').length} {language === 'ar' ? 'نشط' : 'Active'}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Students List */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-4 text-gray-700">
          {language === 'ar' ? 'الطلاب المشاركين' : 'Participating Students'}
        </h3>
        
        {students.length === 0 ? (
          <p className="text-gray-500 text-sm">{language === 'ar' ? 'لا توجد طلاب نشطون حالياً' : 'No active students'}</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {students.map(student => (
              <div
                key={student.userId}
                className={`p-3 rounded-lg flex items-between justify-between ${
                  student.status === 'active'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{student.userName}</p>
                  <p className="text-xs text-gray-600">{student.userEmail}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{Math.floor(student.timeSpent / 60)}m</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{student.progress}%</div>
                    <span className={student.status === 'active' ? 'text-green-600' : 'text-gray-600'}>
                      {language === 'ar'
                        ? student.status === 'active'
                          ? 'نشط'
                          : student.status === 'completed'
                          ? 'مكتمل'
                          : 'غير نشط'
                        : student.status === 'active'
                        ? 'Active'
                        : student.status === 'completed'
                        ? 'Completed'
                        : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Box */}
      <div className="border-t pt-4">
        <label className="block text-sm font-semibold mb-2 text-gray-700">
          {language === 'ar' ? 'أرسل رسالة للطلاب' : 'Send Message to Students'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            disabled={sendingMessage}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sendingMessage}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {sendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
