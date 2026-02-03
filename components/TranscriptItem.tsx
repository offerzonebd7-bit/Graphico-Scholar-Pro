
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
    
    // Arabic Detection
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]{5,})/g;
    
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed && i === content.split('\n').length - 1) return null;

      const isBlockquote = trimmed.startsWith('>');
      const processedLine = isBlockquote ? trimmed.substring(1).trim() : line;

      const parts = processedLine.split(arabicRegex);
      
      return (
        <div key={i} className={`mb-1.5 leading-relaxed ${isBlockquote ? 'border-l-2 border-amber-500 pl-2.5 py-1 bg-amber-50/20 rounded-r-md italic text-slate-800 my-1.5 text-xs md:text-sm' : ''} ${line.includes('ধন্যবাদান্তে Graphico Global') ? 'mt-3 border-t border-slate-100 pt-1.5 text-emerald-800 font-bold text-[9px] italic' : ''}`}>
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-xl md:text-2xl text-emerald-950 bg-white/40 px-1.5 py-0.5 rounded-md mx-0.5 leading-loose inline-block border border-amber-100/10 my-0.5">
                  {part}
                </span>
              );
            }
            if (part.includes('**')) {
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={k} className="font-bold text-emerald-900">{bp.slice(2, -2)}</strong>;
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
    <div className={`flex w-full mb-2.5 md:mb-4 ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in duration-300`}>
      <div className={`flex max-w-[96%] md:max-w-[85%] gap-1.5 md:gap-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-md flex items-center justify-center border shadow-sm ${
          isModel ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-emerald-900 border-emerald-950 text-white'
        }`}>
          {isModel ? <Library size={14} /> : <User size={14} />}
        </div>
        <div className={`p-2.5 md:p-4 rounded-xl shadow-md border ${
          isModel 
            ? 'bg-white border-slate-100 border-l-2 border-l-amber-500 rounded-tl-none text-slate-900' 
            : 'bg-emerald-900 border-emerald-950 text-white rounded-tr-none'
        }`}>
          <div className={`text-[6px] md:text-[8px] font-black mb-1 uppercase tracking-widest flex items-center gap-1 ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'Researcher'}
          </div>
          {imageUrl && (
            <div className="mb-1.5 rounded-md overflow-hidden border border-white shadow-sm bg-black/5">
              <img src={imageUrl} alt="Context" className="max-w-full h-auto object-contain max-h-[150px]" />
            </div>
          )}
          <div className="text-[11px] md:text-sm font-medium tracking-tight whitespace-pre-wrap">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
