
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
        <div key={i} className={`mb-3 leading-relaxed md:leading-loose ${isBlockquote ? 'border-l-4 border-amber-500 pl-4 py-2 bg-amber-50/30 rounded-r-xl italic text-slate-800 my-4 shadow-sm' : ''} ${line.includes('ধন্যবাদান্তে Graphico Global') ? 'mt-6 border-t border-slate-100 pt-4 text-emerald-800 font-bold text-xs italic' : ''}`}>
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-3xl md:text-4xl text-emerald-950 bg-white/40 px-3 py-1 rounded-lg mx-1 leading-loose inline-block border border-amber-100/30 shadow-sm my-1">
                  {part}
                </span>
              );
            }
            // Bold Text
            if (part.includes('**')) {
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={k} className="font-bold text-emerald-900 bg-amber-50/50 px-1 rounded">{bp.slice(2, -2)}</strong>;
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
    <div className={`flex w-full mb-6 ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[92%] md:max-w-[85%] gap-2 md:gap-4 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center border shadow-md ${
          isModel ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-emerald-900 border-emerald-950 text-white'
        }`}>
          {isModel ? <Library size={18} /> : <User size={18} />}
        </div>
        <div className={`p-4 md:p-6 rounded-2xl shadow-lg border ${
          isModel 
            ? 'bg-white border-slate-100 border-l-4 md:border-l-8 border-l-amber-500 rounded-tl-none text-slate-900' 
            : 'bg-emerald-900 border-emerald-950 text-white rounded-tr-none'
        }`}>
          <div className={`text-[8px] md:text-[10px] font-black mb-3 uppercase tracking-[0.2em] flex items-center gap-2 ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'Researcher'}
          </div>
          {imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border-2 border-white shadow-md bg-black/5">
              <img src={imageUrl} alt="Reference" className="max-w-full h-auto object-contain max-h-[300px]" />
            </div>
          )}
          <div className="text-sm md:text-lg font-medium tracking-tight whitespace-pre-wrap">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
