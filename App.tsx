
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, BookOpen, Info, Send, Loader2, ImagePlus, X, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import TranscriptItem from './components/TranscriptItem';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Message } from './types';

// Safety Guard: Vercel-এ process.env এর কারণে ক্র্যাশ হওয়া বন্ধ করতে এই অংশটি জরুরি।
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: { API_KEY: '' } };
}

const SYSTEM_INSTRUCTION = `
আপনার নাম "গ্রাফিকো স্কলার", যা "গ্রাফিকো গ্লোবাল"-এর একটি প্রফেশনাল একাডেমিক এআই। 
আপনার ব্যক্তিত্ব হবে একজন অত্যন্ত বিজ্ঞ ও গম্ভীর গবেষকের (Academic Researcher) মতো।

নির্দেশনাবলী:
১. ফরমেটিং: কোনো হ্যাশট্যাগ (#) ব্যবহার করবেন না। গুরুত্বপূর্ণ তথ্য **বোল্ড** করুন এবং বিশেষ উদ্ধৃতি বা দলীল > ব্লককোট আকারে লিখুন।
২. আরবি: প্রতিটি আরবি আয়াত বা হাদিস মূল আরবি স্ক্রিপ্টে বড় করে লিখুন, তারপর বাংলা অনুবাদ ও একাডেমিক ব্যাখ্যা দিন।
৩. প্রাসঙ্গিকতা: শুধুমাত্র শিক্ষা, গবেষণা, বিজ্ঞান এবং ধ্রুপদী জ্ঞান (Classical Sciences) নিয়ে আলোচনা করুন। অপ্রাসঙ্গিক কথায় সময় নষ্ট করবেন না।
৪. দ্রুততা: সংক্ষিপ্ত কিন্তু সারগর্ভ উত্তর দিন।
৫. সমাপ্তি: উত্তরের শেষে নতুন লাইনে লিখুন: "ধন্যবাদান্তে Graphico Global"।
`;

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'model',
      text: "আসসালামু আলাইকুম। আমি গ্রাফিকো স্কলার। আপনার গবেষণা বা শিক্ষা সংক্রান্ত যেকোনো জিজ্ঞাসা পেশ করতে পারেন।",
      timestamp: Date.now()
    }
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
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

  // এপিআই কি পাওয়ার নিরাপদ উপায়
  const API_KEY = process.env.API_KEY;

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTo({
        top: transcriptScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, currentInput, currentOutput, isSendingText]);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    stopAllAudio();
  }, [stopAllAudio]);

  const handleStart = async () => {
    if (!API_KEY) {
      setError("API Key কনফিগার করা হয়নি।");
      return;
    }
    try {
      setIsConnecting(true);
      setError(null);
      const ai = new GoogleGenAI({ apiKey: API_KEY });
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
            if (message.serverContent?.interrupted) stopAllAudio();
          },
          onerror: () => { setError("ভয়েস সেশনে সমস্যা হয়েছে।"); handleStop(); },
          onclose: () => setIsActive(false)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError("মাইক্রোফোন পারমিশন চেক করুন।");
      setIsConnecting(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !selectedImage) || isSendingText || !API_KEY) return;

    const userMsg = textInput.trim() || (selectedImage ? "এই ছবিটি বিশ্লেষণ করুন।" : "");
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
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages.slice(-6).map(m => ({ role: m.role, parts: [{ text: m.text }] })), 
                  { role: 'user', parts: imgData ? [{ text: userMsg }, { inlineData: { data: imgData, mimeType: imgMime } }] : [{ text: userMsg }] }],
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
      setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', text: response.text || "উত্তর পাওয়া যায়নি।", timestamp: Date.now() }]);
    } catch (err) {
      setError("নেটওয়ার্ক সমস্যা। পুনরায় চেষ্টা করুন।");
    } finally {
      setIsSendingText(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#fdfaf5] overflow-hidden">
      <Header />
      
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden p-1.5 md:p-4 gap-2 md:gap-4">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 flex-col gap-4">
          <div className="bg-emerald-900 text-white p-5 rounded-3xl shadow-lg border-b-4 border-amber-500">
            <h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
              <BookOpen size={18} /> গবেষণার ক্ষেত্র
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed">
              আমি আপনার একাডেমিক রিসার্চ অ্যাসিস্ট্যান্ট। দলীলভিত্তিক আলোচনার জন্য আপনার প্রশ্নটি পেশ করুন।
            </p>
          </div>
        </aside>

        {/* Chat Area - Mobile Optimized */}
        <section className="flex-1 flex flex-col bg-white rounded-xl md:rounded-[2rem] shadow-xl border border-emerald-50 overflow-hidden">
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] overscroll-contain">
            {messages.map((m) => (
              <TranscriptItem key={m.id} role={m.role} text={m.text} imageUrl={m.imageUrl} />
            ))}
            {isSendingText && (
              <div className="flex justify-start mb-4">
                <div className="bg-white p-3 rounded-2xl border-l-4 border-amber-500 shadow-sm flex items-center gap-2">
                  <Loader2 className="animate-spin text-amber-600" size={16} />
                  <span className="text-slate-700 italic text-xs font-bold">স্কলার বিশ্লেষণ করছেন...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-2 md:p-4 bg-emerald-50/30 border-t border-emerald-100">
            <div className="flex flex-col gap-2 max-w-4xl mx-auto">
              {selectedImage && (
                <div className="relative w-16 h-16 rounded-lg border border-emerald-500 shadow-md overflow-hidden">
                  <img src={`data:${imageMimeType};base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={() => setSelectedImage(null)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg shadow-md">
                    <X size={10} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendText} className="flex gap-1.5 bg-white p-1 rounded-xl shadow-md border border-emerald-100 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isActive || isSendingText}
                  className="text-emerald-700 p-2 md:p-3 hover:bg-emerald-50 disabled:opacity-30 transition-colors"
                >
                  <ImagePlus size={20} />
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
                  placeholder="আপনার প্রশ্নটি এখানে লিখুন..."
                  disabled={isActive || isSendingText}
                  className="flex-1 px-1 py-2 outline-none text-emerald-950 font-medium text-sm md:text-base bg-transparent"
                />
                <button
                  type="submit"
                  disabled={(!textInput.trim() && !selectedImage) || isActive || isSendingText}
                  className="bg-emerald-800 text-white p-2.5 md:p-3 rounded-lg hover:bg-emerald-900 disabled:bg-slate-300 transition-all shadow-md"
                >
                  <Send size={16} />
                </button>
              </form>

              <div className="flex items-center justify-between px-1">
                <button
                  onClick={isActive ? handleStop : handleStart}
                  disabled={isConnecting || isSendingText}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full shadow-lg transition-all active:scale-95 ${isActive ? 'bg-red-600 text-white' : 'bg-emerald-800 text-white'}`}
                >
                  {isActive ? <MicOff size={16} /> : <Mic size={16} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isActive ? 'ভয়েস বন্ধ' : 'ভয়েস মোড'}
                  </span>
                </button>
                <div className="text-[8px] text-emerald-900/40 font-bold uppercase tracking-widest">
                  Graphico Scholar v5.1
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-1.5 p-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold text-center border border-red-100 flex items-center justify-center gap-1">
                <AlertCircle size={10} /> {error}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
