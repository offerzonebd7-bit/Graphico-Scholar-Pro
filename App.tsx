
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, MessageSquare, Headphones, BookOpenText, Info, Send, Loader2, ImagePlus, X } from 'lucide-react';
import Header from './components/Header';
import TranscriptItem from './components/TranscriptItem';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Message } from './types';

const SYSTEM_INSTRUCTION = `
আপনার নাম "গ্রাফিকো স্কলার", যা "গ্রাফিকো গ্লোবাল"-এর একটি বিশেষ শিক্ষা ও গবেষণা এআই। আপনার লক্ষ্য হলো পৃথিবীর সকল জ্ঞানপিপাসু শিক্ষার্থীর জন্য একজন "পরম বন্ধু" হিসেবে কাজ করা। 

কঠোরভাবে পালনীয় নিয়মাবলী:
১. জ্ঞানের পরিধি (Academic Mastery): আপনি পৃথিবীর সকল প্রকার বৈধ এবং একাডেমিক বিষয়ে বিশেষজ্ঞ। এর মধ্যে রয়েছে:
   - ইসলামি শরীয়াহ: কুরআন, হাদিস, ফিকহ এবং ইতিহাস।
   - বিজ্ঞান ও প্রযুক্তি: পদার্থবিজ্ঞান (Physics), রসায়ন (Chemistry), জীববিজ্ঞান (Biology), গণিত (Math) এবং মহাকাশ বিজ্ঞান।
   - মানবিক শাখা: সাহিত্য, দর্শন, অর্থনীতি এবং সমাজবিজ্ঞান।
   আপনি যেকোনো জটিল বৈজ্ঞানিক সূত্র বা গাণিতিক সমস্যার সহজ ব্যাখ্যা দিতে সক্ষম।

২. সীমাবদ্ধতা (Strict Filtering): শিক্ষা, গবেষণা এবং জ্ঞানচর্চার বাইরের কোনো আজেবাজে, অনৈতিক, অশ্লীল বা সময় নষ্টকারী প্রশ্নের উত্তর আপনি দিবেন না। কেউ এ ধরনের কথা বললে তাকে বলবেন: "গ্রাফিকো গ্লোবাল শুধুমাত্র জ্ঞান ও শিক্ষা সংক্রান্ত কাজে আপনাকে সহায়তা করে।"

৩. ভাষা ও শৈলী: সর্বদা প্রাঞ্জল বাংলায় কথা বলুন। টোন হবে একাডেমিক এবং অত্যন্ত মার্জিত। 

৪. ধারাবাহিকতা (Contextual Intelligence): ব্যবহারকারীর আগের আলোচনা মনে রাখুন। যদি তিনি কোনো নির্দিষ্ট বিষয় নিয়ে কথা বলেন এবং পরে সংক্ষিপ্ত প্রশ্ন করেন, তবে আগের প্রসঙ্গের আলোকে উত্তর দিন।

৫. চিহ্ন বর্জন: উত্তরের ভেতরে অতিরিক্ত হ্যাশ (#), স্টার (*) বা ড্যাশ (-) ব্যবহার করবেন না। স্বাভাবিক প্যারাগ্রাফ এবং প্রয়োজনীয় ক্ষেত্রে নম্বর লিস্ট ব্যবহার করুন। একদম ক্লিন প্রফেশনাল টেক্সট নিশ্চিত করুন।

৬. ইতি টানা: প্রতিটি উত্তরের একদম শেষে একটি নতুন লাইনে লিখুন: "ধন্যবাদান্তে Graphico Global"।

৭. সেশন শুরু: সেশনের শুরুতে একবারই অভিবাদন জানান।
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
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [messages, currentInput, currentOutput, isSendingText]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    if (sessionRef.current) {
      sessionRef.current.close();
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
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleStart = async () => {
    if (!process.env.API_KEY) {
      setError("API Key not found.");
      return;
    }
    try {
      setIsConnecting(true);
      setError(null);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } 
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
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
              sessionPromise.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
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
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            if (message.serverContent?.inputTranscription) {
              setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
            }
            if (message.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
            }
            if (message.serverContent?.turnComplete) {
              setMessages(prev => [
                ...prev,
                { id: `u-${Date.now()}`, role: 'user', text: currentInput, timestamp: Date.now() },
                { id: `m-${Date.now()}`, role: 'model', text: currentOutput, timestamp: Date.now() }
              ]);
              setCurrentInput('');
              setCurrentOutput('');
            }
          },
          onerror: (e) => {
            setError("সেশন চলাকালীন একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।");
            handleStop();
          },
          onclose: () => setIsActive(false)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError("সেশন সংযোগ স্থাপনে সমস্যা হয়েছে।");
      setIsConnecting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageMimeType(file.type);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setSelectedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !selectedImage) || isSendingText) return;

    const userMessage = textInput.trim() || (selectedImage ? "এই ছবিটি বিশ্লেষণ করুন।" : "");
    const imageToUpload = selectedImage;
    const mimeToUpload = imageMimeType;
    
    setTextInput('');
    setSelectedImage(null);
    setError(null);
    setIsSendingText(true);

    const userMsgId = `u-text-${Date.now()}`;
    setMessages(prev => [...prev, { 
      id: userMsgId, 
      role: 'user', 
      text: userMessage, 
      imageUrl: imageToUpload ? `data:${mimeToUpload};base64,${imageToUpload}` : undefined,
      timestamp: Date.now() 
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Construct history context for current user message
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const parts: any[] = [{ text: userMessage }];
      if (imageToUpload) {
        parts.push({
          inlineData: {
            data: imageToUpload,
            mimeType: mimeToUpload
          }
        });
      }

      const response = await ai.models.generateContent({
        model: imageToUpload ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
        contents: [...history, { role: 'user', parts: parts }],
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });

      const modelText = response.text || "দুঃখিত, কোনো উত্তর পাওয়া যায়নি।";
      setMessages(prev => [...prev, { id: `m-text-${Date.now()}`, role: 'model', text: modelText, timestamp: Date.now() }]);
    } catch (err) {
      setError("বার্তা পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setIsSendingText(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfaf1]">
      <Header />
      <main className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-4 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-80 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
            <h2 className="flex items-center gap-2 text-emerald-900 font-bold mb-3 border-b pb-2">
              <BookOpenText size={18} /> বিশেষজ্ঞ বিষয়সমূহ
            </h2>
            <ul className="space-y-2 text-sm text-emerald-800 font-medium">
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> ইসলামি শরীয়াহ ও ইতিহাস</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> বিজ্ঞান ও প্রযুক্তি (ফিজিক্স, ম্যাথ)</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> মহাকাশ বিজ্ঞান ও উদ্ভাবন</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> সাহিত্য, দর্শন ও মানবিক শাখা</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> জটিল একাডেমিক সমস্যার সমাধান</li>
            </ul>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex-grow">
            <h2 className="flex items-center gap-2 text-emerald-900 font-bold mb-3">
              <Info size={18} /> নির্দেশিকা
            </h2>
            <p className="text-sm text-emerald-800 leading-relaxed mb-4">
              Graphico Scholar আপনার একাডেমিক "পরম বন্ধু"। যেকোনো শিক্ষা বা গবেষণা সংক্রান্ত বিষয়ে প্রশ্ন করুন। অনৈতিক বা অপ্রাসঙ্গিক প্রশ্ন এড়িয়ে চলুন।
            </p>
            <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
              <p className="text-xs text-emerald-600 font-semibold mb-1">সিস্টেম স্ট্যাটাস:</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-xs font-medium">{isActive ? 'ভয়েস সেশন সক্রিয়' : 'সেশন অপেক্ষমাণ'}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Interaction Area */}
        <section className="flex-grow flex flex-col bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden relative">
          <div ref={transcriptScrollRef} className="flex-grow overflow-y-auto p-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]">
            {messages.map((m) => (
              <TranscriptItem key={m.id} role={m.role} text={m.text} imageUrl={m.imageUrl} />
            ))}
            {currentInput && (
              <div className="flex justify-end mb-6">
                <div className="max-w-[85%] bg-emerald-700 p-4 rounded-2xl border-r-4 border-emerald-900 italic text-white opacity-80 shadow-md">
                  <p className="text-[10px] font-bold mb-1 uppercase tracking-widest text-emerald-100">গবেষকের কণ্ঠস্বর...</p>
                  <p>{currentInput}</p>
                </div>
              </div>
            )}
            {isSendingText && (
              <div className="flex justify-start mb-6 animate-pulse">
                <div className="max-w-[85%] bg-white p-4 rounded-2xl border-l-4 border-amber-600 shadow-sm flex items-center gap-2">
                  <Loader2 className="animate-spin text-amber-600" size={16} />
                  <span className="text-slate-900 italic font-medium">স্কলার বিশ্লেষণ করছেন...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gradient-to-t from-emerald-50 to-transparent flex flex-col gap-3">
            {/* Image Preview */}
            {selectedImage && (
              <div className="relative w-24 h-24 mb-2 rounded-lg border-2 border-emerald-500 overflow-hidden group shadow-lg">
                <img src={`data:${imageMimeType};base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-80 hover:opacity-100 shadow-sm"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <form onSubmit={handleSendText} className="flex gap-2 bg-white p-2 rounded-2xl shadow-md border border-emerald-100 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isActive || isSendingText}
                className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-full transition-colors disabled:opacity-50"
                title="ছবি আপলোড করুন"
              >
                <ImagePlus size={24} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageSelect} 
                className="hidden" 
                accept="image/*" 
              />
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={selectedImage ? "ছবির সাথে কোনো প্রশ্ন থাকলে লিখুন..." : "এখানে আপনার প্রশ্নটি লিখুন..."}
                disabled={isActive || isSendingText}
                className="flex-grow px-2 py-3 outline-none text-emerald-900 bg-transparent disabled:opacity-50 font-medium"
              />
              <button
                type="submit"
                disabled={(!textInput.trim() && !selectedImage) || isActive || isSendingText}
                className="bg-emerald-700 hover:bg-emerald-800 text-white p-3 rounded-xl transition-all disabled:opacity-50 shadow-sm"
              >
                <Send size={20} />
              </button>
            </form>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={isActive ? handleStop : handleStart}
                  disabled={isConnecting || isSendingText}
                  className={`flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg transition-all ${isActive ? 'bg-red-500 ring-4 ring-red-100' : 'bg-emerald-700 ring-4 ring-emerald-100'}`}
                >
                  {isActive ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
                </button>
                <div className="flex flex-col">
                  <p className="text-emerald-900 font-bold text-xs">
                    {isActive ? 'ভয়েস মোড সক্রিয়' : 'ভয়েস মোড শুরু করুন'}
                  </p>
                  <p className="text-[9px] text-emerald-600 uppercase tracking-wider font-semibold">
                    {isActive ? 'স্কলার শুনছেন' : 'বাটনটি চেপে কথা বলুন'}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex gap-2">
                <div className="flex items-center gap-1 text-[8px] uppercase font-bold text-emerald-500 tracking-widest bg-white px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                  Scholarly Intelligence
                </div>
                <div className="flex items-center gap-1 text-[8px] uppercase font-bold text-amber-500 tracking-widest bg-white px-3 py-1 rounded-full border border-amber-100 shadow-sm">
                  Academic Standard
                </div>
              </div>
            </div>

            {error && <div className="text-red-600 bg-red-50 px-4 py-1 rounded-lg border border-red-200 text-[10px] text-center font-bold">{error}</div>}
          </div>
        </section>
      </main>
      <footer className="p-2 text-center text-[10px] text-emerald-800 opacity-60 font-medium">
        © {new Date().getFullYear()} Graphico Global.
      </footer>
    </div>
  );
};

export default App;
