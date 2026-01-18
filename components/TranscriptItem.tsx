
import React from 'react';
import { User, Library } from 'lucide-react';

interface TranscriptItemProps {
  role: 'user' | 'model';
  text: string;
}

const TranscriptItem: React.FC<TranscriptItemProps> = ({ role, text }) => {
  const isModel = role === 'model';
  
  // Basic parser for Arabic text and bolding
  const renderFormattedText = (content: string) => {
    // Regex to find Arabic script
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+)/g;
    
    return content.split('\n').map((line, i) => {
      const parts = line.split(arabicRegex);
      return (
        <p key={i} className="mb-2 leading-relaxed">
          {parts.map((part, j) => {
            if (part.match(arabicRegex)) {
              return (
                <span key={j} className="arabic text-xl text-emerald-800 bg-emerald-50 px-1 rounded mx-1 leading-loose">
                  {part}
                </span>
              );
            }
            // Simple bold rendering
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="font-bold text-emerald-900">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
          isModel ? 'bg-amber-100 border-amber-600' : 'bg-emerald-100 border-emerald-600'
        }`}>
          {isModel ? <Library size={20} className="text-amber-700" /> : <User size={20} className="text-emerald-700" />}
        </div>
        <div className={`p-4 rounded-2xl shadow-sm ${
          isModel 
            ? 'bg-white border-l-4 border-amber-600 rounded-tl-none' 
            : 'bg-emerald-50 border-r-4 border-emerald-600 text-emerald-900 rounded-tr-none'
        }`}>
          <div className="text-sm font-bold mb-1 opacity-70">
            {isModel ? 'Graphico Scholar' : 'গবেষক'}
          </div>
          <div className="text-base">
            {renderFormattedText(text)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptItem;
