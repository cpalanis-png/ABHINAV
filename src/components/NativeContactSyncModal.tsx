import React, { useState, useRef } from 'react';
import {
  BookOpen,
  Smartphone,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Star,
  ShieldCheck,
  Phone,
  Mail,
  UserCheck,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Contact, NativePickedContact, LocationData } from '../types';
import { NativeContactsService } from '../services/nativeContactsService';
import { StorageService } from '../services/storage';

interface NativeContactSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContacts: Contact[];
  onContactsUpdated: (updatedContacts: Contact[]) => void;
  location: LocationData | null;
}

export const NativeContactSyncModal: React.FC<NativeContactSyncModalProps> = ({
  isOpen,
  onClose,
  existingContacts,
  onContactsUpdated,
  location
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Pending contacts picked from device or file for user to review/tag
  const [stagedContacts, setStagedContacts] = useState<Array<NativePickedContact & {
    relationship: string;
    isPrimary: boolean;
    canSeeLocation: boolean;
    canSeePregnancyUpdates: boolean;
    isDuplicate: boolean;
  }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const caps = NativeContactsService.getSyncCapabilities();

  // 1. Pick Directly From Device Address Book (Android Bridge or W3C API)
  const handlePickFromDevice = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const pickedList = await NativeContactsService.pickFromDevice({ multiple: true });

      if (pickedList.length === 0) {
        setErrorMessage('No contact was selected.');
        setLoading(false);
        return;
      }

      // Prepare staged items with duplicate detection
      const staged = pickedList.map((p, idx) => {
        const isDup = NativeContactsService.isDuplicate(p.phone, existingContacts);
        return {
          ...p,
          relationship: idx === 0 && existingContacts.length === 0 ? 'Parent' : 'Family',
          isPrimary: idx === 0 && !existingContacts.some(c => c.isPrimary),
          canSeeLocation: true,
          canSeePregnancyUpdates: false,
          isDuplicate: isDup
        };
      });

      setStagedContacts(staged);
      setSuccessMessage(`Successfully retrieved ${staged.length} contact(s) from your device address book.`);
    } catch (err: any) {
      if (err.message === 'UNSUPPORTED_NATIVE_PICKER') {
        setErrorMessage('Direct address book picking is not available in this browser. Please use the "Import .vcf / Contacts File" option below.');
      } else {
        setErrorMessage(err.message || 'Unable to access device address book.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Import Contacts from vCard (.vcf) or CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: NativePickedContact[] = [];

        if (file.name.endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
          parsed = NativeContactsService.parseVCard(text);
        } else if (file.name.endsWith('.csv') || text.includes(',')) {
          parsed = NativeContactsService.parseCSV(text);
        } else {
          parsed = NativeContactsService.parseVCard(text);
          if (parsed.length === 0) {
            parsed = NativeContactsService.parseCSV(text);
          }
        }

        if (parsed.length === 0) {
          setErrorMessage('Could not parse any contacts from this file. Ensure it is a valid .vcf vCard or CSV.');
          setLoading(false);
          return;
        }

        const staged = parsed.map((p, idx) => {
          const isDup = NativeContactsService.isDuplicate(p.phone, existingContacts);
          return {
            ...p,
            relationship: 'Family',
            isPrimary: idx === 0 && !existingContacts.some(c => c.isPrimary),
            canSeeLocation: true,
            canSeePregnancyUpdates: false,
            isDuplicate: isDup
          };
        });

        setStagedContacts(staged);
        setSuccessMessage(`Loaded ${staged.length} contact(s) from "${file.name}".`);
      } catch (err: any) {
        setErrorMessage(`Failed to read contacts file: ${err.message}`);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read selected file.');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  // 3. Confirm and Save Staged Contacts into StorageService with validation & duplicate prevention
  const handleSaveStagedContacts = () => {
    if (stagedContacts.length === 0) return;

    setErrorMessage(null);
    let savedCount = 0;
    let skippedErrors: string[] = [];

    for (const staged of stagedContacts) {
      const currentList = StorageService.getContacts();
      const rawPhone = staged.phone.trim();
      const normalized = NativeContactsService.normalizePhoneNumber(rawPhone);
      const phoneCheck = NativeContactsService.validateAndNormalizePhone(normalized);

      if (!staged.name.trim()) {
        skippedErrors.push('Contact name is required.');
        continue;
      }
      if (!phoneCheck.valid) {
        skippedErrors.push(`${staged.name}: ${phoneCheck.error || 'Invalid phone number'}`);
        continue;
      }
      if (NativeContactsService.isDuplicate(phoneCheck.normalizedPhone, currentList)) {
        skippedErrors.push(`${staged.name}: Duplicate number (${phoneCheck.normalizedPhone})`);
        continue;
      }

      try {
        StorageService.addContact({
          id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: staged.name.trim(),
          phone: phoneCheck.normalizedPhone,
          relationship: staged.relationship || '',
          isPrimary: staged.isPrimary,
          isBackupRelay: !staged.isPrimary,
          canSeeLocation: staged.canSeeLocation,
          canSeePregnancyUpdates: staged.canSeePregnancyUpdates,
          email: staged.email?.trim(),
          syncedFromDevice: true
        });
        savedCount++;
      } catch (err: any) {
        skippedErrors.push(`${staged.name}: ${err?.message || 'Storage error'}`);
      }
    }

    const updatedList = StorageService.getContacts();
    onContactsUpdated(updatedList);

    if (savedCount === 0) {
      setErrorMessage(skippedErrors.join(' • ') || 'Could not save contacts. Check phone numbers and duplicates.');
      return;
    }

    setStagedContacts([]);
    setSuccessMessage(
      skippedErrors.length > 0
        ? `Saved ${savedCount} contact(s). Skipped ${skippedErrors.length}: ${skippedErrors[0]}`
        : `Saved ${savedCount} emergency contact(s) to your Emergency Contacts.`
    );
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // 4. Export Existing Emergency Contacts to .vcf
  const handleExportContacts = () => {
    if (existingContacts.length === 0) {
      setErrorMessage('No emergency contacts available to export.');
      return;
    }
    NativeContactsService.downloadVCard(existingContacts);
    setSuccessMessage('Emergency contacts address book (.vcf) downloaded.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-950 border border-purple-600 flex items-center justify-center text-purple-400 shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Device Address Book Sync</h2>
              <p className="text-xs text-slate-400">Sync trusted contacts directly from your phone for rapid SOS alert dispatch</p>
            </div>
          </div>
        </div>

        {/* Device Capability Badge */}
        <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">{caps.label}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  caps.isNativeSupported
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border-amber-700'
                }`}>
                  {caps.isNativeSupported ? 'Direct Sync Active' : 'File Fallback Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{caps.description}</p>
            </div>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Sync Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Main Direct Phone Contacts Picker */}
          <button
            onClick={handlePickFromDevice}
            disabled={loading}
            className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2.5 shadow-lg shadow-purple-950/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Accessing Address Book...</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-purple-200" />
                <span>Select Contacts from Phone</span>
              </>
            )}
          </button>

          {/* Import vCard (.vcf) or CSV file fallback */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".vcf,.csv,text/vcard,text/csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-2.5 transition-colors disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              <span>Import .vcf (vCard) / CSV File</span>
            </button>
          </div>
        </div>

        {/* Review & Staging Area for Selected Contacts */}
        {stagedContacts.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span>Review &amp; Tag Picked Contacts ({stagedContacts.length})</span>
              </h3>
              <button
                onClick={() => setStagedContacts([])}
                className="text-[11px] text-slate-400 hover:text-rose-400 font-semibold"
              >
                Clear Selection
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {stagedContacts.map((contact, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    contact.isDuplicate
                      ? 'bg-amber-950/30 border-amber-800/60'
                      : 'bg-slate-850 border-slate-750'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black text-white">{contact.name}</span>
                        {contact.isDuplicate && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 uppercase">
                            Already in Circle
                          </span>
                        )}
                        {contact.source && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400">
                            {contact.source}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        <span className="flex items-center space-x-1 font-mono text-cyan-300">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{contact.phone || 'No phone number'}</span>
                        </span>
                        {contact.email && (
                          <span className="flex items-center space-x-1 text-slate-400">
                            <Mail className="w-3 h-3" />
                            <span>{contact.email}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setStagedContacts(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors self-end sm:self-center"
                      title="Remove from staging"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Relationship and Priority Controls */}
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block mb-1">Relationship</label>
                      <select
                        value={contact.relationship}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStagedContacts(prev => prev.map((item, i) => i === idx ? { ...item, relationship: val } : item));
                        }}
                        className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
                      >
                        <option value="Parent">Parent</option>
                        <option value="Spouse/Partner">Spouse / Partner</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Family">Family Member</option>
                        <option value="Friend">Trusted Friend</option>
                        <option value="Colleague">Colleague / Peer</option>
                        <option value="Doctor">Doctor / Caregiver</option>
                        <option value="Security">Security / Campus Safety</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={contact.isPrimary}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setStagedContacts(prev => prev.map((item, i) => {
                              if (i === idx) return { ...item, isPrimary: checked };
                              if (checked) return { ...item, isPrimary: false };
                              return item;
                            }));
                          }}
                          className="rounded text-purple-600 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-xs text-white font-bold flex items-center space-x-1">
                          <Star className={`w-3.5 h-3.5 ${contact.isPrimary ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                          <span>Primary SOS Alert Recipient</span>
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={contact.canSeeLocation}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setStagedContacts(prev => prev.map((item, i) => i === idx ? { ...item, canSeeLocation: checked } : item));
                          }}
                          className="rounded text-emerald-600 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-[11px] text-slate-300">Grant SafeWalk Live Location Access</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirm Save Button */}
            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setStagedContacts([])}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStagedContacts}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-950 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save {stagedContacts.length} Contact(s) to Safety Circle</span>
              </button>
            </div>
          </div>
        )}

        {/* Existing Contacts Export & Quick Summary */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            <span>Currently Active: </span>
            <span className="text-white font-bold">{existingContacts.length} Emergency Contact(s)</span>
            {existingContacts.some(c => c.isPrimary) && (
              <span className="text-amber-400 font-semibold ml-2">
                • Primary: {existingContacts.find(c => c.isPrimary)?.name}
              </span>
            )}
          </div>

          <button
            onClick={handleExportContacts}
            disabled={existingContacts.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Export to Phone (.vcf)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
