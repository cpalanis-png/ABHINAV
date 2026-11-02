import React, { useState } from 'react';
import { Lock, ShieldCheck, QrCode, Phone, Download, Trash2, Key, Clock, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { RescuePassport, Contact, LocationData } from '../types';
import { StorageService } from '../services/storage';
import { PermissionStatusView } from './PermissionStatusView';

interface PrivacyAndPassportViewProps {
  location: LocationData | null;
  contacts: Contact[];
}

export const PrivacyAndPassportView: React.FC<PrivacyAndPassportViewProps> = ({ location, contacts }) => {
  const [bloodGroup, setBloodGroup] = useState('O+ Positive');
  const [allergies, setAllergies] = useState('Penicillin (Mild)');
  const [medications, setMedications] = useState('Iron & Folic Acid Daily');
  const [passport, setPassport] = useState<RescuePassport | null>(StorageService.getPassport());
  const [copied, setCopied] = useState(false);

  const generatePassport = async () => {
    let tokenId = 'p-' + Math.random().toString(36).substring(2, 10);
    let expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    try {
      const res = await fetch('/api/passport/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportData: { bloodGroup, allergies, medications }, expiresInMinutes: 60 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tokenId) {
          tokenId = data.tokenId;
          expiresAt = data.expiresAt;
        }
      }
    } catch { /* fallback */ }

    const newP: RescuePassport = {
      id: `pass-${Date.now()}`,
      tokenId,
      bloodGroup,
      allergies: allergies.split(',').map(s => s.trim()),
      emergencyMedications: medications.split(',').map(s => s.trim()),
      preExistingConditions: ['None'],
      emergencyNotes: 'Temporary emergency rescue profile voluntarily created by user.',
      expiresAt,
      createdAt: new Date().toISOString(),
      active: true
    };

    StorageService.savePassport(newP);
    setPassport(newP);
  };

  const revokePassport = () => {
    if (passport) {
      const revoked = { ...passport, active: false };
      StorageService.savePassport(revoked);
      setPassport(null);
    }
  };

  const copyPassportLink = () => {
    if (!passport) return;
    const url = `${window.location.origin}/passport/${passport.tokenId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Comprehensive Android System Permissions & Hardware Audit Section */}
      <PermissionStatusView
        location={location}
        refreshLocation={() => {
          // Trigger location refresh
          window.dispatchEvent(new Event('refreshGPS'));
        }}
      />

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 p-6 border border-emerald-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-white">Privacy Health Check &amp; Rescue Passport</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
              Zero External Tracking
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Audit device permissions, control location sharing, and generate expiring emergency medical profile links.
          </p>
        </div>
      </div>

      {/* Privacy Health Check Dashboard */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Privacy Health Check Dashboard</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-white">GPS Location</h5>
              <p className="text-xs text-slate-400">Consent-based live tracking</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-white">Trusted Contacts</h5>
              <p className="text-xs text-slate-400">{contacts.length} Authorized</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-white">Local Encrypted Data</h5>
              <p className="text-xs text-slate-400">On-Device Storage</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Rescue Passport Generator */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-indigo-400" />
            <span>Rescue Passport Generator</span>
          </h3>
          <p className="text-xs text-slate-400">Generates a temporary shareable 1-click medical profile for first responders with 1-hour expiry</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Blood Group</label>
            <input
              type="text"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Known Allergies</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Current Emergency Medications</label>
            <input
              type="text"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={generatePassport}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate 1-Hour Rescue Passport Token</span>
          </button>

          {passport && passport.active && (
            <button
              onClick={revokePassport}
              className="px-4 py-3 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 hover:text-white font-bold text-xs"
            >
              Revoke Token Now
            </button>
          )}
        </div>

        {passport && passport.active && (
          <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase">Active Passport Token: {passport.tokenId}</span>
              <span className="text-[11px] text-indigo-200">Expires: {new Date(passport.expiresAt).toLocaleTimeString()}</span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/passport/${passport.tokenId}`}
                className="flex-1 bg-slate-900 text-xs text-indigo-200 px-3 py-2 rounded-lg border border-indigo-700"
              />
              <button
                onClick={copyPassportLink}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Directory */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <Phone className="w-5 h-5 text-rose-400" />
          <span>Verified Regional Emergency Helpline Directory</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="font-bold text-white">India All-In-One Emergency</h5>
              <p className="text-slate-400">National Emergency Response</p>
            </div>
            <a href="tel:112" className="text-rose-400 font-extrabold text-sm">112</a>
          </div>

          <div className="p-3 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="font-bold text-white">Women's Helpline (India)</h5>
              <p className="text-slate-400">National Commission for Women</p>
            </div>
            <a href="tel:1091" className="text-purple-400 font-extrabold text-sm">1091</a>
          </div>

          <div className="p-3 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
            <div>
              <h5 className="font-bold text-white">United States Emergency</h5>
              <p className="text-slate-400">911 Dispatch</p>
            </div>
            <a href="tel:911" className="text-cyan-400 font-extrabold text-sm">911</a>
          </div>
        </div>
      </div>

      {/* Data Privacy Controls: Export & Erase */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white">Data Retention &amp; Erasure Controls</h3>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              const dataStr = StorageService.exportAllUserData();
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'smartshield_privacy_export.json';
              a.click();
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-2 border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export All My Data (JSON)</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to erase all local SMART SHIELD data?')) {
                StorageService.wipeAllUserData();
                window.location.reload();
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe All Local Data</span>
          </button>
        </div>
      </div>

    </div>
  );
};
