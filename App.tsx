
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, BookOpen, Send, Loader2, ImagePlus, X, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import TranscriptItem from './components/TranscriptItem';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Message } from './types';

const SYSTEM_INSTRUCTION = `
আপনার নাম "গ্রাফিকো স্কলার", "গ্রাফিকো গ্লোবাল"-এর একটি প্রফেশনাল একাডেমিক এআই। 
ব্যক্তিত্ব: বিজ্ঞ ও গম্ভীর গবেষক।
নির্দেশনা:
১. ফরমেটিং: কোনো হ্যাশট্যাগ (#) ব্যবহার করবেন না। গুরুত্বপূর্ণ তথ্য **বোল্ড** করুন এবং দলীল > ব্লককোট আকারে লিখুন।
২. আরবি: প্রতিটি আরবি আয়াত বা হাদিস বড় করে লিখুন, তারপর অনুবাদ ও ব্যাখ্যা দিন।
৩. প্রাসঙ্গিকতা: শুধুমাত্র শিক্ষা ও গবেষণা নিয়ে আলোচনা করুন।
৪. ইতি টানা: উত্তরের শেষে লিখুন: "ধন্যবাদান্তে Graphico Global"।
`;

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'model',
      text: "আসসালামু আলাইকুম। আমি গ্রাফিকো স্কলার। আজ আপনাকে কীভাবে সহায়তা করতে পারি?",
      timestamp: Date.now()
    }
  ]);
  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [messages, isSendingText]);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} sessionRef.current = null; }
    if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
    if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
    stopAllAudio();
  }, [stopAllAudio]);

  const handleStart = async () => {
    const apiKey = process?.env?.API_KEY;
    if (!apiKey) {
      setError("API Key configuration error.");
      return;
    }
    try {
      setIsConnecting(true);
      setError(null);
      const ai = new GoogleGenAI({ apiKey });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(s => s?.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const audioCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), audioCtx, 24000, 1);
              const source = audioCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(audioCtx.destination);
              source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => { setError("Connection lost."); handleStop(); },
          onclose: () => setIsActive(false)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError("Microphone permission denied.");
      setIsConnecting(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const apiKey = process?.env?.API_KEY;
    if ((!textInput.trim() && !selectedImage) || isSendingText || !apiKey) return;

    const userMsg = textInput.trim() || (selectedImage ? "Analyze this image." : "");
    const imgData = selectedImage;
    const imgMime = imageMimeType;
    
    setTextInput('');
    setSelectedImage(null);
    setIsSendingText(true);
    setError(null);

    setMessages(prev => [...prev, { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      text: userMsg, 
      imageUrl: imgData ? `data:${imgMime};base64,${imgData}` : undefined,
      timestamp: Date.now() 
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages.slice(-4).map(m => ({ role: m.role, parts: [{ text: m.text }] })), 
                  { role: 'user', parts: imgData ? [{ text: userMsg }, { inlineData: { data: imgData, mimeType: imgMime } }] : [{ text: userMsg }] }],
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
      setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', text: response.text || "No response.", timestamp: Date.now() }]);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSendingText(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#fdfaf5] overflow-hidden overscroll-none">
      <Header />
      
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden p-2 md:p-4 gap-4">
        {/* Chat Container */}
        <section className="flex-1 flex flex-col bg-white rounded-2xl shadow-xl border border-emerald-50 overflow-hidden relative">
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 custom-scrollbar bg-[#fafafa]">
            {messages.map((m) => (
              <TranscriptItem key={m.id} role={m.role} text={m.text} imageUrl={m.imageUrl} />
            ))}
            {isSendingText && (
              <div className="flex justify-start mb-4">
                <div className="bg-amber-50 p-2 px-4 rounded-full border border-amber-200 shadow-sm flex items-center gap-2">
                  <Loader2 className="animate-spin text-amber-600" size={14} />
                  <span className="text-slate-700 italic text-[10px] md:text-xs font-bold uppercase tracking-wider">Scholar Processing...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-2 md:p-4 bg-emerald-50/20 border-t border-emerald-100">
            <div className="flex flex-col gap-2 max-w-3xl mx-auto">
              {selectedImage && (
                <div className="relative w-14 h-14 rounded-lg border border-emerald-400 shadow-sm overflow-hidden ring-2 ring-white">
                  <img src={`data:${imageMimeType};base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={() => setSelectedImage(null)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg">
                    <X size={10} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendText} className="flex gap-1.5 bg-white p-1 rounded-xl shadow-sm border border-emerald-100 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isActive || isSendingText}
                  className="text-emerald-700 p-2 hover:bg-emerald-50 disabled:opacity-30"
                >
                  <ImagePlus size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageMimeType(file.type);
                      const reader = new FileReader();
                      reader.onload = (ev) => setSelectedImage((ev.target?.result as string).split(',')[1]);
                      reader.readAsDataURL(file);
                    }
                  }} 
                  className="hidden" 
                  accept="image/*" 
                />
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="আপনার জিজ্ঞাসা..."
                  disabled={isActive || isSendingText}
                  className="flex-1 px-1 py-2 outline-none text-emerald-950 font-medium text-sm md:text-base bg-transparent"
                />
                <button
                  type="submit"
                  disabled={(!textInput.trim() && !selectedImage) || isActive || isSendingText}
                  className="bg-emerald-800 text-white p-2.5 rounded-lg hover:bg-emerald-900 disabled:bg-slate-300 transition-all"
                >
                  <Send size={16} />
                </button>
              </form>

              <div className="flex items-center justify-between px-1">
                <button
                  onClick={isActive ? handleStop : handleStart}
                  disabled={isConnecting || isSendingText}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md transition-all active:scale-95 ${isActive ? 'bg-red-600 text-white' : 'bg-emerald-800 text-white'}`}
                >
                  {isActive ? <MicOff size={14} /> : <Mic size={14} />}
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isActive ? 'OFF VOICE' : 'VOICE MODE'}
                  </span>
                </button>
                <div className="text-[8px] text-emerald-900/40 font-bold uppercase tracking-widest flex items-center gap-1">
                  <BookOpen size={10} /> v5.2 STABLE
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-1.5 p-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold text-center border border-red-100">
                <AlertCircle size={10} className="inline mr-1" /> {error}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
