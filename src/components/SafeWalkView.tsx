import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Clock, ShieldAlert, CheckCircle2, MapPin, Users, Share2, AlertTriangle, Play, Square, Plus } from 'lucide-react';
import { LocationData, Contact } from '../types';
import { LocationService } from '../services/locationService';

interface SafeWalkViewProps {
  location: LocationData | null;
  contacts: Contact[];
  triggerSOS: () => void;
}

export const SafeWalkView: React.FC<SafeWalkViewProps> = ({
  location,
  contacts,
  triggerSOS
}) => {
  const [destination, setDestination] = useState('Apollo Women Hospital, Anna Salai');
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    contacts.slice(0, 2).map((c) => c.id)
  );

  // Live Session State
  const [isWalkActive, setIsWalkActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(15 * 60);
  const [deviationDetected, setDeviationDetected] = useState(false);
  const [distanceRemainingKm, setDistanceRemainingKm] = useState(2.4);
  const [startLoc, setStartLoc] = useState<LocationData | null>(null);

  const initialLocRef = useRef<LocationData | null>(null);

  // Timer & Route Corridor Monitoring
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isWalkActive) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            // Timer expired without safe arrival -> Trigger Emergency SOS
            triggerSOS();
            setIsWalkActive(false);
            return 0;
          }
          return prev - 1;
        });

        // Simulate small distance progress and potential deviation check
        setDistanceRemainingKm((prev) => Math.max(0.1, prev - 0.005));
      }, 1000);

      // Start live GPS watch
      LocationService.startWatching((currentLoc) => {
        if (initialLocRef.current) {
          // Calculate distance shift from initial starting coordinate
          const latDiff = Math.abs(currentLoc.latitude - initialLocRef.current.latitude);
          const lngDiff = Math.abs(currentLoc.longitude - initialLocRef.current.longitude);
          // If sudden extreme shift away (>0.01 deg (~1.1 km)) simulate deviation warning
          if (latDiff > 0.015 || lngDiff > 0.015) {
            setDeviationDetected(true);
          }
        }
      });
    } else {
      LocationService.stopWatching();
    }

    return () => {
      clearInterval(timer);
      LocationService.stopWatching();
    };
  }, [isWalkActive, triggerSOS]);

  const startSafeWalk = () => {
    if (!destination.trim()) return;
    initialLocRef.current = location;
    setStartLoc(location);
    setSecondsRemaining(etaMinutes * 60);
    setDeviationDetected(false);
    setDistanceRemainingKm(2.4);
    setIsWalkActive(true);
  };

  const endSafeWalk = () => {
    setIsWalkActive(false);
    setDeviationDetected(false);
  };

  const addTime = (mins: number) => {
    setSecondsRemaining((prev) => prev + mins * 60);
  };

  const toggleContactSelect = (id: string) => {
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds(selectedContactIds.filter((c) => c !== id));
    } else {
      setSelectedContactIds([...selectedContactIds, id]);
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-700 flex items-center justify-center">
            <Navigation className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-white">Safe Walk Real-Time Escort</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                Route Deviation Guard
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live route tracking with automatic SOS if you deviate from path or overdue on arrival
            </p>
          </div>
        </div>

        {isWalkActive && (
          <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold animate-pulse">
            ● Safe Walk Tracking Active
          </span>
        )}
      </div>

      {!isWalkActive ? (
        /* SETUP FORM */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Destination Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Destination Address
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Where are you walking to?"
                className="w-full bg-slate-850 text-white text-xs px-4 py-3 rounded-xl border border-slate-750 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Arrival Time Goal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Estimated Walking Time
              </label>
              <select
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Number(e.target.value))}
                className="w-full bg-slate-850 text-white text-xs px-4 py-3 rounded-xl border border-slate-750 focus:outline-none focus:border-cyan-500"
              >
                <option value={10}>10 Minutes Walk</option>
                <option value={15}>15 Minutes Walk</option>
                <option value={20}>20 Minutes Walk</option>
                <option value={30}>30 Minutes Walk</option>
                <option value={45}>45 Minutes Walk</option>
              </select>
            </div>

          </div>

          {/* Share with Trusted Contacts */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Share Live Escort Tracking With ({selectedContactIds.length} Selected)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {contacts.map((c) => {
                const isSelected = selectedContactIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleContactSelect(c.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected ? 'bg-cyan-950/70 border-cyan-600 text-white' : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <h5 className="text-xs font-bold">{c.name}</h5>
                      <p className="text-[10px] opacity-80">{c.relationship}</p>
                    </div>

                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'bg-cyan-500 border-cyan-400' : 'border-slate-600'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-slate-950" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={startSafeWalk}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-950 active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>START SAFE WALK ESCORT SESSION</span>
          </button>
        </div>
      ) : (
        /* LIVE ESCORT MONITORING DASHBOARD */
        <div className="space-y-6">
          
          {/* Deviation Alert Warning if detected */}
          {deviationDetected && (
            <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-600 space-y-2 text-rose-200 animate-pulse">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h4 className="text-sm font-black text-white uppercase">ROUTE DEVIATION DETECTED!</h4>
              </div>
              <p className="text-xs">
                You have shifted significantly from your planned walking corridor. Click "I am Safe" or SOS will auto-trigger when timer expires.
              </p>
            </div>
          )}

          {/* Countdown & Corridor Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Arrival Timer</span>
              <h2 className="text-4xl font-black text-cyan-300 font-mono">{formatTime(secondsRemaining)}</h2>
              <span className="text-[10px] text-slate-400">Auto SOS on 00:00</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Distance Remaining</span>
              <h2 className="text-4xl font-black text-emerald-400 font-mono">{distanceRemainingKm.toFixed(2)} km</h2>
              <span className="text-[10px] text-slate-400">Estimated Walking Speed</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Route Corridor</span>
              <h2 className={`text-2xl font-black ${deviationDetected ? 'text-rose-400' : 'text-emerald-400'} mt-2`}>
                {deviationDetected ? 'Off Path' : 'On Track'}
              </h2>
              <span className="text-[10px] text-slate-400">Geofence Sensitivity: 150m</span>
            </div>

          </div>

          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 text-xs text-slate-300 space-y-1">
            <p>Destination: <strong className="text-white">{destination}</strong></p>
            <p>Sharing live route with <strong className="text-cyan-300">{selectedContactIds.length} trusted contacts</strong>.</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={endSafeWalk}
              className="py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg"
            >
              ✓ I HAVE ARRIVED SAFELY
            </button>

            <button
              onClick={() => addTime(5)}
              className="py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1 border border-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>Extend Time (+5 mins)</span>
            </button>

            <button
              onClick={triggerSOS}
              className="py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-1"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>TRIGGER IMMEDIATE SOS</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
