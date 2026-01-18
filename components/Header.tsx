
import React from 'react';
import { BookOpen, ShieldCheck } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-emerald-900 text-white p-4 shadow-lg border-b-4 border-amber-500">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-full">
            <BookOpen size={28} className="text-emerald-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Graphico Scholar</h1>
            <p className="text-xs text-amber-200 uppercase tracking-widest font-semibold flex items-center gap-1">
              Developed by Graphico Global <ShieldCheck size={12} />
            </p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <p className="text-emerald-100 italic text-sm">
            "আপনার উন্নত একাডেমিক রিসার্চ অ্যাসিস্ট্যান্ট"
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
