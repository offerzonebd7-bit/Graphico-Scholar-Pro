
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
        <div key={i} className={`mb-2 md:mb-3 leading-relaxed md:leading-loose ${isBlockquote ? 'border-l-4 border-amber-500 pl-3 py-1.5 bg-amber-50/30 rounded-r-xl italic text-slate-800 my-3 shadow-sm text-sm md:text-base' : ''} ${line.includes('ধন্যবাদান্তে Graphico Global') ? 'mt-5 border-t border-slate-100 pt-3 text-emerald-800 font-bold text-[10px] md:text-xs italic' : ''}`}>
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-2xl md:text-4xl text-emerald-950 bg-white/40 px-2 md:px-3 py-0.5 md:py-1 rounded-lg mx-0.5 leading-loose inline-block border border-amber-100/30 shadow-sm my-1">
                  {part}
                </span>
              );
            }
            // Bold Text
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
    <div className={`flex w-full mb-4 md:mb-6 ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-2 md:gap-4 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-7 h-7 md:w-10 md:h-10 rounded-lg flex items-center justify-center border shadow-md ${
          isModel ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-emerald-900 border-emerald-950 text-white'
        }`}>
          {isModel ? <Library size={16} /> : <User size={16} />}
        </div>
        <div className={`p-3 md:p-6 rounded-xl md:rounded-2xl shadow-lg border ${
          isModel 
            ? 'bg-white border-slate-100 border-l-4 border-l-amber-500 rounded-tl-none text-slate-900' 
            : 'bg-emerald-900 border-emerald-950 text-white rounded-tr-none'
        }`}>
          <div className={`text-[7px] md:text-[10px] font-black mb-2 uppercase tracking-widest flex items-center gap-1 ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'Researcher'}
          </div>
          {imageUrl && (
            <div className="mb-3 rounded-lg overflow-hidden border border-white shadow-sm bg-black/5">
              <img src={imageUrl} alt="Context" className="max-w-full h-auto object-contain max-h-[250px]" />
            </div>
          )}
          <div className="text-xs md:text-lg font-medium tracking-tight whitespace-pre-wrap">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
