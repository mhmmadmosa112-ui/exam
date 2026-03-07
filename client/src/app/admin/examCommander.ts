import { Server, Socket } from 'socket.io';

// In-memory store for exam states (In a real app, use Redis)
const examStates: Record<string, { extendedMinutes: number; isLocked: boolean }> = {};
const activeSessions: Map<string, Set<string>> = new Map(); // examId -> Set<studentSocketId>

export const setupExamCommander = (io: Server) => {
  const monitoringNamespace = io.of('/monitoring');

  const updateStudentCount = async (examId: string) => {
    const room = monitoringNamespace.adapter.rooms.get(`exam-${examId}`);
    const count = room ? room.size : 0;
    // Emit to all admins
    monitoringNamespace.to('admins').emit('student-count-update', { examId, count });
    
    // Also emit global dashboard update
    monitoringNamespace.to('admins').emit('active-sessions-update', { 
      examId, 
      activeCount: count 
    });
  };

  monitoringNamespace.on('connection', (socket: Socket) => {
    
    // --- Admin Events ---
    socket.on('admin-join', ({ adminId }: { adminId: string }) => {
      socket.join(`admin-${adminId}`);
      socket.join('admins'); // Join a general admin room for broadcasts
    });

    socket.on('admin-command', (command: { type: string; examId: string; payload?: any }) => {
      const { type, examId, payload } = command;
      console.log(`[Commander] Admin command ${type} for exam ${examId}`, payload);

      switch (type) {
        case 'START_EXAM':
          // Broadcast to all students in the exam room
          monitoringNamespace.to(`exam-${examId}`).emit('EXAM_START_ALL');
          break;

        case 'EXTEND_TIME':
          const minutes = payload?.minutes || 0;
          if (!examStates[examId]) examStates[examId] = { extendedMinutes: 0, isLocked: false };
          examStates[examId].extendedMinutes += minutes;
          
          monitoringNamespace.to(`exam-${examId}`).emit('TIME_EXTENDED', { 
            additionalMinutes: minutes,
            totalExtendedMinutes: examStates[examId].extendedMinutes 
          });
          break;

        case 'INSTANT_LOCK':
          if (!examStates[examId]) examStates[examId] = { extendedMinutes: 0, isLocked: false };
          examStates[examId].isLocked = true;
          monitoringNamespace.to(`exam-${examId}`).emit('INSTANT_LOCK');
          break;

        case 'TEACHER_CLARIFICATION':
          monitoringNamespace.to(`exam-${examId}`).emit('TEACHER_CLARIFICATION', {
            message: payload?.message
          });
          break;
      }

      // Acknowledge admin
      socket.emit('command-success', { type, examId });
    });

    socket.on('request-student-count', async ({ examId }: { examId: string }) => {
      const room = monitoringNamespace.adapter.rooms.get(`exam-${examId}`);
      const count = room ? room.size : 0;
      // Emit back to the requesting admin only
      socket.emit('student-count-update', { examId, count });
    });

    // --- Student Events ---
    socket.on('join-exam', ({ examId, studentId }: { examId: string, studentId: string }) => {
      (socket as any).examId = examId; // Store examId for disconnect
      (socket as any).studentId = studentId;
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
            additionalMinutes: 0, // Just sync total
            totalExtendedMinutes: state.extendedMinutes 
          });
        }
        if (state.isLocked) {
          socket.emit('INSTANT_LOCK');
        }
      }
      // Update count for all admins
      updateStudentCount(examId);
    });

    socket.on('student-tampered-with-stream', ({ studentId, examId }: { studentId: string, examId: string }) => {
        console.warn(`[Security] Student ${studentId} tampered with stream in exam ${examId}`);
        monitoringNamespace.to('admins').emit('student-tampered', { studentId, examId });
    });

    socket.on('disconnect', () => {
      const examId = (socket as any).examId;
      if (examId) {
        activeSessions.get(examId)?.delete(socket.id);
        // Use a small delay to allow the room list to update
        setTimeout(() => updateStudentCount(examId), 100);
      }
    });
  });
};