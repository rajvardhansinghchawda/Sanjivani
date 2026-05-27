import { useState, useRef, useEffect } from 'react';
import {
  X, Send, Wifi, WifiOff, Loader2,
  Paperclip, Mic, StopCircle, Download, FileText, Volume2,
} from 'lucide-react';
import { useChatSocket } from '@/hooks/useChatSocket';
import { caregiverAgent } from '@/agents/caregiver.agent';
import { axiosInstance } from '@/lib/axios';

function formatTime(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageBubble({ msg, isOwn }) {
  const time    = formatTime(msg.created_at);
  const isFile  = msg.type === 'file';
  const mime    = msg.mime_type || '';
  const isImage = mime.startsWith('image/');
  const isAudio = mime.startsWith('audio/');

  const bubbleBase = `rounded-2xl shadow-sm overflow-hidden ${
    isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
  }`;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[72%] ${bubbleBase}`}>

        {/* Text */}
        {!isFile && (
          <div className="px-4 py-2.5">
            <p className="break-words text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'}`}>
              {time}{isOwn && msg.is_read && ' ✓✓'}
            </p>
          </div>
        )}

        {/* Image */}
        {isFile && isImage && (
          <div>
            <img
              src={msg.file_url} alt={msg.file_name || 'image'}
              className="max-w-[260px] max-h-[320px] object-cover cursor-pointer"
              onClick={() => window.open(msg.file_url, '_blank')}
            />
            <div className={`flex items-center justify-between px-3 py-1.5 gap-3 ${isOwn ? 'bg-primary/80' : 'bg-muted/80'}`}>
              <span className="text-[10px] truncate max-w-[140px]">{msg.file_name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] opacity-60">{time}</span>
                <a href={msg.file_url} download={msg.file_name} className="opacity-70 hover:opacity-100 transition-opacity">
                  <Download className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Audio / voice note */}
        {isFile && isAudio && (
          <div className="px-4 py-3 flex flex-col gap-2 min-w-[220px]">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-4 h-4 opacity-70 flex-shrink-0" />
              <span className="text-xs font-semibold">Voice Note</span>
            </div>
            <audio controls src={msg.file_url} className="w-full h-8 rounded-lg" style={{ minWidth: 200 }} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] opacity-60">{formatBytes(msg.file_size)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-60">{time}</span>
                <a href={msg.file_url} download={msg.file_name || 'voice-note.webm'} className="opacity-70 hover:opacity-100">
                  <Download className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Generic file */}
        {isFile && !isImage && !isAudio && (
          <div className="px-4 py-3 flex items-center gap-3 min-w-[200px]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-primary/10'}`}>
              <FileText className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-primary'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{msg.file_name || 'File'}</p>
              <p className="text-[10px] opacity-60">{formatBytes(msg.file_size)} · {time}</p>
            </div>
            <a
              href={msg.file_url} download={msg.file_name}
              className={`p-2 rounded-xl transition-colors flex-shrink-0 ${isOwn ? 'hover:bg-white/20' : 'hover:bg-primary/10'}`}
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatDrawer({ patientId, patientName, roomId: externalRoomId, onClose }) {
  const [roomId,    setRoomId]    = useState(externalRoomId || null);
  const [loading,   setLoading]   = useState(!externalRoomId);
  const [input,     setInput]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef   = useRef(null);
  const mediaRecRef    = useRef(null);
  const audioChunksRef = useRef([]);

  const { messages, sendMessage, sendFileMessage, sendTyping, isConnected, isTyping, currentUserId } =
    useChatSocket(roomId);

  // Create/get room on mount (skip if roomId provided directly)
  useEffect(() => {
    if (externalRoomId) return;
    caregiverAgent.getOrCreateChatRoom(patientId)
      .then((res) => setRoomId(res?.id || res?.data?.id))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId, externalRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Text ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || !isConnected) return;
    sendMessage(text);
    setInput('');
    sendTyping(false);
    clearTimeout(typingTimerRef.current);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = async (blob, fileName, mimeType) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', blob, fileName);
      form.append('room_id', roomId);

      const res = await axiosInstance.post(
        `/api/communications/rooms/${roomId}/upload/`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const { file_url, file_name, file_size } = res.data?.data || res.data || {};
      sendFileMessage({ file_url, file_name: file_name || fileName, file_size: file_size || blob.size, mime_type: mimeType });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file, file.name, file.type || 'application/octet-stream');
    e.target.value = '';
  };

  // ── Voice note ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const ts   = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        uploadFile(blob, `voice-note-${ts}.webm`, 'audio/webm');
      };
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => { mediaRecRef.current?.stop(); setRecording(false); };
  const toggleRecording = () => { recording ? stopRecording() : startRecording(); };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col bg-background border-l border-border shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
            {(patientName || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{patientName}</p>
            <div className="flex items-center gap-1.5">
              {isConnected
                ? <><Wifi className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-emerald-500 font-medium">Connected</span></>
                : <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Connecting…</span></>
              }
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs">Say hello to {patientName}!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id || msg.created_at}
              msg={msg}
              isOwn={msg.is_own ?? String(msg.sender_id) === String(currentUserId)}
            />
          ))
        )}

        {isTyping && (
          <div className="flex justify-start mb-2">
            <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {uploading && (
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2.5 rounded-2xl">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-primary font-medium">Uploading…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background flex-shrink-0">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,audio/*"
        />
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || uploading}
            title="Attach file"
            className="w-9 h-9 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? `Message ${patientName}…` : 'Connecting…'}
            disabled={!isConnected}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 max-h-28"
            style={{ minHeight: '42px' }}
          />

          <button
            onClick={toggleRecording}
            disabled={!isConnected || uploading}
            title={recording ? 'Stop recording' : 'Record voice note'}
            className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0 ${
              recording
                ? 'bg-destructive text-white animate-pulse'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            {recording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={handleSend}
            disabled={!isConnected || !input.trim()}
            className="w-9 h-9 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {recording && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
            <span className="text-xs text-destructive font-semibold">Recording… tap stop when done</span>
          </div>
        )}
      </div>
    </div>
  );
}
