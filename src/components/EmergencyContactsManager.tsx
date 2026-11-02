import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  MessageSquare,
  Edit3,
  Trash2,
  Star,
  CheckCircle2,
  AlertTriangle,
  X,
  Smartphone,
  Download,
  Send,
  ShieldCheck,
  Loader2,
  Radio,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Contact, LocationData } from '../types';
import { StorageService } from '../services/storage';
import { NativeContactsService } from '../services/nativeContactsService';
import { sosAlertService } from '../services/sosAlertService';
import { NativeContactSyncModal } from './NativeContactSyncModal';

interface EmergencyContactsManagerProps {
  contacts: Contact[];
  onUpdateContacts: (contacts: Contact[]) => void;
  location: LocationData | null;
  autoOpenAddForm?: boolean;
  onAutoOpenHandled?: () => void;
  compact?: boolean;
}

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (India)' },
  { code: '+1', label: '🇺🇸 +1 (US / Canada)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+61', label: '🇦🇺 +61 (Australia)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+65', label: '🇸🇬 +65 (Singapore)' },
  { code: '+49', label: '🇩🇪 +49 (Germany)' },
  { code: '+33', label: '🇫🇷 +33 (France)' }
];

export const EmergencyContactsManager: React.FC<EmergencyContactsManagerProps> = ({
  contacts,
  onUpdateContacts,
  location,
  autoOpenAddForm = false,
  onAutoOpenHandled,
  compact = false
}) => {
  // Add / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneInput, setPhoneInput] = useState('+91 ');
  const [relationshipInput, setRelationshipInput] = useState('');
  const [isPrimaryInput, setIsPrimaryInput] = useState(false);

  // Status & Feedback Banners
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Delete Confirmation Modal State
  const [contactPendingDelete, setContactPendingDelete] = useState<Contact | null>(null);

  // Test Contact Alert State
  const [testingContactId, setTestingContactId] = useState<string | null>(null);

  // Device Address Book Sync Modal
  const [showSyncModal, setShowSyncModal] = useState(false);

  // SMS Gateway Diagnostics State
  const [gatewayInfo, setGatewayInfo] = useState<{
    providerConfigured: boolean;
    activeProvider: string;
    channels?: any;
    diagnosticGuidance?: string;
  } | null>(null);
  const [showGatewayDetails, setShowGatewayDetails] = useState(false);

  useEffect(() => {
    if (autoOpenAddForm) {
      openAddContactForm();
      onAutoOpenHandled?.();
    }
    sosAlertService.checkSmsGatewayDiagnosticStatus().then((info) => setGatewayInfo(info)).catch(() => {});
  }, [autoOpenAddForm]);

  const showBanner = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedbackBanner({ type, text });
  };

  const openAddContactForm = () => {
    setEditingContactId(null);
    setNameInput('');
    setCountryCode('+91');
    setPhoneInput('+91 ');
    setRelationshipInput('');
    setIsPrimaryInput(contacts.length === 0);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditContactForm = (contact: Contact) => {
    setEditingContactId(contact.id);
    setNameInput(contact.name);
    const trimmedPhone = contact.phone.trim();
    const matchedPrefix = COUNTRY_CODES.find((c) => trimmedPhone.startsWith(c.code));
    if (matchedPrefix) {
      setCountryCode(matchedPrefix.code);
    }
    setPhoneInput(trimmedPhone);
    setRelationshipInput(contact.relationship || '');
    setIsPrimaryInput(Boolean(contact.isPrimary));
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingContactId(null);
    setFormError(null);
  };

  const handleCountryCodeChange = (newCode: string) => {
    const oldCode = countryCode;
    setCountryCode(newCode);
    const trimmed = phoneInput.trim();
    if (!trimmed || trimmed === oldCode) {
      setPhoneInput(`${newCode} `);
    } else if (trimmed.startsWith(oldCode)) {
      setPhoneInput(`${newCode} ${trimmed.slice(oldCode.length).trim()}`);
    } else if (!trimmed.startsWith('+')) {
      setPhoneInput(`${newCode} ${trimmed}`);
    }
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanedName = nameInput.trim();
    if (!cleanedName) {
      setFormError('Contact name is required.');
      return;
    }
    if (cleanedName.length < 2) {
      setFormError('Contact name must be at least 2 characters long.');
      return;
    }
    if (/^\d+$/.test(cleanedName)) {
      setFormError('Please enter a valid contact name (cannot be numbers only).');
      return;
    }

    // Prepare phone with country code if user typed digits without leading '+'
    let rawPhoneToValidate = phoneInput.trim();
    if (rawPhoneToValidate && !rawPhoneToValidate.startsWith('+') && !rawPhoneToValidate.startsWith('00')) {
      rawPhoneToValidate = `${countryCode} ${rawPhoneToValidate}`;
    }

    const phoneValidation = NativeContactsService.validateAndNormalizePhone(rawPhoneToValidate);
    if (!phoneValidation.valid) {
      setFormError(
        phoneValidation.error ||
          'Please enter a valid mobile number with country code (e.g., +91 98765 43210).'
      );
      return;
    }

    // Check for duplicate contact phone number
    if (
      NativeContactsService.isDuplicate(
        phoneValidation.normalizedPhone,
        contacts,
        editingContactId || undefined
      )
    ) {
      setFormError(
        `A contact with the number ${phoneValidation.normalizedPhone} is already saved in your Emergency Contacts.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const cleanedRelationship = relationshipInput.trim();

      if (editingContactId) {
        const existing = contacts.find((c) => c.id === editingContactId);
        const updatedContact: Contact = {
          ...(existing || {}),
          id: editingContactId,
          name: cleanedName,
          phone: phoneValidation.normalizedPhone,
          relationship: cleanedRelationship,
          isPrimary: isPrimaryInput || contacts.length === 1,
          isBackupRelay: !(isPrimaryInput || contacts.length === 1),
          canSeeLocation: existing?.canSeeLocation ?? true,
          canSeePregnancyUpdates: existing?.canSeePregnancyUpdates ?? false
        };
        const updatedList = StorageService.updateContact(updatedContact);
        onUpdateContacts(updatedList);
        showBanner(
          'success',
          `Updated emergency contact "${cleanedName}" (${phoneValidation.normalizedPhone}).`
        );
      } else {
        const newContact: Contact = {
          id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: cleanedName,
          phone: phoneValidation.normalizedPhone,
          relationship: cleanedRelationship,
          isPrimary: isPrimaryInput || contacts.length === 0,
          isBackupRelay: !(isPrimaryInput || contacts.length === 0),
          canSeeLocation: true,
          canSeePregnancyUpdates: false
        };
        const updatedList = StorageService.addContact(newContact);
        onUpdateContacts(updatedList);
        showBanner(
          'success',
          `Saved emergency contact "${cleanedName}" (${phoneValidation.normalizedPhone}).`
        );
      }

      closeForm();
    } catch (err: any) {
      setFormError(
        err?.message || 'Failed to save contact to device storage. Please check storage permissions.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteContact = () => {
    if (!contactPendingDelete) return;
    try {
      const targetName = contactPendingDelete.name;
      const updatedList = StorageService.deleteContact(contactPendingDelete.id);
      onUpdateContacts(updatedList);
      setContactPendingDelete(null);
      showBanner('info', `Deleted "${targetName}" from your Emergency Contacts.`);
    } catch (err: any) {
      setContactPendingDelete(null);
      showBanner('error', err?.message || 'Could not delete contact from storage.');
    }
  };

  const handleSetPrimary = (contactId: string) => {
    try {
      const updatedList = StorageService.setPrimaryContact(contactId);
      onUpdateContacts(updatedList);
      const primary = updatedList.find((c) => c.id === contactId);
      if (primary) {
        showBanner('success', `"${primary.name}" is now your Primary SOS Contact.`);
      }
    } catch (err: any) {
      showBanner('error', err?.message || 'Failed to update primary contact.');
    }
  };

  const handleTestContactAlert = (contact: Contact) => {
    setTestingContactId(contact.id);
    const hasCoords = NativeContactsService.hasValidCoordinates(location);
    const mapsPart = hasCoords
      ? `https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`
      : 'Unavailable (GPS signal pending)';
    const testMessage = `SMART SHIELD TEST ALERT: Hi ${contact.name}, I have added you as a trusted emergency contact on my Smart Shield safety app. Current location test: ${mapsPart} . No emergency action is needed right now.`;

    const cleanPhone = '+' + contact.phone.replace(/\D/g, '');
    if (
      typeof window !== 'undefined' &&
      typeof window.SmartShieldAndroidBridge?.openSmsComposer === 'function'
    ) {
      window.SmartShieldAndroidBridge.openSmsComposer(cleanPhone, testMessage);
    } else if (typeof window !== 'undefined') {
      window.location.href = NativeContactsService.getDirectSmsUrl(cleanPhone, testMessage);
    }

    showBanner(
      'info',
      `Opened test message for "${contact.name}" (${contact.phone}) so you can verify delivery.`
    );
    setTimeout(() => setTestingContactId(null), 1500);
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-black text-white">Emergency Contacts</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
              {contacts.length} Saved
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant SOS alerts are sent strictly to the verified contacts you add and save here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAddContactForm}
            data-testid="add-emergency-contact-btn"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>

          {!compact && (
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Import from Phone Address Book"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import from Phone</span>
            </button>
          )}

          {!compact && contacts.length > 0 && (
            <button
              type="button"
              onClick={() => NativeContactsService.downloadVCard(contacts)}
              className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Export Saved Contacts (.vcf)"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SMS Gateway & Telephony Diagnostics Status */}
      {gatewayInfo && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className={`w-4 h-4 ${gatewayInfo.providerConfigured ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
              <span className="text-xs font-bold text-white">SMS Dispatch Gateway:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                gatewayInfo.providerConfigured
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {gatewayInfo.activeProvider}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowGatewayDetails(!showGatewayDetails)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer"
            >
              <span>{showGatewayDetails ? 'Hide Diagnostics' : 'Gateway Diagnostics'}</span>
              {showGatewayDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showGatewayDetails && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2 animate-in fade-in">
              <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                {gatewayInfo.diagnosticGuidance}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">📱 Android Native SMS:</span>
                  <span className={gatewayInfo.channels?.androidNativeSms?.supportedInApk ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {gatewayInfo.channels?.androidNativeSms?.supportedInApk ? 'Active (APK Bridge)' : 'Inactive (Web Preview)'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">☁️ Twilio Cloud Gateway:</span>
                  <span className={gatewayInfo.channels?.twilio?.configured ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {gatewayInfo.channels?.twilio?.configured ? 'Active (.env Ready)' : 'Unconfigured'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">📡 SIM800L Hardware GSM:</span>
                  <span className="text-emerald-400 font-bold">Supported (ESP32-C3)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Banner (Success / Error / Info) */}
      {feedbackBanner && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200'
              : feedbackBanner.type === 'error'
                ? 'bg-rose-950/70 border-rose-700/80 text-rose-200'
                : 'bg-indigo-950/60 border-indigo-700/80 text-indigo-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedbackBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ADD / EDIT EMERGENCY CONTACT FORM */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveContact}
          data-testid="emergency-contact-form"
          className="p-5 rounded-2xl bg-slate-950 border-2 border-purple-600/60 space-y-4 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                {editingContactId ? 'Edit Emergency Contact' : 'Add New Emergency Contact'}
              </h4>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              data-testid="contact-form-error"
              className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-semibold flex items-start space-x-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Contact Name — Required */}
            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1.5">
                Contact Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                data-testid="contact-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter full name"
                className="w-full bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Relationship — Optional */}
            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1.5">
                Relationship <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                data-testid="contact-relationship-input"
                value={relationshipInput}
                onChange={(e) => setRelationshipInput(e.target.value)}
                placeholder="e.g., Mother, Sister, Partner, Friend"
                className="w-full bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Mobile Number with Country Code — Required */}
          <div>
            <label className="text-xs font-bold text-slate-200 block mb-1.5">
              Mobile Number with Country Code <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={countryCode}
                onChange={(e) => handleCountryCodeChange(e.target.value)}
                aria-label="Country Code"
                className="sm:w-48 bg-slate-900 text-white text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
              >
                {COUNTRY_CODES.map((cc) => (
                  <option key={cc.code} value={cc.code}>
                    {cc.label}
                  </option>
                ))}
              </select>

              <input
                type="tel"
                required
                data-testid="contact-phone-input"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+91 98765 43210"
                className="flex-1 bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Include country code starting with <code className="text-purple-300">+</code> (e.g.{' '}
              <code className="text-purple-300">+91 98765 43210</code> or{' '}
              <code className="text-purple-300">+1 555 234 5678</code>). Automatically normalized to
              international format.
            </p>
          </div>

          {/* Primary Contact Checkbox */}
          <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={isPrimaryInput}
              onChange={(e) => setIsPrimaryInput(e.target.checked)}
              className="rounded border-slate-600 text-purple-600 focus:ring-purple-500"
            />
            <span>Set as Primary Emergency Contact (first priority during SOS)</span>
          </label>

          {/* Save Contact and Cancel Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={closeForm}
              data-testid="cancel-contact-btn"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="save-contact-btn"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Contact</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* DELETE CONFIRMATION PROMPT */}
      {contactPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="delete-contact-confirm-modal"
          className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500 space-y-3 shadow-xl"
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-black text-white">
                Delete Emergency Contact "{contactPendingDelete.name}"?
              </h4>
              <p className="text-xs text-rose-200 mt-1">
                Are you sure you want to remove{' '}
                <span className="font-bold text-white">{contactPendingDelete.name}</span> (
                <span className="font-mono">{contactPendingDelete.phone}</span>)? They will no
                longer receive SOS emergency alerts.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={() => setContactPendingDelete(null)}
              data-testid="cancel-delete-contact-btn"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteContact}
              data-testid="confirm-delete-contact-btn"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-md cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Yes, Delete Contact</span>
            </button>
          </div>
        </div>
      )}

      {/* SAVED CONTACTS LIST OR EMPTY STATE */}
      {contacts.length === 0 ? (
        <div
          data-testid="empty-contacts-state"
          className="p-8 rounded-2xl bg-slate-950/80 border border-dashed border-slate-700 text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6 text-purple-300" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-extrabold text-white">
              No Emergency Contacts Saved Yet
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Smart Shield never adds fake or random contacts. Add your own trusted family members
              or friends with their country code so Instant SOS alerts can reach them immediately.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={openAddContactForm}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs inline-flex items-center space-x-2 shadow-lg cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Your First Emergency Contact</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" data-testid="saved-contacts-list">
          {contacts.map((c) => {
            const directSmsHref = NativeContactsService.getDirectSmsUrl(
              c.phone,
              NativeContactsService.buildEmergencySmsBody(c, location)
            );
            const directCallHref = NativeContactsService.getDirectCallUrl(c.phone);

            return (
              <div
                key={c.id}
                data-testid={`contact-card-${c.id}`}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  c.isPrimary
                    ? 'bg-purple-950/25 border-purple-700/70'
                    : 'bg-slate-850/90 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-rose-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <h4 className="text-sm font-extrabold text-white">{c.name}</h4>
                        {c.isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
                            ★ PRIMARY SOS
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-200 mt-0.5">{c.phone}</p>
                      {c.relationship && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {c.relationship}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit / Primary / Delete Controls */}
                  <div className="flex items-center space-x-1">
                    {!c.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(c.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title="Set as Primary SOS Contact"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditContactForm(c)}
                      data-testid={`edit-contact-${c.id}`}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Edit Contact"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactPendingDelete(c)}
                      data-testid={`delete-contact-${c.id}`}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete Contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Action Bar: Test Alert, Direct SMS, Call */}
                <div className="pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestContactAlert(c)}
                    data-testid={`test-contact-${c.id}`}
                    className="py-2 px-2.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                    title="Send a non-emergency test message to verify this contact"
                  >
                    <Send className="w-3 h-3" />
                    <span>{testingContactId === c.id ? 'Opened' : 'Test Alert'}</span>
                  </button>

                  <a
                    href={directSmsHref}
                    className="py-2 px-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors"
                    title="Open Emergency SMS for this contact"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>SOS SMS</span>
                  </a>

                  <a
                    href={directCallHref}
                    className="py-2 px-2.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors"
                    title="Call this contact immediately"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Native Phone Address Book Import Modal */}
      <NativeContactSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        existingContacts={contacts}
        onContactsUpdated={(updated) => {
          onUpdateContacts(updated);
          showBanner('success', `Imported contacts into your Emergency Contacts list.`);
        }}
        location={location}
      />
    </div>
  );
};
