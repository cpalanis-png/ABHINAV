import React from 'react';
import { LayoutDashboard, Shield, Compass, HeartPulse, MessageSquare, Newspaper, Brain } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pregnancyActive: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  pregnancyActive
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 border-t border-slate-800 backdrop-blur-lg px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'safety' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span>Safety</span>
        </button>

        <button
          onClick={() => setActiveTab('wellness')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors relative ${
            activeTab === 'wellness' ? 'text-pink-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HeartPulse className="w-5 h-5 mb-0.5" />
          <span>Wellness</span>
          {pregnancyActive && (
            <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('gps')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'gps' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>GPS</span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'scanner' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5 text-cyan-400" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'ai' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span>Shield AI</span>
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'memory' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-5 h-5 mb-0.5" />
          <span>Memory</span>
        </button>

        <button
          onClick={() => setActiveTab('daily_updates')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'daily_updates' || activeTab === 'updates' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5 text-cyan-400" />
          <span>Updates</span>
        </button>
      </div>
    </nav>
  );
};
