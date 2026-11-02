import React, { useState, useEffect } from 'react';
import { HeartPulse, Calendar, Droplets, Smile, Plus, Trash2, Download, ShieldCheck, Sparkles, History } from 'lucide-react';
import { CycleLog, SymptomLog } from '../types';
import { StorageService } from '../services/storage';
import { CycleHistoryView } from './CycleHistoryView';

interface MenstrualWellnessViewProps {
  pregnancyActive: boolean;
  setPregnancyActive: (active: boolean) => void;
}

export const MenstrualWellnessView: React.FC<MenstrualWellnessViewProps> = ({
  pregnancyActive,
  setPregnancyActive
}) => {
  const [cycles, setCycles] = useState<CycleLog[]>(() => StorageService.getCycles());

  const todayStr = StorageService.getLocalDateString();
  const [startDate, setStartDate] = useState(todayStr);
  const [periodLength, setPeriodLength] = useState(5);
  const [cycleLength, setCycleLength] = useState(28);

  const [waterCount, setWaterCount] = useState(6);
  const [crampLevel, setCrampLevel] = useState<'none' | 'mild' | 'moderate' | 'severe'>('mild');
  const [flowLevel, setFlowLevel] = useState<'spotting' | 'light' | 'medium' | 'heavy'>('medium');

  // Next Period Estimation (Based on most recent cycle)
  const sortedCycles = [...cycles].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const lastCycle = sortedCycles[0];
  const nextEstimatedPeriod = lastCycle
    ? new Date(new Date(lastCycle.startDate).getTime() + (lastCycle.cycleLengthDays || 28) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : '2026-11-20';

  const updateCycles = (newCycles: CycleLog[]) => {
    setCycles(newCycles);
    StorageService.saveCycles(newCycles);
  };

  const addCycle = () => {
    if (!startDate) return;
    const sDate = new Date(startDate);
    const eDate = new Date(sDate.getTime() + (periodLength - 1) * 24 * 60 * 60 * 1000);
    const newC: CycleLog = {
      id: `cy-${Date.now()}`,
      startDate,
      endDate: eDate.toISOString().split('T')[0],
      cycleLengthDays: cycleLength > 0 ? cycleLength : 28,
      periodLengthDays: periodLength > 0 ? periodLength : 5
    };
    const updated = [newC, ...cycles];
    updateCycles(updated);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner & Pregnancy Mode Toggle */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-pink-950/60 to-slate-900 p-6 border border-pink-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-pink-950 border border-pink-700 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-xl font-black text-white">Menstrual Wellness Center</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-950 text-pink-300 border border-pink-800">
              Private &amp; Encrypted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track cycles, predict future period windows, log symptoms, and monitor hydration.
          </p>
        </div>

        {/* Toggle Pregnancy Mode Switch */}
        <div className="p-3 rounded-xl bg-slate-850 border border-pink-700/60 flex items-center space-x-3">
          <div>
            <span className="text-xs font-bold text-white block">Pregnancy &amp; Postpartum Mode</span>
            <span className="text-[10px] text-slate-400">Activates specialized trimester dashboard</span>
          </div>
          <button
            onClick={() => setPregnancyActive(!pregnancyActive)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${pregnancyActive ? 'bg-pink-600' : 'bg-slate-700'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${pregnancyActive ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Cycle Overview & Next Estimated Period Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Next Period Prediction */}
        <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-pink-400" />
            <span>Next Estimated Period</span>
          </span>
          <h3 className="text-2xl font-black text-pink-300">{nextEstimatedPeriod}</h3>
          <p className="text-xs text-slate-400">
            Based on average <strong className="text-white">{cycleLength} day</strong> cycle length.
          </p>
        </div>

        {/* Hydration Tracker */}
        <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Daily Hydration Goal</span>
            </span>
            <span className="text-xs font-bold text-cyan-300">{waterCount} / 8 Glasses</span>
          </div>

          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                onClick={() => setWaterCount(i)}
                className={`flex-1 h-8 rounded-lg cursor-pointer transition-colors ${
                  i <= waterCount ? 'bg-cyan-500' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Symptom & Comfort Summary */}
        <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Comfort</span>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Cramps: <strong className="text-pink-300 capitalize">{crampLevel}</strong></span>
            <span className="text-xs text-slate-300">Flow: <strong className="text-pink-300 capitalize">{flowLevel}</strong></span>
          </div>
        </div>

      </div>

      {/* Log Period Cycle Form & Logs */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white">Log Menstrual Cycle Start</h3>
          <p className="text-xs text-slate-400">Records are kept strictly private on your device</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Cycle Length (Days)</label>
            <input
              type="number"
              value={cycleLength}
              onChange={(e) => setCycleLength(Number(e.target.value))}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Period Duration (Days)</label>
            <input
              type="number"
              value={periodLength}
              onChange={(e) => setPeriodLength(Number(e.target.value))}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={addCycle}
              className="w-full py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Log Cycle</span>
            </button>
          </div>
        </div>

        {/* Cycle History View Timeline & Date Verification */}
        <CycleHistoryView
          cycles={cycles}
          onUpdateCycles={updateCycles}
        />
      </div>

    </div>
  );
};
