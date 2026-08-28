import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile, StreamMode, TranslationData } from '../types';
import { 
  Send, 
  Mic, 
  Image as ImageIcon, 
  Smile, 
  Phone, 
  Video, 
  Share2, 
  Cpu, 
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
  X,
  Plus,
  Film,
  Camera,
  Layers,
  Crown,
  Shield,
  ShieldCheck,
  Trash2,
  Volume2
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { UserBadges } from './UserBadges';
import { soundEffects } from '../utils/audioHelper';
import { getSafeAudioContext, unlockAudio, pcmToWavBase64 } from '../utils/legacyCompatibility';
import { requestAITranslation } from '../utils/aiTranslate';

export const CHAT_LANGUAGES = [
  { code: 'English', label: 'English (US/UK)' },
  { code: 'Tagalog', label: 'Tagalog / Filipino' },
  { code: 'Spanish', label: 'Spanish (Español)' },
  { code: 'Japanese', label: 'Japanese (日本語)' },
  { code: 'Korean', label: 'Korean (한국어)' },
  { code: 'French', label: 'French (Français)' },
  { code: 'German', label: 'German (Deutsch)' },
  { code: 'Chinese (Simplified)', label: 'Chinese (简体中文)' },
  { code: 'Arabic', label: 'Arabic (العربية)' },
  { code: 'Portuguese', label: 'Portuguese (Português)' },
  { code: 'Russian', label: 'Russian (Русский)' },
  { code: 'Indonesian', label: 'Indonesian (Bahasa)' },
  { code: 'Vietnamese', label: 'Vietnamese (Tiếng Việt)' },
];

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
  isAdmin?: boolean;
  onAdminClearChat?: () => void;
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
  isAdmin = false,
  onAdminClearChat,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // AI Translation & Grammar State
  const [translatedMessages, setTranslatedMessages] = useState<{ [msgId: string]: TranslationData }>({});
  const [translatingMsgIds, setTranslatingMsgIds] = useState<{ [msgId: string]: boolean }>({});
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>(preferredLanguage);
  const [showAIComposeBar, setShowAIComposeBar] = useState<boolean>(false);
  const [showLangSelector, setShowLangSelector] = useState<boolean>(false);
  const [isAIPolishing, setIsAIPolishing] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ original: string; enhanced: string; translation?: string; notes?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputFieldRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const voiceTimerRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceScriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const voicePcmSamplesRef = useRef<number[]>([]);
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, translatedMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSendText = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const textToSend = (inputText || '').trim();
    if (!textToSend) {
      inputFieldRef.current?.focus();
      return;
    }

    soundEffects.playMessageSound(true);
    onSendMessage(textToSend);
    setInputText('');
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    setShowAIComposeBar(false);
    setAiSuggestion(null);
    onTyping(false);
  };

  const handleSendAISuggestion = () => {
    if (!aiSuggestion?.enhanced) return;
    const textToSend = aiSuggestion.enhanced.trim();
    if (!textToSend) return;

    soundEffects.playMessageSound(true);
    onSendMessage(textToSend);
    setInputText('');
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    setShowAIComposeBar(false);
    setAiSuggestion(null);
    onTyping(false);
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputFieldRef.current?.focus();
  };

  // Handle Photo & Video Attachment
  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowPlusMenu(false);
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();

    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        soundEffects.playMessageSound(true);
        onSendMessage('', {
          type: isVideo ? 'video' : 'image',
          url: base64,
          name: file.name,
          size: file.size,
        });
      }
    };

    reader.readAsDataURL(file);
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
  };

  // Voice Note Recording
  const startVoiceRecording = async () => {
    try {
      setShowPlusMenu(false);
      const ctx = getSafeAudioContext();
      unlockAudio(ctx);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setIsRecordingVoice(true);
      setVoiceDuration(0);

      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration((d) => d + 1);
      }, 1000);

      if (typeof MediaRecorder !== 'undefined') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/wav';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onload = () => {
            const base64Audio = reader.result as string;
            soundEffects.playMessageSound(true);
            onSendMessage('', {
              type: 'audio',
              url: base64Audio,
              duration: Math.max(1, voiceDuration),
            });
          };
          reader.readAsDataURL(audioBlob);
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

  // Translate Message with Gemini AI
  const handleTranslateMessage = async (msg: ChatMessage, customLang?: string) => {
    const targetLang = customLang || selectedTargetLang || 'English';
    const msgId = msg.id;

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

  // AI Polish or AI Translate Draft
  const handlePolishComposeText = async (mode: 'enhance' | 'translate') => {
    if (!inputText.trim()) {
      setShowPlusMenu(false);
      setShowAIComposeBar(true);
      return;
    }

    setShowPlusMenu(false);
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
      setShowAIComposeBar(false);
      setAiSuggestion(null);
    }
  };

  const findParticipant = (userId: string) => {
    return participants.find((p) => p.id === userId);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f1a] text-slate-100 relative overflow-hidden">
      
      {/* Hidden File Input for Picture or Video */}
      <input
        ref={mediaFileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaFileSelect}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-[#111424] border-b border-pink-500/20 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-3">
          {isDirectMessage && dmPartner ? (
            <button
              id="chat-header-profile-btn"
              type="button"
              onClick={() => onOpenUserProfile && onOpenUserProfile(dmPartner)}
              className="flex items-center gap-2.5 text-left group"
            >
              <UserAvatar
                user={dmPartner}
                name={dmPartner.name}
                avatarColor={dmPartner.avatarColor}
                avatarUrl={dmPartner.avatarUrl}
                avatarMediaType={dmPartner.avatarMediaType}
                size="md"
                shape="circle"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-pink-400 transition flex items-center gap-1">
                    {dmPartner.name}
                  </h2>
                  <UserBadges user={dmPartner} size="xs" />
                </div>
                <p className="text-[11px] text-pink-300/80 flex items-center gap-1">
                  <span>{dmPartner.customStatusEmoji || '🟢'}</span>
                  <span className="truncate max-w-[140px]">{dmPartner.statusMessage || 'Available'}</span>
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-pink-600/30">
                #
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white">{roomName}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-pink-950/60 text-pink-300 border border-pink-500/30 text-[10px] font-mono">
                    {roomId}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {participants.length} {participants.length === 1 ? 'member' : 'members'} online
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Audio Call, Video Call, Language Picker */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Target Translation Language Selector */}
          <div className="relative">
            <button
              id="select-language-btn"
              type="button"
              onClick={() => setShowLangSelector(!showLangSelector)}
              title="Change AI Translation Language"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-pink-300 text-xs font-bold border border-pink-500/30 flex items-center gap-1 transition"
            >
              <Globe className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">{selectedTargetLang}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLangSelector && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-pink-500/30 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in duration-100 max-h-60 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Translate Language
                </div>
                {CHAT_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedTargetLang(lang.code);
                      setShowLangSelector(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-pink-950/40 hover:text-pink-300 transition ${
                      selectedTargetLang === lang.code ? 'text-pink-400 font-bold bg-pink-950/60' : 'text-slate-300'
                    }`}
                  >
                    <span>{lang.label}</span>
                    {selectedTargetLang === lang.code && <Check className="w-3.5 h-3.5 text-pink-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audio Call Button */}
          <button
            id="start-audio-call-btn"
            onClick={() => onStartCall('audio')}
            title="Start Audio Call"
            className="p-2 rounded-xl bg-pink-600/20 hover:bg-pink-600 text-pink-400 hover:text-white border border-pink-500/40 transition active:scale-95 flex items-center gap-1 text-xs font-bold"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden md:inline">Voice Call</span>
          </button>

          {/* Video Call Button */}
          <button
            id="start-video-call-btn"
            onClick={() => onStartCall('video')}
            title="Start Video Call"
            className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/40 transition active:scale-95 flex items-center gap-1 text-xs font-bold"
          >
            <Video className="w-4 h-4" />
            <span className="hidden md:inline">Video</span>
          </button>

          {/* Admin Clear Chat Option */}
          {isAdmin && !isDirectMessage && onAdminClearChat && (
            <button
              id="admin-clear-chat-btn"
              onClick={onAdminClearChat}
              title="Admin: Clear Room Messages"
              className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 transition active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Share/Invite Room Button */}
          {!isDirectMessage && (
            <button
              id="chat-share-invite-btn"
              onClick={onOpenInvite}
              title="Invite Friends"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Stream Area */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-pink-950/40 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-xl">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">
                {isDirectMessage && dmPartner ? `Direct Chat with ${dmPartner.name}` : 'Welcome to the Room'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                {isDirectMessage 
                  ? 'Private 1v1 conversation. Audio & Video calls ready.'
                  : 'Tap the Plus (+) button below to send photos/videos, translate any language, or fix grammar with Gemini AI.'}
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
                  <span className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
                    msg.isAnnouncement
                      ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}>
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
                    className="shrink-0 mb-1 hover:ring-2 hover:ring-pink-400 rounded-full transition"
                    title="View Profile"
                  >
                    <UserAvatar
                      user={senderObj || undefined}
                      name={msg.senderName}
                      avatarColor={msg.senderAvatarColor || '#ec4899'}
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
                      className="text-[11px] font-semibold text-slate-400 ml-1 cursor-pointer hover:text-pink-400 flex items-center gap-1.5"
                    >
                      <span className="text-slate-200 font-bold">{msg.senderName}</span>
                      <UserBadges 
                        user={senderObj} 
                        isAdmin={msg.senderIsAdmin} 
                        isVip={msg.senderIsVip} 
                        isVerified={msg.senderIsVerified} 
                        customTitle={msg.senderTitle}
                        size="xs" 
                      />
                      {senderObj?.customStatusEmoji && <span>{senderObj.customStatusEmoji}</span>}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="relative group/bubble">
                    <div
                      className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                        isMe
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-xs'
                          : 'bg-[#15192b] text-slate-100 border border-slate-800 rounded-bl-xs'
                      }`}
                    >
                      {/* Text content */}
                      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                      {/* Gemini AI Translation Box */}
                      {translation && (
                        <div className={`mt-2 pt-2 border-t text-xs rounded-xl p-2.5 space-y-1 ${
                          isMe 
                            ? 'bg-purple-950/60 border-pink-400/30 text-pink-50' 
                            : 'bg-black/40 border-pink-500/30 text-pink-200'
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-pink-400">
                              <Sparkles className="w-3 h-3 text-amber-400" />
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
                          
                          <p className="font-medium text-xs sm:text-sm text-white">{translation.translatedText}</p>
                          
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
                        <div className="mt-1 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name || 'Photo'}
                            className="max-h-64 w-auto rounded-lg object-contain"
                          />
                        </div>
                      )}

                      {/* Video Attachment */}
                      {msg.attachment?.type === 'video' && (
                        <div className="mt-1 rounded-xl overflow-hidden border border-white/10 bg-black">
                          <video
                            src={msg.attachment.url}
                            controls
                            playsInline
                            className="max-h-64 w-full rounded-lg object-contain"
                          />
                        </div>
                      )}

                      {/* Voice Note Audio Attachment */}
                      {msg.attachment?.type === 'audio' && (
                        <div className={`flex items-center gap-3 p-2 rounded-xl min-w-[200px] ${
                          isMe ? 'bg-black/30' : 'bg-black/40'
                        }`}>
                          <button
                            id={`play-audio-${msg.id}`}
                            onClick={() => togglePlayAudio(msg.id, msg.attachment!.url)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 transition active:scale-95 ${
                              isMe ? 'bg-white text-pink-600' : 'bg-pink-600'
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
                                    isMe ? 'bg-pink-300' : 'bg-slate-400'
                                  } ${playingAudioId === msg.id ? 'animate-pulse' : ''}`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <div className={`text-[10px] ${isMe ? 'text-pink-200' : 'text-slate-400'}`}>
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
                          className="p-1.5 rounded-lg bg-slate-800 shadow-md border border-slate-700 text-slate-300 hover:text-pink-400 hover:bg-slate-700 transition text-[10px] flex items-center gap-1"
                          title={`Translate to ${selectedTargetLang} with Gemini AI`}
                        >
                          <Globe className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin text-pink-400' : ''}`} />
                          <span className="hidden sm:inline font-semibold">Translate</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata timestamp */}
                  <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 ${isMe ? 'justify-end pr-1' : 'pl-1'}`}>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-pink-400" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-pink-400 italic py-1">
            <span className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>{typingUsers.join(', ')} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* AI Grammar Polish & Translation Compose Preview Box */}
      {showAIComposeBar && (
        <div className="px-4 py-3.5 bg-[#131627] border-t border-pink-500/30 shadow-xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-pink-300">
              <div className="w-5 h-5 rounded-lg bg-pink-600/30 flex items-center justify-center text-pink-400 border border-pink-500/40">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              </div>
              <span className="font-semibold tracking-wide">Gemini AI Grammar & Linguistic Assistant</span>
            </div>
            <button
              onClick={() => { setShowAIComposeBar(false); setAiSuggestion(null); }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Close AI Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isAIPolishing ? (
            <div className="py-3 px-4 rounded-xl bg-pink-950/20 border border-pink-500/20 flex items-center gap-3 text-xs text-pink-200 font-medium">
              <div className="w-4 h-4 rounded-full border-2 border-pink-500 border-t-transparent animate-spin shrink-0" />
              <span>Sinusuri ng Gemini ang grammar at binubuo ang tamang sentence structure...</span>
            </div>
          ) : aiSuggestion ? (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-black/50 border border-pink-500/40 text-xs sm:text-sm text-white font-medium leading-relaxed shadow-inner">
                <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-pink-400" />
                  <span>Grammar-Polished Output:</span>
                </div>
                {aiSuggestion.enhanced}
              </div>

              {aiSuggestion.notes && (
                <div className="text-[11px] text-pink-300/90 bg-pink-950/30 px-3 py-1.5 rounded-lg border border-pink-500/20 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>{aiSuggestion.notes}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyAISuggestion}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Use Text in Input</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendAISuggestion}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Corrected Message</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">
                {inputText.trim() 
                  ? `Pumili ng gagawin para sa: "${inputText.slice(0, 45)}${inputText.length > 45 ? '...' : ''}"`
                  : 'Mag-type muna ng mensahe sa chat bar, o pumili ng mabilisang aksyon sa ibaba:'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={() => handlePolishComposeText('enhance')}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition active:scale-95"
                >
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  <span>✨ AI Fix Grammar & Spelling</span>
                </button>

                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={() => handlePolishComposeText('translate')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 shadow-xs transition active:scale-95"
                >
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>Translate to {selectedTargetLang}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Emojis Drawer */}
      {showEmojiPicker && (
        <div className="p-2 bg-[#10121e] border-t border-slate-800 flex items-center justify-around text-xl shadow-md">
          {['😀', '😂', '👍', '❤️', '🎉', '🔥', '👋', '🙏', '🚀', '✨', '💯', '👏', '👑', '⚡'].map((emoji) => (
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
        <div className="px-4 py-3 bg-red-950/60 border-t border-red-500/40 flex items-center justify-between text-xs text-red-200 animate-pulse">
          <div className="flex items-center gap-2 font-semibold">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>Recording Voice Note ({voiceDuration}s)...</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="cancel-voice-record-btn"
              onClick={cancelVoiceRecording}
              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              id="stop-voice-record-btn"
              onClick={stopVoiceRecording}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 shadow-xs"
            >
              Send Voice
            </button>
          </div>
        </div>
      )}

      {/* Plus Menu Action Sheet Popover */}
      {showPlusMenu && (
        <div className="px-4 py-3 bg-[#111424] border-t border-pink-500/30 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Chat Tools & Attachments
            </span>
            <button 
              onClick={() => setShowPlusMenu(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. Send Picture or Video */}
            <button
              id="plus-action-send-media"
              type="button"
              onClick={() => mediaFileInputRef.current?.click()}
              className="p-3 rounded-2xl bg-black/40 hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/40 text-left transition flex flex-col gap-1.5 active:scale-95 group"
            >
              <div className="w-8 h-8 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Send Picture/Video</span>
                <span className="text-[10px] text-slate-400">Photos or MP4/WebM</span>
              </div>
            </button>

            {/* 2. AI Fix Grammar */}
            <button
              id="plus-action-ai-grammar"
              type="button"
              onClick={() => {
                setShowPlusMenu(false);
                setShowAIComposeBar(true);
                if (inputText.trim()) {
                  handlePolishComposeText('enhance');
                } else {
                  inputFieldRef.current?.focus();
                }
              }}
              className="p-3 rounded-2xl bg-black/40 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 text-left transition flex flex-col gap-1.5 active:scale-95 group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">AI Fix Grammar</span>
                <span className="text-[10px] text-slate-400">Polish spelling & structure</span>
              </div>
            </button>

            {/* 3. AI Translate */}
            <button
              id="plus-action-ai-translate"
              type="button"
              onClick={() => {
                setShowPlusMenu(false);
                setShowAIComposeBar(true);
                if (inputText.trim()) {
                  handlePolishComposeText('translate');
                } else {
                  inputFieldRef.current?.focus();
                }
              }}
              className="p-3 rounded-2xl bg-black/40 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 text-left transition flex flex-col gap-1.5 active:scale-95 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">AI Translate</span>
                <span className="text-[10px] text-slate-400">Translate to {selectedTargetLang}</span>
              </div>
            </button>

            {/* 4. Voice Memo */}
            <button
              id="plus-action-voice-note"
              type="button"
              onClick={startVoiceRecording}
              className="p-3 rounded-2xl bg-black/40 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-left transition flex flex-col gap-1.5 active:scale-95 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Voice Note</span>
                <span className="text-[10px] text-slate-400">Record audio message</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Input Bar */}
      <div className="p-3 bg-[#10121e] border-t border-pink-500/20">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          
          {/* Prominent Plus (+) Button */}
          <button
            id="chat-plus-menu-btn"
            type="button"
            onClick={() => setShowPlusMenu(!showPlusMenu)}
            title="Add Media, AI Translation, Grammar Polish"
            className={`p-2.5 rounded-2xl transition active:scale-95 flex items-center justify-center shadow-sm shrink-0 ${
              showPlusMenu 
                ? 'bg-pink-600 text-white shadow-pink-600/30' 
                : 'bg-black/50 text-pink-400 hover:bg-pink-600 hover:text-white border border-pink-500/30'
            }`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
          </button>

          {/* Emoji toggle button */}
          <button
            id="toggle-emoji-btn"
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert Emoji"
            className="p-2.5 text-slate-400 hover:text-pink-400 hover:bg-slate-800/60 rounded-xl transition shrink-0"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Input Field */}
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputFieldRef}
              id="chat-message-input"
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText(e);
                }
              }}
              placeholder={isDirectMessage && dmPartner ? `Message ${dmPartner.name}...` : 'Type a message...'}
              className="w-full pl-4 pr-10 sm:pr-24 py-2.5 text-xs sm:text-sm bg-black/40 focus:bg-black/60 rounded-xl border border-slate-800 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-hidden transition text-white placeholder-slate-500"
            />

            {/* In-Input AI Grammar Fix Button (Always easily clickable) */}
            <button
              id="compose-ai-grammar-btn"
              type="button"
              onClick={() => {
                setShowAIComposeBar(true);
                if (inputText.trim()) {
                  handlePolishComposeText('enhance');
                } else {
                  inputFieldRef.current?.focus();
                }
              }}
              title="Fix Grammar with Gemini AI"
              className="absolute right-2 px-2 py-1 rounded-lg bg-pink-950/60 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/30 transition flex items-center gap-1 text-[11px] font-bold active:scale-95 shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">AI Grammar</span>
            </button>
          </div>

          {/* Voice Memo Shortcut Button */}
          {!inputText.trim() && (
            <button
              id="record-voice-btn"
              type="button"
              onClick={startVoiceRecording}
              title="Record Voice Note"
              className="p-2.5 rounded-xl bg-black/40 hover:bg-pink-950/40 hover:text-pink-400 text-slate-400 active:scale-95 transition border border-slate-800 shrink-0"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}

          {/* Send Button (ALWAYS visible and clickable) */}
          <button
            id="send-message-btn"
            type="submit"
            onClick={(e) => handleSendText(e)}
            disabled={false}
            title={inputText.trim() ? 'Send Message' : 'Type a message to send'}
            className={`p-2.5 rounded-xl transition active:scale-95 flex items-center justify-center shrink-0 ${
              inputText.trim()
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-600/40 ring-1 ring-pink-400/50 cursor-pointer'
                : 'bg-slate-800/80 text-slate-500 hover:text-pink-400 hover:bg-slate-800 border border-slate-700/60 cursor-pointer'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>

        </form>
      </div>

    </div>
  );
}
