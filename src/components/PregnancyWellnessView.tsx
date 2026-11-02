import React, { useState } from 'react';
import {
  Baby,
  Calendar,
  Heart,
  AlertTriangle,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  Utensils,
  Pill,
  HelpCircle,
  Footprints,
  ShieldAlert,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { PregnancyProfile, Appointment, PregnancyJournalEntry, PregnancyMedication, FetalKickLog } from '../types';
import { StorageService } from '../services/storage';

interface PregnancyWellnessViewProps {
  pregnancyProfile: PregnancyProfile;
  setPregnancyProfile: (profile: PregnancyProfile) => void;
  setActiveTab: (tab: string) => void;
}

export const PregnancyWellnessView: React.FC<PregnancyWellnessViewProps> = ({
  pregnancyProfile,
  setPregnancyProfile,
  setActiveTab
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>(StorageService.getAppointments());
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'appointments' | 'food' | 'kicks' | 'prep' | 'urgent'>('dashboard');

  // Food Safety Search Query State
  const [foodQuery, setFoodQuery] = useState('');

  // Kick Counter State
  const [kickCount, setKickCount] = useState(0);
  const [kickTimerRunning, setKickTimerRunning] = useState(false);

  // New Appointment Form State
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptDoctor, setNewApptDoctor] = useState('Dr. Radhika V.');
  const [newApptDate, setNewApptDate] = useState('');

  const addAppointment = () => {
    if (!newApptTitle.trim() || !newApptDate.trim()) return;
    const newA: Appointment = {
      id: `a-${Date.now()}`,
      title: newApptTitle,
      doctorName: newApptDoctor,
      locationName: 'Clinic / Hospital',
      dateTime: newApptDate,
      questionsToAsk: ['Any special nutrition tips for this trimester?'],
      completed: false
    };
    const updated = [...appointments, newA];
    setAppointments(updated);
    StorageService.saveAppointments(updated);
    setNewApptTitle('');
    setNewApptDate('');
  };

  const foodSafetyDatabase = [
    { food: 'Papaya (Unripe / Semi-ripe)', status: 'avoid', advice: 'Contains latex enzymes that may induce uterine contractions. Fully ripe papaya is considered safe in moderate amounts.' },
    { food: 'Spinach / Keerai (Palak / Sambar greens)', status: 'safe', advice: 'Excellent source of folic acid, iron, and fiber. Ensure thoroughly washed and cooked.' },
    { food: 'Eggs (Boiled / Omelette)', status: 'safe', advice: 'Rich in choline and protein. Ensure fully cooked with no runny yolk to avoid salmonella.' },
    { food: 'Curd / Yogurt / Butter Milk (Mor)', status: 'safe', advice: 'Great probiotic for gut health and calcium. Ensure pasteurized milk is used.' },
    { food: 'Raw Seafood / Uncooked Sushi', status: 'avoid', advice: 'Higher risk of listeria and parasitic bacteria.' },
    { food: 'Coffee / Caffeine', status: 'caution', advice: 'Limit total caffeine intake to less than 200mg per day (~1-2 small cups).' },
  ];

  const filteredFoods = foodSafetyDatabase.filter(f => f.food.toLowerCase().includes(foodQuery.toLowerCase()));

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-pink-950/80 to-slate-900 p-6 border border-pink-700/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-900/80 border border-pink-600 flex items-center justify-center shrink-0">
            <Baby className="w-7 h-7 text-pink-300" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Pregnancy &amp; Postpartum Wellness Center</h2>
            <p className="text-xs text-slate-300">
              Week {pregnancyProfile.currentWeek}, Day {pregnancyProfile.currentDay} • Trimester {pregnancyProfile.trimester}
            </p>
          </div>
        </div>

        {/* Sub-tab Switches */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-850 p-1.5 rounded-xl border border-slate-750 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeSubTab === 'dashboard' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveSubTab('appointments')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeSubTab === 'appointments' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Appointments
          </button>
          <button
            onClick={() => setActiveSubTab('food')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeSubTab === 'food' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Food Safety
          </button>
          <button
            onClick={() => setActiveSubTab('kicks')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeSubTab === 'kicks' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Kick Counter
          </button>
          <button
            onClick={() => setActiveSubTab('urgent')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeSubTab === 'urgent' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Urgent Symptoms
          </button>
        </div>
      </div>

      {/* SUBTAB 1: PREGNANCY DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baby Size Milestone</span>
              <h3 className="text-lg font-black text-pink-300">{pregnancyProfile.babySizeComparison}</h3>
              <p className="text-xs text-slate-400">Approx. 28 cm length • 500 grams weight</p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Due Date</span>
              <h3 className="text-lg font-black text-white">{pregnancyProfile.dueDate}</h3>
              <p className="text-xs text-slate-400">Primary Obstetrician: {pregnancyProfile.clinicianName}</p>
            </div>

            <div 
              onClick={() => setActiveTab('ai')}
              className="cursor-pointer rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 p-5 border border-indigo-700/60 space-y-2 hover:border-indigo-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase">Smart Pregnancy Companion</span>
                <MessageSquare className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white">Ask Pregnancy Shield AI</h3>
              <p className="text-xs text-slate-400">Ask questions about trimesters, nutrition, or appointment prep.</p>
            </div>

          </div>
        </div>
      )}

      {/* SUBTAB 2: APPOINTMENT INTELLIGENCE */}
      {activeSubTab === 'appointments' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-pink-400" />
              <span>Pregnancy Appointment Intelligence</span>
            </h3>
            <p className="text-xs text-slate-400">Schedule prenatal checkups, ultrasound appointments &amp; store clinician questions</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <input
              type="text"
              placeholder="Appointment Title (e.g. 28-Week Glucose Test)"
              value={newApptTitle}
              onChange={(e) => setNewApptTitle(e.target.value)}
              className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
            <input
              type="datetime-local"
              value={newApptDate}
              onChange={(e) => setNewApptDate(e.target.value)}
              className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
            <button
              onClick={addAppointment}
              className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Checkup</span>
            </button>
          </div>

          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white">{a.title}</h4>
                  <span className="text-xs font-bold text-pink-300">{new Date(a.dateTime).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400">Doctor: {a.doctorName} • Location: {a.locationName}</p>
                {a.notes && <p className="text-xs text-slate-300 italic">{a.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: FOOD SAFETY GUIDE */}
      {activeSubTab === 'food' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Utensils className="w-5 h-5 text-pink-400" />
              <span>Pregnancy Food Safety Index</span>
            </h3>
            <p className="text-xs text-slate-400">Searchable guide for Indian and global foods during pregnancy</p>
          </div>

          <input
            type="text"
            placeholder="Search food item (e.g. Papaya, Spinach, Eggs, Curd)..."
            value={foodQuery}
            onChange={(e) => setFoodQuery(e.target.value)}
            className="w-full bg-slate-850 text-white text-xs px-4 py-3 rounded-xl border border-slate-700 focus:outline-none"
          />

          <div className="space-y-3">
            {filteredFoods.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-start justify-between">
                <div>
                  <h5 className="text-sm font-bold text-white">{f.food}</h5>
                  <p className="text-xs text-slate-300 mt-1">{f.advice}</p>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-bold border uppercase shrink-0 ml-3 ${
                  f.status === 'safe' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                  f.status === 'caution' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                  'bg-rose-950 text-rose-300 border-rose-800'
                }`}>
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: KICK COUNTER */}
      {activeSubTab === 'kicks' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6 text-center">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center justify-center space-x-2">
              <Footprints className="w-5 h-5 text-pink-400" />
              <span>Fetal Movement Kick Counter</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Optional movement tracker recommended by clinicians in third trimester.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-850 border border-pink-900/40 max-w-sm mx-auto space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase">Kicks Logged Today</span>
            <h2 className="text-5xl font-black text-pink-300">{kickCount}</h2>

            <button
              onClick={() => setKickCount(kickCount + 1)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-base shadow-lg active:scale-95 transition-transform"
            >
              + LOG A BABY KICK
            </button>
          </div>

          <p className="text-[11px] text-amber-300 bg-amber-950/60 p-3 rounded-xl border border-amber-800/60 max-w-md mx-auto">
            <strong>Medical Disclaimer:</strong> If you notice a significant decrease or sudden change in fetal movement, contact your maternity care provider immediately.
          </p>
        </div>
      )}

      {/* SUBTAB 5: URGENT SYMPTOMS GUIDANCE */}
      {activeSubTab === 'urgent' && (
        <div className="rounded-2xl bg-rose-950/60 p-6 border border-rose-800/80 space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            <h3 className="text-lg font-black text-white">Urgent Pregnancy Warning Signs</h3>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            Seek immediate medical evaluation or call emergency services (112 or your doctor's emergency line) if you experience any of the following:
          </p>

          <ul className="space-y-2 text-xs text-rose-200 font-semibold list-disc list-inside">
            <li>Vaginal bleeding or sudden fluid leaking</li>
            <li>Severe, persistent abdominal or pelvic pain</li>
            <li>Severe headache accompanied by blurred vision or spots</li>
            <li>Sudden swelling of hands, face, or feet</li>
            <li>Noticeable reduction or cessation of fetal movements</li>
            <li>High fever or chills</li>
          </ul>

          <div className="pt-2 flex items-center space-x-3">
            <a
              href={`tel:${pregnancyProfile.emergencyContactPhone || '112'}`}
              className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center space-x-2 shadow-lg"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Call Doctor's Emergency Line ({pregnancyProfile.emergencyContactPhone || '112'})</span>
            </a>
          </div>
        </div>
      )}

    </div>
  );
};
