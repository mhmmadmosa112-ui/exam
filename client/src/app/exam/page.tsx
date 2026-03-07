'use client';

import { useState, useMemo, useRef } from 'react';
import type ReactQuillType from 'react-quill';
import dynamic from 'next/dynamic';
import { 
  Search, Filter, Send, Paperclip, Bold, Italic, 
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, 
  FileText, Bell, CheckCircle, Users, GraduationCap, 
  MessageSquare, ChevronRight, Megaphone
} from 'lucide-react';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill');
    // eslint-disable-next-line react/display-name
    return ({ forwardedRef, ...props }: { forwardedRef: React.Ref<ReactQuillType>, [key: string]: any }) => <RQ {...props} ref={forwardedRef} />;
  },
  { ssr: false }
);

// --- Types ---
interface Message {
  id: string;
  sender: 'student' | 'admin';
  content: string; // HTML/Rich Text
  timestamp: string;
  attachments?: string[];
}

interface Conversation {
  id: string;
  studentName: string;
  studentId: string;
  grade: string;
  specialization: string;
  lastMessage: string;
  unreadCount: number;
  messages: Message[];
}

// --- Mock Data ---
const mockConversations: Conversation[] = [
  {
    id: '1',
    studentName: 'Ahmed Ali',
    studentId: 'st_123',
    grade: '12th Grade',
    specialization: 'Scientific',
    lastMessage: 'Could you please check my grade for the Physics exam?',
    unreadCount: 2,
    messages: [
      { id: 'm1', sender: 'student', content: '<p>Hello, I have a question.</p>', timestamp: '10:00 AM' },
      { id: 'm2', sender: 'student', content: '<p>Could you please check my grade for the <strong>Physics exam</strong>?</p>', timestamp: '10:05 AM' }
    ]
  },
  {
    id: '2',
    studentName: 'Sarah Smith',
    studentId: 'st_124',
    grade: '11th Grade',
    specialization: 'Literary',
    lastMessage: 'Thank you!',
    unreadCount: 0,
    messages: [
      { id: 'm3', sender: 'admin', content: '<p>Your submission has been received.</p>', timestamp: 'Yesterday' },
      { id: 'm4', sender: 'student', content: '<p>Thank you!</p>', timestamp: 'Yesterday' }
    ]
  }
];

