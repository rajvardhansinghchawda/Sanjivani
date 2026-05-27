import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useCallSocket } from '@/hooks/useCallSocket';
import { caregiverAgent } from '@/agents/caregiver.agent';

function CallTimer({ active }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return <span className="text-white/70 text-sm font-mono">{m}:{s}</span>;
}

export default function CallModal({ patientId, patientName, onClose }) {
  const [roomId,  setRoomId]  = useState(null);
  const [muted,   setMuted]   = useState(false);
  const [loading, setLoading] = useState(true);

  const remoteAudioRef = useRef(null);

  const { callState, isConnected, localStream, remoteStream, startCall, answerCall, endCall } =
    useCallSocket(roomId, {
      onCallEnded:   () => { onClose(); },
      onCallStarted: () => {},
    });

  // Get room first, then start call once connected
  useEffect(() => {
    caregiverAgent.getOrCreateChatRoom(patientId)
      .then((res) => setRoomId(res?.id || res?.data?.id))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId]);

  // Initiate call once WS is connected and we have a room
  useEffect(() => {
    if (isConnected && callState === 'idle' && roomId) {
      startCall();
    }
  }, [isConnected, callState, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach remote stream to audio element
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Mute/unmute local stream
  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, [muted, localStream]);

  const handleEnd = () => {
    endCall();
    onClose();
  };

  const stateLabel = {
    idle:    'Connecting…',
    ringing: 'Ringing…',
    active:  'In Call',
    ended:   'Call Ended',
  }[callState] ?? 'Connecting…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-80 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden">
        {/* Background pulse when ringing */}
        {callState === 'ringing' && (
          <div className="absolute inset-0 animate-pulse bg-primary/10 pointer-events-none" />
        )}

        <div className="flex flex-col items-center px-8 pt-12 pb-10 gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl">
              {(patientName || '?').slice(0, 2).toUpperCase()}
            </div>
            {callState === 'active' && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900" />
            )}
          </div>

          {/* Name + state */}
          <div className="text-center">
            <h2 className="text-white text-xl font-bold">{patientName}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              {(loading || callState === 'idle') && <Loader2 className="w-3.5 h-3.5 text-white/50 animate-spin" />}
              <p className="text-white/60 text-sm">{loading ? 'Connecting…' : stateLabel}</p>
            </div>
            <CallTimer active={callState === 'active'} />
          </div>

          {/* Ringing — show answer button for the other party */}
          {callState === 'ringing' && (
            <button
              onClick={answerCall}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg transition-colors"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMuted((m) => !m)}
              disabled={callState !== 'active'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 ${
                muted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={handleEnd}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-xl transition-colors"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}
