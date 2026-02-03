
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
    
    // Improved Arabic detection with minimum character length for stability
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]{4,})/g;
    
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed && i === content.split('\n').length - 1) return null;

      const isBlockquote = trimmed.startsWith('>');
      const processedLine = isBlockquote ? trimmed.substring(1).trim() : line;

      const parts = processedLine.split(arabicRegex);
      
      return (
        <div key={i} className={`mb-4 leading-relaxed ${isBlockquote ? 'border-l-4 border-amber-500 pl-5 py-3 bg-amber-50/50 rounded-r-2xl italic text-slate-800 shadow-sm my-4' : ''} ${line.includes('ধন্যবাদান্তে Graphico Global') ? 'mt-8 border-t border-slate-100 pt-5 text-emerald-800 font-bold text-sm italic' : ''}`}>
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-4xl text-emerald-950 bg-amber-50/30 px-4 py-2 rounded-xl mx-1 leading-loose inline-block border border-amber-100/50 shadow-sm my-2 select-none">
                  {part}
                </span>
              );
            }
            // Bold Text Processing
            if (part.includes('**')) {
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={k} className="font-bold text-emerald-900 border-b-2 border-amber-200/50 pb-0.5">{bp.slice(2, -2)}</strong>;
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
    <div className={`flex w-full mb-10 ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[98%] md:max-w-[85%] gap-4 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border-2 shadow-lg ${
          isModel ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-emerald-900 border-emerald-950 text-white'
        }`}>
          {isModel ? <Library size={22} /> : <User size={22} />}
        </div>
        <div className={`p-6 rounded-[1.5rem] shadow-xl border ${
          isModel 
            ? 'bg-white border-slate-100 border-l-8 border-l-amber-500 rounded-tl-none text-slate-900' 
            : 'bg-emerald-900 border-emerald-950 text-white rounded-tr-none'
        }`}>
          <div className={`text-[10px] font-black mb-4 uppercase tracking-[0.3em] flex items-center gap-2 ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'Academic Researcher'}
          </div>
          {imageUrl && (
            <div className="mb-6 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-black/10">
              <img src={imageUrl} alt="Reference Context" className="max-w-full h-auto object-contain max-h-[400px]" />
            </div>
          )}
          <div className="text-base md:text-lg font-medium tracking-tight whitespace-pre-wrap">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