export default function AdminCommunicationPage() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'announcements'>('inbox');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('1');
  const [replyText, setReplyText] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const replyQuillRef = useRef<any>(null);
    const announcementQuillRef = useRef<any>(null);
  

  const [announcementTarget, setAnnouncementTarget] = useState<'global' | 'targeted'>('global');
  const [targetSpec, setTargetSpec] = useState('');
  const [targetGrade, setTargetGrade] = useState('');

  const selectedConversation = mockConversations.find(c => c.id === selectedConversationId);

  // Custom handler for image upload
  const createImageHandler = (ref: React.RefObject<any>) => () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      if (ref.current) {
        const file = input.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const editor = ref.current.getEditor();
            const range = editor.getSelection(true);
            // This will insert the image as a base64 string.
            // For production, you would upload the file to a server and get a URL.
            editor.insertEmbed(range.index, 'image', reader.result);
          };
          reader.readAsDataURL(file);
        }
      }
    };
  };

  const replyModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'align': [] }],
        ['link', 'image', 'video'] // Added video
      ],
      handlers: {
        image: createImageHandler(replyQuillRef)
      }
    }
  }), []);

  const announcementModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'align': [] }],
        ['link', 'image', 'video']
      ],
      handlers: {
        image: createImageHandler(announcementQuillRef)
      }
    }
  }), []);

  return (
    <div className="min-h-screen bg-gray-100 p-6" dir="rtl">
      {/* Header */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            مركز التواصل والإشعارات
          </h1>
          <p className="text-gray-500 text-sm">إدارة المحادثات وإرسال التعاميم</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'inbox' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            البريد الوارد
          </button>
          <button 
            onClick={() => setActiveTab('announcements')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'announcements' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            التعاميم والإعلانات
          </button>
        </div>
      </header>

      {activeTab === 'inbox' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Sidebar: Conversations List */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="بحث عن طالب..." 
                  className="w-full pr-9 pl-4 py-2 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                <button className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 whitespace-nowrap hover:bg-gray-200">الكل</button>
                <button className="px-3 py-1 bg-indigo-50 rounded-full text-xs text-indigo-600 whitespace-nowrap border border-indigo-100">غير مقروء</button>
                <button className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 whitespace-nowrap hover:bg-gray-200">علمي</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {mockConversations.map(conv => (
                <div 
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedConversationId === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold text-sm ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-600'}`}>{conv.studentName}</h3>
                    <span className="text-xs text-gray-400">{conv.messages[conv.messages.length-1].timestamp}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{conv.grade} - {conv.specialization}</p>
                  <div className="text-sm text-gray-600 truncate" dangerouslySetInnerHTML={{ __html: conv.lastMessage }} />
                </div>
              ))}
            </div>
          </div>

          {/* Main: Chat Thread */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <div>
                    <h2 className="font-bold text-gray-800">{selectedConversation.studentName}</h2>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span> متصل الآن
                    </span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600"><Filter className="w-5 h-5" /></button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                  {selectedConversation.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-4 ${msg.sender === 'admin' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>
                        <div className="text-sm" dangerouslySetInnerHTML={{ __html: msg.content }} />
                        <span className={`text-[10px] block mt-2 ${msg.sender === 'admin' ? 'text-indigo-200' : 'text-gray-400'}`}>{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Engine (Rich Text) */}
                <div className="p-4 bg-white border-t">
                  <div className="bg-white">
                    <ReactQuill
                      forwardedRef={replyQuillRef}
                      theme="snow" 
                      value={replyText} 
                      onChange={setReplyText} 
                      modules={replyModules}
                    />
                  </div>
                  <div className="pt-4 flex justify-end">
                    <div className="p-2 flex justify-end items-center">
                      <button className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                        <Send className="w-4 h-4" /> إرسال
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                <p>اختر محادثة للبدء</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Announcements Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-600" />
              إنشاء تعميم جديد
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عنوان التعميم</label>
                <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="مثال: تغيير موعد امتحان الرياضيات" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نطاق الإرسال</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="target" checked={announcementTarget === 'global'} onChange={() => setAnnouncementTarget('global')} className="text-indigo-600" />
                    <span>عام (الكل)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="target" checked={announcementTarget === 'targeted'} onChange={() => setAnnouncementTarget('targeted')} className="text-indigo-600" />
                    <span>مخصص (فئة محددة)</span>
                  </label>
                </div>

                {announcementTarget === 'targeted' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">التخصص</label>
                      <select className="w-full p-2 border rounded bg-white" value={targetSpec} onChange={e => setTargetSpec(e.target.value)}>
                        <option value="">اختر التخصص...</option>
                        <option value="sci">علمي</option>
                        <option value="lit">أدبي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">الصف</label>
                      <select className="w-full p-2 border rounded bg-white" value={targetGrade} onChange={e => setTargetGrade(e.target.value)}>
                        <option value="">اختر الصف...</option>
                        <option value="12">الثاني عشر</option>
                        <option value="11">الحادي عشر</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نص التعميم</label>
                <div className="bg-white">
                  <ReactQuill
                    forwardedRef={announcementQuillRef}
                    theme="snow" 
                    value={announcementText} 
                    onChange={setAnnouncementText} 
                    modules={announcementModules}
                    placeholder="اكتب تفاصيل الإعلان هنا..." 
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                  <Send className="w-4 h-4" /> نشر التعميم
                </button>
              </div>
            </div>
          </div>

          {/* History Sidebar */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-bold text-gray-700 mb-4">آخر التعاميم المرسلة</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-gray-800">تعليمات الامتحان النهائي</span>
                    <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border">عام</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">يرجى من جميع الطلاب الالتزام بالحضور قبل الموعد بـ 15 دقيقة...</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                    <CheckCircle className="w-3 h-3 text-green-500" /> تمت القراءة: 85%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}