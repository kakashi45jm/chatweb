import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile, StreamMode, TranslationData } from '../types';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Square, 
  Image as ImageIcon, 
  Smile, 
  Phone, 
  Video, 
  Share2, 
  Cpu, 
  Volume2, 
  Play, 
  Pause, 
  Check, 
  CheckCheck,
  Sparkles,
  Globe,
  Languages,
  Wand2,
  Lock,
  ChevronDown,
  Copy,
  Info,
  User,
  X
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { soundEffects } from '../utils/audioHelper';
import { getSafeAudioContext, unlockAudio, pcmToWavBase64 } from '../utils/legacyCompatibility';
import { requestAITranslation } from '../utils/aiTranslate';
import { SUPPORTED_LANGUAGES } from './ProfileModal';

interface Props {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  roomName: string;
  roomId: string;
  participants: UserProfile[];
  typingUsers: string[];
  streamModePreference: StreamMode;
  onSendMessage: (text: string, attachment?: any) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onOpenInvite: () => void;
  onOpenDiagnostics: () => void;
  onTyping: (isTyping: boolean) => void;
  isLowMemoryMode: boolean;
  isDirectMessage?: boolean;
  dmPartner?: UserProfile;
  onOpenUserProfile?: (user: UserProfile) => void;
  preferredLanguage?: string;
}

