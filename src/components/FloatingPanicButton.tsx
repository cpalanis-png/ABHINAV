import React, { useState } from 'react';
import { ShieldAlert, PhoneCall, Users, X, ChevronUp } from 'lucide-react';
import { Contact } from '../types';

interface FloatingPanicButtonProps {
  triggerSOS: () => void;
  contacts: Contact[];
  onOpenContacts: () => void;
}

export const FloatingPanicButton: React.FC<FloatingPanicButtonProps> = ({
  triggerSOS,
  contacts,
  onOpenContacts
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end space-y-2.5">
      {/* Quick Expandable Panic Drawer */}
      {expanded && (
        <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-rose-500/80 rounded-2xl p-4 shadow-2xl w-64 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-black text-rose-300 uppercase tracking-wider">
              Quick Emergency Access
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-white p-0.5"
              aria-label="Close quick emergency drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              triggerSOS();
            }}
            className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Activate Instant SOS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              onOpenContacts();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Emergency Contacts</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                contacts.length > 0
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-700'
              }`}
            >
              {contacts.length}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href="tel:112"
              className="py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 font-black text-xs flex items-center justify-center space-x-1"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call 112</span>
            </a>
            <a
              href="tel:1091"
              className="py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-200 font-black text-xs flex items-center justify-center space-x-1"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call 1091</span>
            </a>
          </div>
        </div>
      )}

      {/* High-Visibility Floating Panic Button */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="p-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shadow-xl cursor-pointer"
          title="Quick Emergency Options & Contacts"
          aria-label="Quick Emergency Options"
        >
          <ChevronUp className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={triggerSOS}
          aria-label="Instant Panic SOS Button"
          className="group flex items-center space-x-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl shadow-rose-950/90 border-2 border-rose-300/60 active:scale-95 transition-all cursor-pointer"
        >
          <ShieldAlert className="w-5 h-5 text-white animate-pulse shrink-0" />
          <span>PANIC SOS</span>
        </button>
      </div>
    </div>
  );
};
