import React, { useState, useEffect, useRef } from 'react';
import { Wind, Play, Pause, RotateCcw, HeartPulse, Sparkles, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';

export const CalmBreathing: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold-in' | 'exhale' | 'hold-out'>('inhale');
  const [countdown, setCountdown] = useState(4);
  const [cycleCount, setCycleCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Gentle tone generator for phase transitions
  const playPhaseChime = (freq: number) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch { /* ignore audio fallback */ }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isActive) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev > 1) {
            return prev - 1;
          }

          // Move to next box breathing phase
          if (phase === 'inhale') {
            setPhase('hold-in');
            playPhaseChime(440); // A4
            return 4;
          } else if (phase === 'hold-in') {
            setPhase('exhale');
            playPhaseChime(392); // G4
            return 4;
          } else if (phase === 'exhale') {
            setPhase('hold-out');
            playPhaseChime(329.63); // E4
            return 4;
          } else {
            setPhase('inhale');
            setCycleCount((c) => c + 1);
            playPhaseChime(523.25); // C5
            return 4;
          }
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isActive, phase, isMuted]);

  const toggleStart = () => {
    if (!isActive) {
      playPhaseChime(523.25);
    }
    setIsActive(!isActive);
  };

  const resetBreathing = () => {
    setIsActive(false);
    setPhase('inhale');
    setCountdown(4);
    setCycleCount(0);
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'inhale':
        return 'from-cyan-500 to-teal-400 text-cyan-300 border-cyan-500/50 shadow-cyan-950/80';
      case 'hold-in':
        return 'from-purple-500 to-indigo-400 text-purple-300 border-purple-500/50 shadow-purple-950/80';
      case 'exhale':
        return 'from-rose-500 to-pink-400 text-rose-300 border-rose-500/50 shadow-rose-950/80';
      case 'hold-out':
        return 'from-amber-500 to-orange-400 text-amber-300 border-amber-500/50 shadow-amber-950/80';
    }
  };

  const getPhaseInstruction = () => {
    switch (phase) {
      case 'inhale':
        return 'Inhale deeply through your nose...';
      case 'hold-in':
        return 'Hold breath gently...';
      case 'exhale':
        return 'Exhale slowly through your mouth...';
      case 'hold-out':
        return 'Hold lungs empty & relax...';
    }
  };

  // Scale ring animation based on phase and countdown
  const getCircleScale = () => {
    if (!isActive) return 'scale-100';
    if (phase === 'inhale') {
      return 'scale-125 transition-transform duration-[4000ms] ease-out';
    } else if (phase === 'hold-in') {
      return 'scale-125';
    } else if (phase === 'exhale') {
      return 'scale-90 transition-transform duration-[4000ms] ease-in-out';
    } else {
      return 'scale-90';
    }
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-950 border border-teal-700/60 flex items-center justify-center">
            <Wind className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-white">CalmBreathing Box Exercise</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                4-4-4-4 Rhythm
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Guided vagus nerve regulation to immediately reduce heart rate &amp; stress during emergencies
            </p>
          </div>
        </div>

        {/* Audio Mute & Cycle Counter */}
        <div className="flex items-center space-x-3 self-end sm:self-center">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors"
            title={isMuted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-750 text-xs font-bold text-slate-300">
            Completed Cycles: <strong className="text-teal-300 font-mono text-sm ml-1">{cycleCount}</strong>
          </div>
        </div>
      </div>

      {/* Main Breathing Visualizer Sphere */}
      <div className="relative py-12 flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950 border border-slate-850">
        
        {/* Animated Radial Pulse Rings */}
        <div className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr ${getPhaseColor()} p-1 shadow-2xl flex items-center justify-center ${getCircleScale()}`}>
          <div className="w-full h-full rounded-full bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              {phase.replace('-', ' ')}
            </span>
            <div className="text-6xl font-black text-white font-mono my-1">
              {countdown}s
            </div>
            <span className="text-xs font-medium text-slate-300 max-w-[140px] leading-tight">
              {getPhaseInstruction()}
            </span>
          </div>
        </div>

        {/* Phase Progress Indicators */}
        <div className="grid grid-cols-4 gap-2 max-w-sm w-full mt-10 px-4">
          <div className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all ${
            phase === 'inhale' ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            1. Inhale (4s)
          </div>

          <div className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all ${
            phase === 'hold-in' ? 'bg-purple-950/80 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            2. Hold (4s)
          </div>

          <div className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all ${
            phase === 'exhale' ? 'bg-rose-950/80 border-rose-500 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            3. Exhale (4s)
          </div>

          <div className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all ${
            phase === 'hold-out' ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            4. Hold (4s)
          </div>
        </div>

      </div>

      {/* Control Actions Bar */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={toggleStart}
          className={`px-8 py-3.5 rounded-2xl font-black text-sm flex items-center space-x-2 shadow-xl transition-all active:scale-95 ${
            isActive
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white'
          }`}
        >
          {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
          <span>{isActive ? 'Pause Exercise' : 'Start CalmBreathing'}</span>
        </button>

        <button
          onClick={resetBreathing}
          className="p-3.5 rounded-2xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors"
          title="Reset Breathing Session"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Scientific Benefits Card */}
      <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-750 space-y-2 text-xs text-slate-300">
        <div className="flex items-center space-x-2 font-bold text-white">
          <HeartPulse className="w-4 h-4 text-teal-400" />
          <span>Why Box Breathing Works</span>
        </div>
        <p className="leading-relaxed">
          Box breathing (also known as 4x4 breathing) triggers parasympathetic nervous system dominance, reducing blood pressure and cortisol levels within 2 to 4 minutes. Used by emergency responders and medical clinicians worldwide.
        </p>
      </div>

    </div>
  );
};
