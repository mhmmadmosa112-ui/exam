'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { Search, Wifi, WifiOff, Loader2 } from 'lucide-react';

const StreamCard = dynamic(() => import('./StreamCard'), {
    ssr: false,
    loading: () => (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col items-center justify-center aspect-video">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            <p className="text-xs text-gray-500 mt-2">Initializing Stream...</p>
        </div>
    ),
});

// Interface for the student data received from the server
export interface MonitoredStudent {
    socketId: string;
    studentId: string; // email
    examId: string;
    name?: string; 
}

interface LiveGridProps {
    userEmail: string;
    isSuperAdmin: boolean;
}

const LiveGrid = ({ userEmail, isSuperAdmin }: LiveGridProps) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [students, setStudents] = useState<MonitoredStudent[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Establish connection to the /monitoring namespace
        const newSocket = io('http://localhost:3001/monitoring');
        setSocket(newSocket);

        // Announce admin's presence
        newSocket.on('connect', () => {
            console.log('[Socket.IO] Admin connected:', newSocket.id);
            newSocket.emit('admin-join', { adminId: userEmail, isSuperAdmin });
        });

        // Listen for the initial list of active students
        newSocket.on('initial-student-list', (studentList: MonitoredStudent[]) => {
            console.log('[Socket.IO] Received initial student list:', studentList);
            setStudents(studentList);
        });

        // Listen for new students joining
        newSocket.on('student-joined', (newStudent: MonitoredStudent) => {
            console.log('[Socket.IO] New student joined:', newStudent);
            setStudents(prev => {
                // Avoid duplicates
                if (prev.find(s => s.socketId === newStudent.socketId)) {
                    return prev;
                }
                return [...prev, newStudent];
            });
        });

        // Listen for students leaving
        newSocket.on('student-left', (studentSocketId: string) => {
            console.log('[Socket.IO] Student left:', studentSocketId);
            setStudents(prev => prev.filter(s => s.socketId !== studentSocketId));
        });

        // Cleanup on component unmount
        return () => {
            console.log('[Socket.IO] Admin disconnecting...');
            newSocket.close();
        };
    }, [userEmail, isSuperAdmin]);

    const filteredStudents = students.filter(student => 
        isSuperAdmin ? student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );

    return (
        <div className="bg-gray-900 text-white p-4 rounded-lg shadow-2xl border border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-300">
                    Live Monitor - <span className="text-indigo-400">{isSuperAdmin ? 'Global View' : 'My Students'}</span>
                </h2>
                <div className="flex items-center gap-4">
                    {isSuperAdmin && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search student email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    )}
                    <span className="flex items-center gap-2 text-sm font-medium text-green-400">
                        <Wifi className="w-5 h-5" />
                        {students.length} Active Session{students.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                    <WifiOff className="w-16 h-16 mb-4" />
                    <p className="text-xl">No active student sessions.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredStudents.map(student => (
                        <StreamCard key={student.socketId} student={student} socket={socket!} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default LiveGrid;