export function ChatArea({
  messages,
  currentUserId,
  currentUserName,
  roomName,
  roomId,
  participants,
  typingUsers,
  streamModePreference,
  onSendMessage,
  onStartCall,
  onOpenInvite,
  onOpenDiagnostics,
  onTyping,
  isLowMemoryMode,
  isDirectMessage = false,
  dmPartner,
  onOpenUserProfile,
  preferredLanguage = 'English',
}: Props) {
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // AI Translation & Grammar State
  const [translatedMessages, setTranslatedMessages] = useState<{ [msgId: string]: TranslationData }>({});
  const [translatingMsgIds, setTranslatingMsgIds] = useState<{ [msgId: string]: boolean }>({});
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>(preferredLanguage);
  const [showAIComposeBar, setShowAIComposeBar] = useState<boolean>(false);
  const [isAIPolishing, setIsAIPolishing] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ original: string; enhanced: string; translation?: string; notes?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceTimerRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceScriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const voicePcmSamplesRef = useRef<number[]>([]);
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers, translatedMessages]);

  useEffect(() => {
    setSelectedTargetLang(preferredLanguage);
  }, [preferredLanguage]);

  // Handle Typing Indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    soundEffects.playMessageSound(true);
    onSendMessage(inputText.trim());
    setInputText('');
    setAiSuggestion(null);
    setShowAIComposeBar(false);
    onTyping(false);
  };

  // Quick Emoji Picker Click
  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Image Upload handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      soundEffects.playMessageSound(true);
      onSendMessage('', {
        type: 'image',
        url: base64,
        name: file.name,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Voice Note Recording
  const startVoiceRecording = async () => {
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecordingVoice(true);
      setVoiceDuration(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration((prev) => prev + 1);
      }, 1000);

      if (typeof window !== 'undefined' && (window as any).MediaRecorder) {
        audioChunksRef.current = [];
        const recorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            soundEffects.playMessageSound(true);
            onSendMessage('', {
              type: 'audio',
              url: base64,
              duration: voiceDuration,
            });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((t) => t.stop());
        };

        recorder.start();
      } else {
        voiceAudioContextRef.current = ctx;
        if (ctx) {
          const source = ctx.createMediaStreamSource(stream);
          const scriptNode = ctx.createScriptProcessor(4096, 1, 1);
          voiceScriptNodeRef.current = scriptNode;
          voicePcmSamplesRef.current = [];

          scriptNode.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            for (let i = 0; i < inputData.length; i++) {
              voicePcmSamplesRef.current.push(inputData[i]);
            }
          };

          source.connect(scriptNode);
          scriptNode.connect(ctx.destination);
          mediaRecorderRef.current = { stream };
        }
      }
    } catch (err) {
      alert('Microphone access is needed to record voice notes. Please check device permissions.');
      setIsRecordingVoice(false);
    }
  };

  const stopVoiceRecording = () => {
    if (!isRecordingVoice) return;
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.stop) {
      mediaRecorderRef.current.stop();
    } else if (voiceAudioContextRef.current && voiceScriptNodeRef.current) {
      voiceScriptNodeRef.current.disconnect();
      const samples = new Float32Array(voicePcmSamplesRef.current);
      const wavBase64 = pcmToWavBase64(samples, voiceAudioContextRef.current.sampleRate);
      const audioUrl = `data:audio/wav;base64,${wavBase64}`;

      soundEffects.playMessageSound(true);
      onSendMessage('', {
        type: 'audio',
        url: audioUrl,
        duration: Math.max(1, voiceDuration),
      });

      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t: any) => t.stop());
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((t: any) => t.stop());
    }
    if (voiceScriptNodeRef.current) {
      voiceScriptNodeRef.current.disconnect();
    }
  };

  // Play Audio Message
  const togglePlayAudio = (msgId: string, url: string) => {
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);

    if (playingAudioId === msgId) {
      audioElementsRef.current[msgId]?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    if (!audioElementsRef.current[msgId]) {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudioId(null);
      audioElementsRef.current[msgId] = audio;
    }

    audioElementsRef.current[msgId].play().then(() => {
      setPlayingAudioId(msgId);
    }).catch((e) => {
      console.warn('Audio play error:', e);
    });
  };

  // Translate a received or sent chat message using Gemini AI
  const handleTranslateMessage = async (msg: ChatMessage, customLang?: string) => {
    const targetLang = customLang || selectedTargetLang || 'English';
    const msgId = msg.id;

    // Toggle off if already showing translation in the same language
    if (translatedMessages[msgId] && translatedMessages[msgId].targetLanguage === targetLang) {
      const updated = { ...translatedMessages };
      delete updated[msgId];
      setTranslatedMessages(updated);
      return;
    }

    setTranslatingMsgIds((prev) => ({ ...prev, [msgId]: true }));
    try {
      const result = await requestAITranslation({
        text: msg.text,
        targetLanguage: targetLang,
        mode: 'translate',
      });
      setTranslatedMessages((prev) => ({
        ...prev,
        [msgId]: result,
      }));
    } finally {
      setTranslatingMsgIds((prev) => ({ ...prev, [msgId]: false }));
    }
  };

  // Pre-Send Compose Polish & Translate
  const handlePolishComposeText = async (mode: 'enhance' | 'translate') => {
    if (!inputText.trim()) return;

    setIsAIPolishing(true);
    setShowAIComposeBar(true);
    try {
      const result = await requestAITranslation({
        text: inputText.trim(),
        targetLanguage: selectedTargetLang || 'English',
        mode: mode === 'enhance' ? 'enhance' : 'translate',
      });

      setAiSuggestion({
        original: inputText.trim(),
        enhanced: result.translatedText,
        translation: mode === 'translate' ? result.translatedText : undefined,
        notes: result.grammarNotes,
      });
    } finally {
      setIsAIPolishing(false);
    }
  };

  const applyAISuggestion = () => {
    if (aiSuggestion?.enhanced) {
      setInputText(aiSuggestion.enhanced);
      setAiSuggestion(null);
      setShowAIComposeBar(false);
    }
  };

  const findParticipant = (senderId: string) => {
    if (dmPartner && dmPartner.id === senderId) return dmPartner;
    return participants.find((p) => p.id === senderId);
  };

  return (
    <div id="chat-main-pane" className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      
      {/* Top Navigation & Action Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-xs z-10">
        <div className="flex items-center space-x-3 min-w-0">
          
          {/* Avatar / Room Icon */}
          {isDirectMessage && dmPartner ? (
            <div 
              onClick={() => onOpenUserProfile && onOpenUserProfile(dmPartner)}
              className="cursor-pointer group shrink-0"
              title="Click to view profile"
            >
              <UserAvatar
                user={dmPartner}
                showOnlineDot={true}
                isOnline={true}
                size="lg"
                shape="rounded-2xl"
                className="group-hover:ring-2 group-hover:ring-blue-500 transition"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-xs shrink-0">
              {roomName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 
                onClick={() => isDirectMessage && dmPartner && onOpenUserProfile && onOpenUserProfile(dmPartner)}
                className={`text-sm sm:text-base font-bold text-slate-900 truncate flex items-center gap-1.5 ${
                  isDirectMessage ? 'cursor-pointer hover:text-blue-600 transition' : ''
                }`}
              >
                <span>{isDirectMessage && dmPartner ? dmPartner.name : roomName}</span>
                {isDirectMessage && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                    <Lock className="w-2.5 h-2.5" /> 1v1 Private
                  </span>
                )}
              </h1>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
              {isDirectMessage && dmPartner ? (
                <>
                  <span>{dmPartner.customStatusEmoji || '🟢'}</span>
                  <span className="truncate">{dmPartner.statusMessage || dmPartner.deviceType}</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>{participants.length} online</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-400">#{roomId.substring(0, 6)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          
          {/* Target Language Dropdown Chip */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedTargetLang}
              onChange={(e) => setSelectedTargetLang(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  AI: {lang.code}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Call Button */}
          <button
            id="start-audio-call-btn"
            onClick={() => onStartCall('audio')}
            title="Start Audio Call"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition active:scale-95 border border-slate-200 hover:border-emerald-200"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Audio</span>
          </button>

          {/* Video Call Button */}
          <button
            id="start-video-call-btn"
            onClick={() => onStartCall('video')}
            title="Start Video Call"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition active:scale-95 shadow-xs shadow-blue-500/20"
          >
            <Video className="w-4 h-4" />
            <span>Video Call</span>
          </button>

          {/* Invite & QR (Only for room) */}
          {!isDirectMessage && (
            <button
              id="open-invite-btn"
              onClick={onOpenInvite}
              title="Invite & QR Code"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Diagnostics Modal Trigger */}
          <button
            id="open-diagnostics-btn"
            onClick={onOpenDiagnostics}
            title="iPad & Hardware Diagnostics"
            className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
          >
            <Cpu className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </header>

      {/* Message Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
              {isDirectMessage ? <Lock className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-sm">
                {isDirectMessage && dmPartner ? `Direct Message with ${dmPartner.name}` : `Welcome to ${roomName}`}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {isDirectMessage 
                  ? 'End-to-end direct 1v1 conversation. Private messages and instant audio/video calling.'
                  : 'Real-time messaging, audio calls, and video calls ready. Use Gemini AI for instant chat translation & grammar polish!'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.isSystem;
            const senderObj = findParticipant(msg.senderId);
            const translation = translatedMessages[msg.id];
            const isTranslating = translatingMsgIds[msg.id];

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-medium">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <button
                    type="button"
                    onClick={() => senderObj && onOpenUserProfile && onOpenUserProfile(senderObj)}
                    className="shrink-0 mb-1 hover:ring-2 hover:ring-blue-400 rounded-full transition"
                    title="View Profile"
                  >
                    <UserAvatar
                      user={senderObj || undefined}
                      name={msg.senderName}
                      avatarColor={msg.senderAvatarColor || '#3b82f6'}
                      avatarUrl={msg.senderAvatarUrl || senderObj?.avatarUrl}
                      avatarMediaType={msg.senderAvatarMediaType || senderObj?.avatarMediaType}
                      size="sm"
                      shape="circle"
                    />
                  </button>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <div 
                      onClick={() => senderObj && onOpenUserProfile && onOpenUserProfile(senderObj)}
                      className="text-[11px] font-semibold text-slate-600 ml-1 cursor-pointer hover:text-blue-600 flex items-center gap-1"
                    >
                      <span>{msg.senderName}</span>
                      {senderObj?.customStatusEmoji && <span>{senderObj.customStatusEmoji}</span>}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="relative group/bubble">
                    <div
                      className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      {/* Text content */}
                      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                      {/* Gemini AI Translation Box */}
                      {translation && (
                        <div className={`mt-2 pt-2 border-t text-xs rounded-xl p-2.5 space-y-1 ${
                          isMe 
                            ? 'bg-blue-700/60 border-blue-400/30 text-blue-50' 
                            : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-indigo-600">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              Translated to {translation.targetLanguage} (Gemini AI)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleTranslateMessage(msg)}
                              className="opacity-70 hover:opacity-100 text-[10px] underline"
                            >
                              Hide
                            </button>
                          </div>
                          
                          <p className="font-medium text-xs sm:text-sm">{translation.translatedText}</p>
                          
                          {translation.grammarNotes && (
                            <p className="text-[10px] opacity-75 italic flex items-center gap-1">
                              <Info className="w-2.5 h-2.5 shrink-0" />
                              {translation.grammarNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Image Attachment */}
                      {msg.attachment?.type === 'image' && (
                        <div className="mt-1 rounded-xl overflow-hidden border border-black/10">
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name || 'Attachment'}
                            className="max-h-64 w-auto rounded-lg object-contain bg-slate-900/10"
                          />
                        </div>
                      )}

                      {/* Voice Note Audio Attachment */}
                      {msg.attachment?.type === 'audio' && (
                        <div className={`flex items-center gap-3 p-2 rounded-xl min-w-[200px] ${
                          isMe ? 'bg-blue-700/60' : 'bg-slate-100'
                        }`}>
                          <button
                            id={`play-audio-${msg.id}`}
                            onClick={() => togglePlayAudio(msg.id, msg.attachment!.url)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 transition active:scale-95 ${
                              isMe ? 'bg-white text-blue-700' : 'bg-blue-600'
                            }`}
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-0.5 h-4">
                              {[30, 60, 40, 80, 50, 90, 35, 75, 45, 65, 30].map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-1 rounded-full ${
                                    isMe ? 'bg-blue-200' : 'bg-slate-400'
                                  } ${playingAudioId === msg.id ? 'animate-pulse' : ''}`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <div className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>
                              Voice Note ({msg.attachment.duration || 1}s)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Floating Action Icons (Translate, Copy) */}
                    {msg.text && (
                      <div className={`absolute top-0 opacity-0 group-hover/bubble:opacity-100 transition flex items-center gap-1 ${
                        isMe ? 'right-full mr-2' : 'left-full ml-2'
                      }`}>
                        <button
                          type="button"
                          onClick={() => handleTranslateMessage(msg)}
                          disabled={isTranslating}
                          className="p-1 rounded-lg bg-white shadow-xs border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition text-[10px] flex items-center gap-0.5"
                          title={`Translate to ${selectedTargetLang} with Gemini AI`}
                        >
                          <Globe className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin text-indigo-600' : ''}`} />
                          <span className="hidden sm:inline font-semibold">Translate</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata line */}
                  <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isMe ? 'justify-end pr-1' : 'pl-1'}`}>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-blue-500" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500 italic py-1">
            <span className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>{typingUsers.join(', ')} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* AI Grammar Polish & Translation Compose Preview Box */}
      {showAIComposeBar && (
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-200/80 shadow-xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Gemini AI Linguistic Assistant</span>
            </div>
            <button
              onClick={() => setShowAIComposeBar(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isAIPolishing ? (
            <div className="py-2 flex items-center gap-2 text-xs text-indigo-700 font-medium">
              <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <span>Gemini is analyzing and perfecting grammar & translation...</span>
            </div>
          ) : aiSuggestion ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                {aiSuggestion.enhanced}
              </div>
              {aiSuggestion.notes && (
                <div className="text-[11px] text-indigo-700 italic">
                  💡 {aiSuggestion.notes}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyAISuggestion}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use This Text</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePolishComposeText('enhance')}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 shadow-2xs transition"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Fix Grammar & Polish</span>
              </button>

              <button
                type="button"
                onClick={() => handlePolishComposeText('translate')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Translate to {selectedTargetLang}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Emojis Drawer */}
      {showEmojiPicker && (
        <div className="p-2 bg-white border-t border-slate-200 flex items-center justify-around text-xl shadow-xs">
          {['😀', '😂', '👍', '❤️', '🎉', '🔥', '👋', '🙏', '🚀', '✨', '💯', '👏'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              className="p-1 hover:scale-125 transition active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Voice Note Active Recording Bar */}
      {isRecordingVoice && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-center justify-between text-xs text-red-700 animate-pulse">
          <div className="flex items-center gap-2 font-semibold">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span>Recording Voice Note ({voiceDuration}s)...</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="cancel-voice-record-btn"
              onClick={cancelVoiceRecording}
              className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              id="stop-voice-record-btn"
              onClick={stopVoiceRecording}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-xs"
            >
              Send Voice
            </button>
          </div>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          
          {/* File / Photo Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            id="attach-image-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Photo"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Emoji toggle */}
          <button
            id="toggle-emoji-btn"
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert Emoji"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* AI Polish Button */}
          {inputText.trim().length > 2 && (
            <button
              id="compose-ai-polish-btn"
              type="button"
              onClick={() => {
                setShowAIComposeBar(!showAIComposeBar);
                if (!showAIComposeBar) {
                  handlePolishComposeText('enhance');
                }
              }}
              title="Fix Grammar & Translate with Gemini AI"
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition flex items-center gap-1 font-bold text-xs bg-indigo-50/60 border border-indigo-200/80"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">AI Polish</span>
            </button>
          )}

          {/* Text Input */}
          <input
            id="chat-message-input"
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={isDirectMessage && dmPartner ? `Message ${dmPartner.name}...` : 'Type a message...'}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden transition text-slate-800"
          />

          {/* Voice Note Button or Send Button */}
          {inputText.trim() ? (
            <button
              id="send-message-btn"
              type="submit"
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs transition"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              id="record-voice-btn"
              type="button"
              onClick={startVoiceRecording}
              title="Record Voice Note"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 active:scale-95 transition"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}

        </form>
      </div>

    </div>
  );
}
