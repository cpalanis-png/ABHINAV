import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Compass, HeartPulse, MessageSquare, Lock, Gamepad2, Dna, Sparkles, Sliders, Utensils, Video, Mic, MicOff, Users, Newspaper, LogOut, UserCheck, Brain, Eye } from 'lucide-react';
import { AuthUser, LocationData } from '../types';
import { voiceSosService, VoiceSOSState } from '../services/voiceSosService';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  location: LocationData | null;
  triggerSOS: () => void;
  pregnancyActive: boolean;
  onOpenGame: () => void;
  safetySearchRadius?: number;
  contactsCount?: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  triggerSOS,
  onOpenGame,
  safetySearchRadius,
  contactsCount = 0,
  currentUser,
  onLogout
}) => {
  const [voiceSosState, setVoiceSosState] = useState<VoiceSOSState>(() => voiceSosService.getState());

  useEffect(() => {
    const unsubVoiceSos = voiceSosService.subscribe((newState) => {
      setVoiceSosState(newState);
    });

    return () => {
      unsubVoiceSos();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center space-x-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-base sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-300 bg-clip-text text-transparent">
                SMART SHIELD
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wider font-medium uppercase hidden sm:block">
              Your Safety • Your Health • Your Power
            </p>
          </div>
        </div>

        {/* Center Desktop Nav Links */}
        <nav className="hidden xl:flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'dashboard' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('safety')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'safety' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>Safety</span>
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'contacts' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>Contacts</span>
            {contactsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-950 text-purple-300 border border-purple-700">
                {contactsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('wellness')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'wellness' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 text-pink-400" />
            <span>Wellness</span>
          </button>

          <button
            onClick={() => setActiveTab('nutrition')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'nutrition' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nutrition</span>
          </button>

          <button
            onClick={() => setActiveTab('bioscience')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'bioscience' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Dna className="w-3.5 h-3.5 text-indigo-400" />
            <span>Bioscience</span>
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'studio' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Media Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('gps')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'gps' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'evidence' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>Evidence</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'scanner' ? 'bg-cyan-900/60 text-cyan-200 border border-cyan-500/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('daily_updates')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'daily_updates' || activeTab === 'updates' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
            <span>Daily Updates</span>
          </button>



          <button
            onClick={() => setActiveTab('ai')}
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'ai' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shield AI</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            data-testid="nav-ai-memory-btn"
            className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
              activeTab === 'memory' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Memory</span>
          </button>
        </nav>

        {/* Right Status Controls & Immediate SOS Button */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          
          {/* 3D Game Launcher Button */}
          <button
            onClick={onOpenGame}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md border border-sky-400/30"
            title="Launch 3D Shield Guardian Game"
          >
            <Gamepad2 className="w-4 h-4 text-sky-200" />
            <span className="hidden md:inline">3D Game</span>
          </button>

          {/* My AI Memory Quick Access (visible on mobile/tablet when xl nav is hidden) */}
          <button
            onClick={() => setActiveTab('memory')}
            className={`xl:hidden p-2 rounded-lg border transition-colors ${
              activeTab === 'memory' ? 'bg-purple-950 text-purple-200 border-purple-500' : 'bg-slate-850 text-purple-300 border-slate-700 hover:text-white'
            }`}
            title="My AI Memory & Personalization"
          >
            <Brain className="w-4 h-4" />
          </button>

          {/* Quick Privacy Profile */}
          <button
            onClick={() => setActiveTab('privacy')}
            className={`p-2 rounded-lg border transition-colors ${
              activeTab === 'privacy' ? 'bg-slate-800 text-purple-300 border-purple-600' : 'bg-slate-850 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Privacy Health Check & Passport"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Safety Settings Radius */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-lg border transition-colors hidden sm:flex items-center space-x-1 ${
              activeTab === 'settings' ? 'bg-slate-800 text-cyan-300 border-cyan-500' : 'bg-slate-850 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title={`Safety Search Radius (${safetySearchRadius || 5} km)`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-bold hidden 2xl:inline text-cyan-300">{safetySearchRadius || 5}km</span>
          </button>

          {/* Voice-Activated SOS Guard Toggle ("Smart Shield Help") */}
          <button
            onClick={() => voiceSosService.toggleListening()}
            className={`p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
              voiceSosState.isArmed
                ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-950/60'
                : 'bg-slate-850 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={
              voiceSosState.isArmed
                ? `Voice SOS Armed — Say "${voiceSosState.triggerPhrase}" to start SOS (click to disarm)`
                : `Arm Voice-Activated SOS (Trigger keyword: "${voiceSosState.triggerPhrase}")`
            }
          >
            {voiceSosState.isArmed ? (
              <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden lg:inline">
              {voiceSosState.isArmed ? 'Voice ON' : 'Voice'}
            </span>
          </button>

          {/* Prominent Header SOS Button */}
          <button
            onClick={triggerSOS}
            className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/60 hover:shadow-rose-900/80 active:scale-95 transition-all flex items-center space-x-1 border border-rose-400/30"
          >
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse fill-white text-rose-600" />
            <span>SOS</span>
          </button>

          {/* Authenticated User Badge & Logout Button */}
          {currentUser && onLogout && (
            <div className="flex items-center space-x-1.5 pl-1 border-l border-slate-800">
              <div
                className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-purple-200"
                title={`Signed in as ${currentUser.fullName} (${currentUser.email})`}
              >
                <UserCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span className="max-w-[90px] truncate font-semibold">
                  {currentUser.fullName.split(' ')[0]}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/50 text-slate-200 hover:text-rose-200 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                title="Sign Out and return to Welcome Page"
              >
                <LogOut className="w-3.5 h-3.5 text-pink-300" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
