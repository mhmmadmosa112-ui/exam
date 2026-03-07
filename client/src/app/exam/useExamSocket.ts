'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseExamSocketProps {
  examId: string;
  studentId: string;
  onTimeExtended: (minutes: number) => void;
  onInstantLock: () => void;
  onClarification: (message: string) => void;
  onExamStart: () => void;
}

export const useExamSocket = ({ 
  examId, 
  studentId, 
  onTimeExtended, 
  onInstantLock, 
  onClarification,
  onExamStart
}: UseExamSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!examId || !studentId) return;

    // Connect to the monitoring namespace
    const socket = io('http://localhost:3001/monitoring', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ExamSocket] Connected');
      setIsConnected(true);
      socket.emit('student-join', { examId, studentId });
    });

    socket.on('disconnect', () => {
      console.log('[ExamSocket] Disconnected');
      setIsConnected(false);
    });

    // --- Listeners ---
    
    socket.on('EXAM_START_ALL', () => {
      console.log('[ExamSocket] Exam Started by Admin');
      onExamStart();
    });

    socket.on('TIME_EXTENDED', (data: { additionalMinutes: number, totalExtendedMinutes: number }) => {
      console.log('[ExamSocket] Time Extended', data);
      onTimeExtended(data.additionalMinutes);
    });

    socket.on('INSTANT_LOCK', () => {
      console.log('[ExamSocket] Instant Lock Received');
      onInstantLock();
    });

    socket.on('TEACHER_CLARIFICATION', (data: { message: string }) => {
      console.log('[ExamSocket] Clarification:', data.message);
      onClarification(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [examId, studentId]);

  return { socket: socketRef.current, isConnected };
};