import { Server, Socket } from 'socket.io';

// ================== Interfaces for Type Safety ==================
interface ExamState {
  extendedMinutes: number;
  isLocked: boolean;
}

interface AdminJoinPayload {
  adminId: string;
}

interface AdminCommandPayload {
  type: string;
  examId: string;
  payload?: {
    minutes?: number;
    message?: string;
    [key: string]: unknown;
  };
}

interface JoinExamPayload {
  examId: string;
  studentId: string;
}

interface TamperPayload {
  studentId: string;
  examId: string;
}

interface CommandSuccessPayload {
  type: string;
  examId: string;
}

interface StudentCountPayload {
  examId: string;
  count: number;
}

interface ActiveSessionsPayload {
  examId: string;
  activeCount: number;
}

interface TimeExtendedPayload {
  additionalMinutes: number;
  totalExtendedMinutes: number;
}

interface ClarificationPayload {
  message?: string;
}

// ================== In-Memory Store ==================
const examStates: Record<string, ExamState> = {};
const activeSessions: Map<string, Set<string>> = new Map(); // examId -> Set<socketId>

// ================== Main Setup Function ==================
export const setupExamCommander = (io: Server): void => {
  const monitoringNamespace = io.of('/monitoring');

  const updateStudentCount = async (examId: string): Promise<void> => {
    const room = monitoringNamespace.adapter.rooms.get(`exam-${examId}`);
    const count = room ? room.size : 0;
    
    // Emit to all admins
    monitoringNamespace.to('admins').emit('student-count-update', { examId, count } as StudentCountPayload);
    
    // Also emit global dashboard update
    monitoringNamespace.to('admins').emit('active-sessions-update', { 
      examId, 
      activeCount: count 
    } as ActiveSessionsPayload);
  };

  monitoringNamespace.on('connection', (socket: Socket): void => {
    
    // --- Admin Events ---
    socket.on('admin-join', ({ adminId }: AdminJoinPayload): void => {
      socket.join(`admin-${adminId}`);
      socket.join('admins'); // Join a general admin room for broadcasts
    });

    socket.on('admin-command', (command: AdminCommandPayload): void => {
      const { type, examId, payload } = command;
      console.log(`[Commander] Admin command ${type} for exam ${examId}`, payload);

      switch (type) {
        case 'START_EXAM':
          monitoringNamespace.to(`exam-${examId}`).emit('EXAM_START_ALL');
          break;

        case 'EXTEND_TIME': {
          const minutes = payload?.minutes ?? 0;
          if (!examStates[examId]) {
            examStates[examId] = { extendedMinutes: 0, isLocked: false };
          }
          examStates[examId].extendedMinutes += minutes;
          
          monitoringNamespace.to(`exam-${examId}`).emit('TIME_EXTENDED', { 
            additionalMinutes: minutes,
            totalExtendedMinutes: examStates[examId].extendedMinutes 
          } as TimeExtendedPayload);
          break;
        }

        case 'INSTANT_LOCK': {
          if (!examStates[examId]) {
            examStates[examId] = { extendedMinutes: 0, isLocked: false };
          }
          examStates[examId].isLocked = true;
          monitoringNamespace.to(`exam-${examId}`).emit('INSTANT_LOCK');
          break;
        }

        case 'TEACHER_CLARIFICATION':
          monitoringNamespace.to(`exam-${examId}`).emit('TEACHER_CLARIFICATION', {
            message: payload?.message
          } as ClarificationPayload);
          break;
      }

      // Acknowledge admin
      socket.emit('command-success', { type, examId } as CommandSuccessPayload);
    });

    socket.on('request-student-count', async ({ examId }: { examId: string }): Promise<void> => {
      const room = monitoringNamespace.adapter.rooms.get(`exam-${examId}`);
      const count = room ? room.size : 0;
      socket.emit('student-count-update', { examId, count } as StudentCountPayload);
    });

    // --- Student Events ---
    socket.on('join-exam', ({ examId, studentId }: JoinExamPayload): void => {
      // ✅ Use socket.data (proper socket.io v4 pattern) instead of casting
      socket.data.examId = examId;
      socket.data.studentId = studentId;
      
      socket.join(`exam-${examId}`);
      
      if (!activeSessions.has(examId)) {
        activeSessions.set(examId, new Set());
      }
      activeSessions.get(examId)?.add(socket.id);
      
      // Send current state to reconnecting student
      if (examStates[examId]) {
        const state = examStates[examId];
        if (state.extendedMinutes > 0) {
          socket.emit('TIME_EXTENDED', { 
            additionalMinutes: 0,
            totalExtendedMinutes: state.extendedMinutes 
          } as TimeExtendedPayload);
        }
        if (state.isLocked) {
          socket.emit('INSTANT_LOCK');
        }
      }
      
      // Update count for all admins
      void updateStudentCount(examId);
    });

    socket.on('student-tampered-with-stream', ({ studentId, examId }: TamperPayload): void => {
      console.warn(`[Security] Student ${studentId} tampered with stream in exam ${examId}`);
      monitoringNamespace.to('admins').emit('student-tampered', { studentId, examId });
    });

    // ✅ Use 'disconnecting' event for reliable cleanup before socket leaves rooms
    socket.on('disconnecting', (): void => {
      const examId = socket.data.examId as string | undefined;
      if (examId) {
        activeSessions.get(examId)?.delete(socket.id);
        // Small delay to allow room list to update
        setTimeout(() => {
          void updateStudentCount(examId);
        }, 100);
      }
    });
  });
};