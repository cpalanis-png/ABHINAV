import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { CycleLog } from '../types';

interface CycleHistoryViewProps {
  cycles: CycleLog[];
  onUpdateCycles: (cycles: CycleLog[]) => void;
  onSelectCycle?: (cycle: CycleLog) => void;
}

export const CycleHistoryView: React.FC<CycleHistoryViewProps> = ({
  cycles,
  onUpdateCycles,
  onSelectCycle
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editCycleLength, setEditCycleLength] = useState(28);
  const [editPeriodLength, setEditPeriodLength] = useState(5);
  const [editNotes, setEditNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Sort cycles descending by startDate
  const sortedCycles = [...cycles].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  // Historical Trends Calculation
  const avgCycleLength = sortedCycles.length > 0
    ? Math.round(sortedCycles.reduce((sum, c) => sum + (c.cycleLengthDays || 28), 0) / sortedCycles.length)
    : 28;

  const avgPeriodDuration = sortedCycles.length > 0
    ? Math.round((sortedCycles.reduce((sum, c) => sum + (c.periodLengthDays || 5), 0) / sortedCycles.length) * 10) / 10
    : 5;

  const shortestCycle = sortedCycles.length > 0
    ? Math.min(...sortedCycles.map(c => c.cycleLengthDays || 28))
    : 28;

  const longestCycle = sortedCycles.length > 0
    ? Math.max(...sortedCycles.map(c => c.cycleLengthDays || 28))
    : 28;

  const cycleVariation = longestCycle - shortestCycle;
  const isRegular = cycleVariation <= 4;

  const startEdit = (c: CycleLog) => {
    setEditingId(c.id);
    setEditStartDate(c.startDate);
    setEditEndDate(c.endDate || '');
    setEditCycleLength(c.cycleLengthDays || 28);
    setEditPeriodLength(c.periodLengthDays || 5);
    setEditNotes(c.notes || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    if (!editStartDate) return;

    let derivedEndDate = editEndDate;
    if (!derivedEndDate && editPeriodLength > 0) {
      const start = new Date(editStartDate);
      const end = new Date(start.getTime() + (editPeriodLength - 1) * 24 * 60 * 60 * 1000);
      derivedEndDate = end.toISOString().split('T')[0];
    }

    const updated = cycles.map(c => {
      if (c.id === id) {
        return {
          ...c,
          startDate: editStartDate,
          endDate: derivedEndDate || undefined,
          cycleLengthDays: editCycleLength > 0 ? editCycleLength : 28,
          periodLengthDays: editPeriodLength > 0 ? editPeriodLength : 5,
          notes: editNotes.trim() || undefined
        };
      }
      return c;
    });

    onUpdateCycles(updated);
    setEditingId(null);
    showFeedback('Cycle dates and duration updated successfully.');
  };

  const deleteCycle = (id: string) => {
    if (cycles.length <= 1) {
      showFeedback('At least one cycle record is required for tracking.');
      return;
    }
    const updated = cycles.filter(c => c.id !== id);
    onUpdateCycles(updated);
    showFeedback('Cycle record removed.');
  };

  // Helper to compute calculated end date if not explicitly stored
  const getCycleEndDate = (c: CycleLog): string => {
    if (c.endDate) return c.endDate;
    try {
      const s = new Date(c.startDate);
      const end = new Date(s.getTime() + (c.periodLengthDays - 1) * 24 * 60 * 60 * 1000);
      return end.toISOString().split('T')[0];
    } catch {
      return c.startDate;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-pink-950 border border-pink-700 text-pink-200 text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Historical Trends Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-pink-400" />
            <span>Avg Cycle</span>
          </span>
          <div className="text-xl font-black text-white">{avgCycleLength} <span className="text-xs font-semibold text-slate-400">days</span></div>
          <div className="text-[10px] text-slate-500">Range: {shortestCycle} – {longestCycle} days</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-rose-400" />
            <span>Avg Period</span>
          </span>
          <div className="text-xl font-black text-rose-300">{avgPeriodDuration} <span className="text-xs font-semibold text-slate-400">days</span></div>
          <div className="text-[10px] text-slate-500">Active menstrual bleeding</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span>Regularity</span>
          </span>
          <div className={`text-base font-extrabold ${isRegular ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isRegular ? 'Consistent' : 'Variable (±' + cycleVariation + 'd)'}
          </div>
          <div className="text-[10px] text-slate-500">{sortedCycles.length} recorded cycles</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Confidence</span>
          </span>
          <div className="text-base font-extrabold text-cyan-300">
            {sortedCycles.length >= 3 ? 'High (3+ Cycles)' : 'Calibrating'}
          </div>
          <div className="text-[10px] text-slate-500">Individual history based</div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="rounded-3xl bg-slate-900 p-5 sm:p-6 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-pink-400" />
              <span>Cycle Timeline &amp; Trend History</span>
            </h3>
            <p className="text-xs text-slate-400">
              Visual overview of bleeding window, follicular, estimated ovulation, and luteal phases
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>Bleeding</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
              <span>Fertile / Ovulation</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
              <span>Luteal / Rest</span>
            </span>
          </div>
        </div>

        {/* Timeline Cards */}
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-pink-500 before:via-purple-600 before:to-slate-800">
          {sortedCycles.map((c, index) => {
            const isEditing = editingId === c.id;
            const endDateStr = getCycleEndDate(c);
            const periodDays = c.periodLengthDays || 5;
            const totalDays = c.cycleLengthDays || 28;
            const periodPct = Math.min(100, Math.round((periodDays / totalDays) * 100));
            const fertileStartPct = Math.round(((totalDays - 14 - 3) / totalDays) * 100);
            const fertileWidthPct = Math.round((5 / totalDays) * 100);

            return (
              <div
                key={c.id}
                className="relative group rounded-2xl bg-slate-950 border border-slate-800 hover:border-pink-800/60 p-4 sm:p-5 transition-all shadow-md"
              >
                {/* Timeline node */}
                <div className={`absolute -left-[30px] sm:-left-[38px] top-5 w-4 h-4 rounded-full border-2 ${index === 0 ? 'bg-pink-500 border-white ring-4 ring-pink-950' : 'bg-slate-900 border-pink-500'}`} />

                {isEditing ? (
                  /* Inline Edit Form */
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-pink-300">Edit Cycle Dates &amp; Duration</div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Period Start Date</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={e => setEditStartDate(e.target.value)}
                          className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Period End Date</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={e => setEditEndDate(e.target.value)}
                          className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Cycle Length (Days)</label>
                        <input
                          type="number"
                          min={20}
                          max={45}
                          value={editCycleLength}
                          onChange={e => setEditCycleLength(Number(e.target.value))}
                          className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Period Bleeding (Days)</label>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={editPeriodLength}
                          onChange={e => setEditPeriodLength(Number(e.target.value))}
                          className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Symptoms or Flow Notes</label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="e.g. Mild cramps, heavy flow day 2, warm ginger tea helped..."
                        className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(c.id)}
                        className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Verification</span>
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Timeline View Row */
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-sm sm:text-base font-black text-white">
                          {c.startDate} <span className="text-slate-500 font-normal">→</span> {endDateStr}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 text-[10px] font-bold border border-pink-700">
                            Most Recent Cycle
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                          {c.cycleLengthDays} Days Total
                        </span>
                        <span className="text-xs font-bold text-rose-300 bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-800">
                          {c.periodLengthDays} Days Bleeding
                        </span>

                        {/* Actions: Edit & Delete */}
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Verify or edit cycle dates"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteCycle(c.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Delete cycle record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Proportional Cycle Phase Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-3 rounded-full bg-slate-850 overflow-hidden relative border border-slate-800">
                        {/* Menstrual Phase */}
                        <div
                          style={{ width: `${periodPct}%` }}
                          className="h-full bg-rose-500"
                          title={`Menstrual Bleeding: Days 1–${periodDays}`}
                        />
                        {/* Fertile / Ovulation window */}
                        <div
                          style={{ left: `${fertileStartPct}%`, width: `${fertileWidthPct}%` }}
                          className="h-full bg-purple-500/80 absolute top-0"
                          title="Estimated Ovulation Window (~14 days before next cycle)"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Day 1: Start</span>
                        <span>Day {Math.max(1, totalDays - 14)}: Ovulation Window</span>
                        <span>Day {totalDays}: End</span>
                      </div>
                    </div>

                    {/* Notes & Context */}
                    {c.notes && (
                      <div className="text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                        &ldquo;{c.notes}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
