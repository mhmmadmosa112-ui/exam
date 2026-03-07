'use client';

import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { Socket } from 'socket.io-client';
import { Video, ScreenShare, MessageSquare, Maximize, Loader2, AlertTriangle } from 'lucide-react';
import { MonitoredStudent } from './LiveGrid';

interface StreamCardProps {
    student: MonitoredStudent;
    socket: Socket;
}

type StreamStatus = 'connecting' | 'connected' | 'disconnected' | 'fallback' | 'tampered';

const StreamCard = ({ student, socket }: StreamCardProps) => {
    const [status, setStatus] = useState<StreamStatus>('connecting');
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [fallbackImages, setFallbackImages] = useState<{ camera: string; screen: string } | null>(null);
    const [activeView, setActiveView] = useState<'camera' | 'screen'>('camera');
    
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);

    useEffect(() => {
        if (!socket) return;

        // Create a new Peer connection for this student
        const newPeer = new (Peer as any)({
            initiator: true, // Admin initiates the connection
            trickle: false,
        });
        peerRef.current = newPeer;

        // When we have a signal (offer), send it to the server to forward to the student
        newPeer.on('signal', (signal: any) => {
            socket.emit('admin-webrtc-signal', {
                signal,
                targetStudentSocketId: student.socketId,
            });
        });

        // When the student signals back (answer), connect
        const handleStudentSignal = ({ signal, fromStudentSocketId }: { signal: any, fromStudentSocketId: string }) => {
            if (fromStudentSocketId === student.socketId) {
                newPeer.signal(signal);
            }
        };
        socket.on('student-signal', handleStudentSignal);

        // When the connection is established
        newPeer.on('connect', () => {
            console.log(`[WebRTC] Connected to ${student.studentId}`);
            setStatus('connected');
        });

        // When we receive a stream from the student
        let streamsReceived = 0;
        newPeer.on('stream', (stream: MediaStream) => {
            console.log(`[WebRTC] Received stream from ${student.studentId}`, stream.id);
            // The student sends two streams. Assume first is camera, second is screen.
            if (streamsReceived === 0) {
                setCameraStream(stream);
                streamsReceived++;
            } else {
                setScreenStream(stream);
            }
        });

        // Handle errors and connection closing
        const handleClose = () => {
            console.log(`[WebRTC] Disconnected from ${student.studentId}. Switching to fallback.`);
            setStatus('fallback');
        };
        newPeer.on('error', handleClose);
        newPeer.on('close', handleClose);

        // Listen for tampering alerts
        const handleTampering = (data: { studentId: string }) => {
            if (data.studentId === student.studentId) {
                setStatus('tampered');
            }
        };
        socket.on('student-tampered', handleTampering);

        // Cleanup
        return () => {
            socket.off('student-signal', handleStudentSignal);
            socket.off('student-tampered', handleTampering);
            if (newPeer) {
                newPeer.destroy();
            }
        };
    }, [student.socketId, socket]);

    // Handle screenshot fallback
    useEffect(() => {
        if (status !== 'fallback' || !socket) return;

        const handleScreenshot = (data: { from: string; camera: string; screen: string }) => {
            // The 'from' here is the student's socket ID on the server
            if (data.from === student.socketId) {
                setFallbackImages({ camera: data.camera, screen: data.screen });
            }
        };

        socket.on('screenshot-from-student', handleScreenshot);
        return () => {
            socket.off('screenshot-from-student', handleScreenshot);
        };
    }, [status, student.socketId, socket]);

    // Attach streams to video elements
    useEffect(() => {
        if (cameraVideoRef.current && cameraStream && activeView === 'camera') {
            cameraVideoRef.current.srcObject = cameraStream;
        }
    }, [cameraStream, activeView]);

    useEffect(() => {
        if (screenVideoRef.current && screenStream && activeView === 'screen') {
            screenVideoRef.current.srcObject = screenStream;
        }
    }, [screenStream, activeView]);

    const handlePingStudent = () => {
        const message = prompt(`Send a warning to ${student.studentId}:`);
        if (message && socket) {
            socket.emit('ping-student', {
                targetStudentSocketId: student.socketId,
                message,
            });
            alert('Ping sent!');
        }
    };

    const getStatusIndicator = () => {
        switch (status) {
            case 'connected':
                return <div className="w-3 h-3 bg-green-500 rounded-full" title="Live Stream Active"></div>;
            case 'connecting':
                return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" title="Connecting..."></div>;
            case 'fallback':
                return <div className="w-3 h-3 bg-orange-500 rounded-full" title="Low Bandwidth (Screenshots)"></div>;
            case 'disconnected':
                return <div className="w-3 h-3 bg-red-500 rounded-full" title="Disconnected"></div>;
            case 'tampered':
                return <div className="w-3 h-3 bg-red-600 animate-ping rounded-full" title="TAMPERED / OFFLINE"></div>;
        }
    };

    return (
        <div className={`bg-gray-800 border rounded-lg shadow-lg overflow-hidden flex flex-col ${status === 'tampered' ? 'border-red-600 ring-2 ring-red-600' : 'border-gray-700'}`}>
            <div className={`p-3 flex justify-between items-center ${status === 'tampered' ? 'bg-red-900/50' : 'bg-gray-700/50'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    {getStatusIndicator()}
                    <p className="text-sm font-semibold text-gray-200 truncate" title={student.studentId}>
                        {student.studentId}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handlePingStudent} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-md transition-colors" title="Ping Student">
                        <MessageSquare className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-md transition-colors" title="Expand View">
                        <Maximize className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grow grid grid-cols-1 gap-px bg-gray-700">
                {/* View Switcher Controls */}
                <div className="absolute top-14 right-2 z-10 flex gap-1 bg-black/50 rounded-lg p-1">
                    <button onClick={() => setActiveView('camera')} className={`p-1 rounded ${activeView === 'camera' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`} title="Camera View"><Video className="w-4 h-4" /></button>
                    <button onClick={() => setActiveView('screen')} className={`p-1 rounded ${activeView === 'screen' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`} title="Screen View"><ScreenShare className="w-4 h-4" /></button>
                </div>

                {activeView === 'camera' ? (
                    <div className="relative bg-black aspect-video">
                        {status === 'connected' && cameraStream ? (
                            <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        ) : status === 'fallback' && fallbackImages?.camera ? (
                            <img src={fallbackImages.camera} alt="Camera Fallback" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                {status === 'connecting' && <Loader2 className="w-6 h-6 animate-spin" />}
                                {status === 'tampered' && <AlertTriangle className="w-8 h-8 text-red-500" />}
                                {status !== 'connecting' && status !== 'tampered' && <Video className="w-8 h-8" />}
                                <span className="text-xs mt-1">{status === 'tampered' ? 'TAMPERED' : 'Camera'}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative bg-black aspect-video">
                         {status === 'connected' && screenStream ? (
                            <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        ) : status === 'fallback' && fallbackImages?.screen ? (
                            <img src={fallbackImages.screen} alt="Screen Fallback" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                {status === 'connecting' && <Loader2 className="w-6 h-6 animate-spin" />}
                                {status === 'tampered' && <AlertTriangle className="w-8 h-8 text-red-500" />}
                                {status !== 'connecting' && status !== 'tampered' && <ScreenShare className="w-8 h-8" />}
                                <span className="text-xs mt-1">{status === 'tampered' ? 'TAMPERED' : 'Screen'}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StreamCard;