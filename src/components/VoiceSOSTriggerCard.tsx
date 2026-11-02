import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Sparkles,
  RotateCcw,
  Edit3,
  Zap
} from 'lucide-react';
import { voiceSosService, VoiceSOSState } from '../services/voiceSosService';

export const VoiceSOSTriggerCard: React.FC = () => {
  const [state, setState] = useState<VoiceSOSState>(() => voiceSosService.getState());
  const [isEditingPhrase, setIsEditingPhrase] = useState(false);
  const [customPhraseInput, setCustomPhraseInput] = useState(state.triggerPhrase);

  useEffect(() => {
    const unsub = voiceSosService.subscribe((newState) => {
      setState(newState);
      if (!isEditingPhrase) {
        setCustomPhraseInput(newState.triggerPhrase);
      }
    });
    return () => unsub();
  }, [isEditingPhrase]);

  const handleSavePhrase = (e: React.FormEvent) => {
    e.preventDefault();
    voiceSosService.setTriggerPhrase(customPhraseInput);
    setIsEditingPhrase(false);
  };

  const handleResetPhrase = () => {
    voiceSosService.setTriggerPhrase('Smart Shield Help');
    setCustomPhraseInput('Smart Shield Help');
    setIsEditingPhrase(false);
  };

  return (
    <section
      className={`rounded-3xl p-5 sm:p-6 border shadow-xl transition-all ${
        state.isArmed
          ? 'bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border-cyan-500/80 shadow-cyan-950/40'
          : state.status === 'triggered'
          ? 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/80 border-rose-500'
          : 'bg-slate-900/95 border-slate-800'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Info Column */}
        <div className="space-y-2.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                state.isArmed
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : state.status === 'triggered'
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {state.isArmed ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Voice-Activated SOS Trigger (Web Speech API)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    state.isArmed
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500 animate-pulse'
                      : state.status === 'triggered'
                      ? 'bg-rose-950 text-rose-200 border-rose-500'
                      : 'bg-slate-950 text-slate-400 border-slate-700'
                  }`}
                >
                  {state.isArmed
                    ? '● Listening for Keyword'
                    : state.status === 'triggered'
                    ? '⚡ SOS Triggered by Voice'
                    : 'Standby (Disarmed)'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                When armed, say{' '}
                <strong className="text-cyan-300 font-extrabold">
                  &ldquo;{state.triggerPhrase}&rdquo;
                </strong>{' '}
                aloud to hands-free initiate the Instant Emergency SOS alert.
              </p>
            </div>
          </div>

          {/* Active Keyword & Secondary Phrases Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 font-semibold">Active Trigger Keyword:</span>
            {!isEditingPhrase ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-slate-950 border border-cyan-700/70 text-cyan-300 font-mono font-bold">
                  &ldquo;{state.triggerPhrase}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPhrase(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center space-x-1 border border-slate-700"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Customize Keyword</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSavePhrase} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={customPhraseInput}
                  onChange={(e) => setCustomPhraseInput(e.target.value)}
                  placeholder="e.g. Smart Shield Help"
                  className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl border border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleResetPhrase}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center space-x-1"
                  title="Reset to default 'Smart Shield Help'"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </form>
            )}
          </div>

          {/* Live Transcript Monitor / Last Triggered Info */}
          {(state.isArmed || state.lastHeardTranscript || state.lastTriggeredPhrase) && (
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  {state.lastHeardTranscript ? (
                    <>
                      Last heard speech:{' '}
                      <strong className="text-white italic">
                        &ldquo;{state.lastHeardTranscript}&rdquo;
                      </strong>
                    </>
                  ) : (
                    'Microphone active — waiting for voice command...'
                  )}
                </span>
              </div>

              {state.lastTriggeredPhrase && (
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 text-[11px] font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Matched &ldquo;{state.lastTriggeredPhrase}&rdquo; at {state.lastTriggeredAt}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Error or Permission Notice */}
          {state.errorMessage && (
            <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-700/80 text-amber-200 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{state.errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => voiceSosService.toggleListening()}
            className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-all cursor-pointer ${
              state.isArmed
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-300'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border border-indigo-400/40'
            }`}
          >
            {state.isArmed ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Disarm Voice SOS</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Arm Voice SOS</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => voiceSosService.simulatePhraseDetection(state.triggerPhrase)}
            className="px-4 py-3 rounded-2xl bg-rose-950/90 hover:bg-rose-900 border border-rose-600/80 text-rose-200 hover:text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
            title={`Test detection of "${state.triggerPhrase}" to immediately start the SOS countdown`}
          >
            <Zap className="w-4 h-4 text-rose-400" />
            <span>Test &ldquo;{state.triggerPhrase}&rdquo;</span>
          </button>
        </div>
      </div>
    </section>
  );
};
