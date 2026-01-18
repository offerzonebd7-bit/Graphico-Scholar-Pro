
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
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+)/g;
    
    return content.split('\n').map((line, i) => {
      const parts = line.split(arabicRegex);
      return (
        <div key={i} className="mb-2 leading-relaxed">
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-2xl text-emerald-900 bg-amber-50 px-1.5 rounded mx-1 leading-loose inline-block">
                  {part}
                </span>
              );
            }
            if (part.includes('**')) {
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={k} className="font-bold text-emerald-950">{bp.slice(2, -2)}</strong>;
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
    <div className={`flex w-full mb-6 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm ${
          isModel ? 'bg-amber-100 border-amber-600' : 'bg-emerald-100 border-emerald-600'
        }`}>
          {isModel ? <Library size={20} className="text-amber-700" /> : <User size={20} className="text-emerald-700" />}
        </div>
        <div className={`p-4 rounded-2xl shadow-md ${
          isModel 
            ? 'bg-white border-l-4 border-amber-600 rounded-tl-none text-slate-900' 
            : 'bg-emerald-600 border-r-4 border-emerald-800 text-white rounded-tr-none'
        }`}>
          <div className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${isModel ? 'text-amber-700' : 'text-emerald-100'}`}>
            {isModel ? 'Graphico Scholar' : 'গবেষক'}
          </div>
          {imageUrl && (
            <div className="mb-3 rounded-lg overflow-hidden border border-emerald-200 shadow-inner bg-black/5">
              <img src={imageUrl} alt="Uploaded evidence" className="max-w-full h-auto object-cover max-h-96" />
            </div>
          )}
          <div className="text-base font-medium">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
