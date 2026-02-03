
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, MessageSquare, BookOpen, Info, Send, Loader2, ImagePlus, X, AlertTriangle } from 'lucide-react';
import Header from './components/Header';
import TranscriptItem from './components/TranscriptItem';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Message } from './types';

// Safe environment variable check
const SAFE_API_KEY = typeof process !== 'undefined' ? process.env.API_KEY : undefined;

const SYSTEM_INSTRUCTION = `
আপনার নাম "গ্রাফিকো স্কলার", যা "গ্রাফিকো গ্লোবাল"-এর একটি বিশেষ শিক্ষা ও গবেষণা এআই। আপনার লক্ষ্য হলো একজন গম্ভীর ও দক্ষ গবেষকের মতো তথ্য প্রদান করা।

একাডেমিক মাস্টারী ও ফরমেটিং নির্দেশনাবলী:
১. ব্যক্তিত্ব: আপনার উত্তরের ধরন হবে একজন বিজ্ঞ গবেষকের মতো—গম্ভীর, তথ্যবহুল এবং অত্যন্ত গোছানো। অপ্রয়োজনীয় ভূমিকা বা আবেগ বর্জন করুন।
২. আরবি ও অনুবাদ: যখনই কোনো আয়াত, হাদিস বা আরবি শব্দ লিখবেন, তা অবশ্যই মূল আরবি হরফে লিখবেন। এরপর সেটির বাংলা অনুবাদ এবং একাডেমিক ব্যাখ্যা দেবেন।
৩. প্রফেশনাল ফরমেটিং: 
   - উত্তরের ভেতর কোনো হ্যাশট্যাগ (#) ব্যবহার করবেন না। 
   - গুরুত্বপূর্ণ অংশগুলোকে বোল্ড (**text**) করুন। 
   - বিশেষ উদ্ধৃতি বা মূল পয়েন্টের জন্য ব্লককোট (> text) ব্যবহার করুন।
৪. সীমাবদ্ধতা: শুধুমাত্র একাডেমিক ও শিক্ষা সংক্রান্ত বিষয়ে সহায়তা করুন। অনৈতিক কিছু জিজ্ঞেস করলে বলবেন: "গ্রাফিকো গ্লোবাল শুধুমাত্র জ্ঞান ও শিক্ষা সংক্রান্ত কাজে আপনাকে সহায়তা করে।"
৫. ইতি টানা: প্রতিটি উত্তরের একদম শেষে একটি নতুন লাইনে লিখুন: "ধন্যবাদান্তে Graphico Global"।
`;

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'model',
      text: "আসসালামু আলাইকুম! গ্রাফিকো গ্লোবাল-এ আপনাকে স্বাগতম। আপনার শিক্ষা বা গবেষণা সংক্রান্ত যেকোনো বিষয়ে আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
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

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTo({
        top: transcriptScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, currentInput, currentOutput, isSendingText]);

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
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleStart = async () => {
    if (!SAFE_API_KEY) {
      setError("এপিআই কি (API Key) পাওয়া যায়নি।");
      return;
    }
    try {
      setIsConnecting(true);
      setError(null);
      const ai = new GoogleGenAI({ apiKey: SAFE_API_KEY });
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
            if (message.serverContent?.turnComplete) {
              setMessages(prev => [
                ...prev,
                { id: `u-${Date.now()}`, role: 'user', text: "(ভয়েস মেসেজ)", timestamp: Date.now() },
                { id: `m-${Date.now()}`, role: 'model', text: "স্কলার উত্তর দিচ্ছেন...", timestamp: Date.now() }
              ]);
            }
          },
          onerror: (e) => { setError("সেশন ত্রুটি। পুনরায় শুরু করুন।"); handleStop(); },
          onclose: () => setIsActive(false)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError("মাইক্রোফোন সংযোগে ব্যর্থ।");
      setIsConnecting(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !selectedImage) || isSendingText || !SAFE_API_KEY) return;

    const userMessage = textInput.trim() || (selectedImage ? "এই ছবিটি বিশ্লেষণ করুন।" : "");
    const imgData = selectedImage;
    const imgMime = imageMimeType;
    
    setTextInput('');
    setSelectedImage(null);
    setIsSendingText(true);
    setError(null);

    setMessages(prev => [...prev, { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      text: userMessage, 
      imageUrl: imgData ? `data:${imgMime};base64,${imgData}` : undefined,
      timestamp: Date.now() 
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: SAFE_API_KEY });
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const parts: any[] = [{ text: userMessage }];
      if (imgData) parts.push({ inlineData: { data: imgData, mimeType: imgMime } });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...history, { role: 'user', parts }],
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });

      const modelText = response.text || "দুঃখিত, কোনো উত্তর পাওয়া যায়নি।";
      setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', text: modelText, timestamp: Date.now() }]);
    } catch (err) {
      setError("বার্তা পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setIsSendingText(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfaf5]">
      {!SAFE_API_KEY && (
        <div className="fixed inset-0 bg-white/95 z-[999] flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle size={64} className="text-amber-600 mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold text-emerald-900 mb-2">এপিআই কি অনুপস্থিত</h1>
          <p className="text-slate-600 max-w-sm">Graphico Scholar ব্যবহারের জন্য একটি বৈধ এপিআই কি প্রয়োজন।</p>
        </div>
      )}

      <Header />
      
      <main className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-4 overflow-hidden relative">
        {/* Sidebar Info */}
        <aside className="hidden lg:flex w-72 flex-col gap-4">
          <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
              <BookOpen size={18} /> গবেষক প্যানেল
            </h3>
            <p className="text-sm text-emerald-100 leading-relaxed">
              আমি আপনার প্রতিটি প্রশ্নের গবেষণালব্ধ উত্তর দিতে প্রস্তুত। তথ্য ও দলীলভিত্তিক আলোচনার জন্য আপনার প্রশ্নটি পেশ করুন।
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex-grow">
            <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2 text-sm">
              <Info size={16} /> সিস্টেম স্ট্যাটাস
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">মডেল স্পিড:</span>
                <span className="text-emerald-600 font-bold uppercase tracking-wider">Flash (Max)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">ভয়েস সেশন:</span>
                <span className={`font-bold ${isActive ? 'text-green-500' : 'text-slate-400'}`}>
                  {isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Interaction Area */}
        <section className="flex-grow flex flex-col bg-white rounded-[2rem] shadow-2xl border border-emerald-50 overflow-hidden">
          <div ref={transcriptScrollRef} className="flex-grow overflow-y-auto p-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]">
            {messages.map((m) => (
              <TranscriptItem key={m.id} role={m.role} text={m.text} imageUrl={m.imageUrl} />
            ))}
            {isSendingText && (
              <div className="flex justify-start mb-6">
                <div className="bg-white p-4 rounded-2xl border-l-4 border-amber-600 shadow-sm flex items-center gap-3">
                  <Loader2 className="animate-spin text-amber-600" size={18} />
                  <span className="text-slate-800 italic text-sm font-medium">স্কলার বিশ্লেষণ করছেন...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-emerald-50/50 flex flex-col gap-4">
            {selectedImage && (
              <div className="relative w-28 h-28 ml-2 rounded-2xl border-4 border-white shadow-xl overflow-hidden group">
                <img src={`data:${imageMimeType};base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <form onSubmit={handleSendText} className="flex gap-2 bg-white p-2 rounded-2xl shadow-lg border border-emerald-100 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isActive || isSendingText}
                  className="text-emerald-700 hover:bg-emerald-50 p-3 rounded-xl transition-all disabled:opacity-30"
                >
                  <ImagePlus size={24} />
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
                  placeholder="আপনার গবেষণার প্রশ্নটি এখানে পেশ করুন..."
                  disabled={isActive || isSendingText}
                  className="flex-grow px-3 py-3 outline-none text-emerald-950 font-medium placeholder:text-slate-400 bg-transparent"
                />
                <button
                  type="submit"
                  disabled={(!textInput.trim() && !selectedImage) || isActive || isSendingText}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white p-4 rounded-xl transition-all disabled:bg-slate-300 shadow-md"
                >
                  <Send size={20} />
                </button>
              </form>

              <div className="flex items-center justify-between px-2">
                <button
                  onClick={isActive ? handleStop : handleStart}
                  disabled={isConnecting || isSendingText}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-lg transition-all transform active:scale-95 ${isActive ? 'bg-red-600 text-white ring-4 ring-red-100' : 'bg-emerald-800 text-white ring-4 ring-emerald-50'}`}
                >
                  {isActive ? <MicOff size={20} /> : <Mic size={20} />}
                  <span className="text-sm font-bold uppercase tracking-widest">
                    {isActive ? 'ভয়েস বন্ধ' : 'ভয়েস মোড'}
                  </span>
                </button>
                <div className="text-[10px] text-emerald-800/60 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-ping' : 'bg-slate-300'}`}></div>
                  Scholar AI v4.0 Stable
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold text-center flex items-center justify-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="p-3 text-center text-[10px] text-emerald-900/40 font-bold uppercase tracking-[0.4em]">
        © {new Date().getFullYear()} Graphico Global - Academic Excellence
      </footer>
    </div>
  );
};

export default App;
