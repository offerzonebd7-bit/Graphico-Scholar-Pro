
import React from 'react';
import { User, Library } from 'lucide-react';

interface TranscriptItemProps {
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
}

const TranscriptItem: React.FC<TranscriptItemProps> = ({ role, text, imageUrl }) => {
  const isModel = role === 'model';
  
  const renderFormattedText = (content: string) => {
    if (!content) return null;
    
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]{4,})/g;
    
    return content.split('\n').map((line, i) => {
      const trimmedLine = line.trim();
      if (!trimmedLine && i === content.split('\n').length - 1) return null;

      // Handle Blockquotes (>)
      const isBlockquote = trimmedLine.startsWith('>');
      const processedLine = isBlockquote ? trimmedLine.substring(1).trim() : line;

      const parts = processedLine.split(arabicRegex);
      
      return (
        <div key={i} className={`mb-4 leading-relaxed ${isBlockquote ? 'border-l-4 border-amber-400 pl-4 py-2 bg-amber-50/40 rounded-r-xl italic text-slate-800 shadow-sm' : ''} ${line.includes('ধন্যবাদান্তে Graphico Global') ? 'mt-8 border-t border-slate-100 pt-4 text-emerald-800 font-bold text-sm italic opacity-80' : ''}`}>
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-3xl text-emerald-950 bg-white/50 px-3 py-1 rounded-lg mx-1 leading-loose inline-block border border-amber-100 shadow-sm my-1">
                  {part}
                </span>
              );
            }
            // Robust Bold Formatting
            if (part.includes('**')) {
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={k} className="font-bold text-emerald-900 px-0.5">{bp.slice(2, -2)}</strong>;
                    }
                    return bp;
                });
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-8 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[96%] md:max-w-[88%] gap-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm transition-transform hover:scale-105 ${
          isModel ? 'bg-amber-50 border-amber-600' : 'bg-emerald-50 border-emerald-600'
        }`}>
          {isModel ? <Library size={20} className="text-amber-700" /> : <User size={20} className="text-emerald-700" />}
        </div>
        <div className={`p-5 rounded-2xl shadow-md border ${
          isModel 
            ? 'bg-white border-slate-200 border-l-4 border-l-amber-600 rounded-tl-none text-slate-900' 
            : 'bg-emerald-800 border-emerald-900 text-white rounded-tr-none'
        }`}>
          <div className={`text-[10px] font-bold mb-3 uppercase tracking-[0.2em] ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'Researcher'}
          </div>
          {imageUrl && (
            <div className="mb-5 rounded-xl overflow-hidden border-2 border-emerald-100/50 shadow-inner bg-black/5">
              <img src={imageUrl} alt="Context" className="max-w-full h-auto object-cover max-h-[500px]" />
            </div>
          )}
          <div className="text-base font-normal tracking-normal md:tracking-tight">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
