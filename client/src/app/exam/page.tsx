'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ExamRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');

  useEffect(() => {
    if (examId) {
      router.replace(`/student/dashboard?examId=${examId}`);
    } else {
      router.replace('/student/dashboard');
    }
  }, [examId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">جاري التوجيه إلى الامتحان...</p>
      </div>
    </div>
  );
}