import { Contact, NativePickedContact, LocationData } from '../types';



export interface SyncCapability {
  mode: 'android-bridge' | 'w3c-api' | 'vcard-fallback';
  label: string;
  isNativeSupported: boolean;
  canPickMultiple: boolean;
  description: string;
}

export const NativeContactsService = {
  /**
   * Check if device native contact picker API or Android Bridge is available
   */
  isContactPickerSupported(): boolean {
    const hasAndroidBridge = typeof window !== 'undefined' &&
      typeof window.SmartShieldAndroidBridge?.pickNativeContact === 'function';
    
    const hasW3CContacts = typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window &&
      typeof (navigator as any).contacts?.select === 'function';

    return hasAndroidBridge || hasW3CContacts;
  },

  /**
   * Determine exact synchronization capability of current device/browser
   */
  getSyncCapabilities(): SyncCapability {
    if (typeof window !== 'undefined' && typeof window.SmartShieldAndroidBridge?.pickNativeContact === 'function') {
      return {
        mode: 'android-bridge',
        label: 'Android Native Address Book Bridge',
        isNativeSupported: true,
        canPickMultiple: false,
        description: 'Launches native Android contact picker intent with zero broad permission prompts.'
      };
    }

    if (
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window &&
      typeof (navigator as any).contacts?.select === 'function'
    ) {
      return {
        mode: 'w3c-api',
        label: 'Mobile Browser Contact Picker',
        isNativeSupported: true,
        canPickMultiple: true,
        description: 'W3C Contact Picker API connects directly to your phone’s address book.'
      };
    }

    return {
      mode: 'vcard-fallback',
      label: 'Address Book File Sync (vCard / CSV)',
      isNativeSupported: false,
      canPickMultiple: true,
      description: 'Import contacts directly from an exported .vcf (vCard) or contacts CSV from your device.'
    };
  },

  /**
   * Normalize and sanitize phone number strings to international format (+CC...)
   * for reliable SMS/SOS dispatch.
   */
  normalizePhoneNumber(raw: string, defaultCountryCode = '+91'): string {
    if (!raw) return '';
    let cleaned = raw.trim();

    // Replace leading '00' with '+' for international notation
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.slice(2).trim();
    }

    const hasLeadingPlus = cleaned.startsWith('+');
    const digitsOnly = cleaned.replace(/\D/g, '');

    if (!digitsOnly) return '';

    let intlDigits = digitsOnly;
    if (!hasLeadingPlus) {
      // If 10-digit Indian mobile number (starts with 6,7,8,9), normalize with defaultCountryCode (+91)
      if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly) && defaultCountryCode) {
        const ccDigits = defaultCountryCode.replace(/\D/g, '') || '91';
        intlDigits = `${ccDigits}${digitsOnly}`;
      } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^[6-9]/.test(digitsOnly.slice(1))) {
        const ccDigits = defaultCountryCode.replace(/\D/g, '') || '91';
        intlDigits = `${ccDigits}${digitsOnly.slice(1)}`;
      }
    }

    const withPlus = (hasLeadingPlus || intlDigits !== digitsOnly || intlDigits.length >= 11)
      ? `+${intlDigits}`
      : `+${intlDigits}`;

    // Format readable for international numbers while retaining leading + country code
    if (intlDigits.startsWith('91') && intlDigits.length === 12) {
      return `+91 ${intlDigits.slice(2, 7)} ${intlDigits.slice(7)}`;
    }
    if (intlDigits.startsWith('1') && intlDigits.length === 11) {
      return `+1 ${intlDigits.slice(1, 4)} ${intlDigits.slice(4, 7)} ${intlDigits.slice(7)}`;
    }
    if (intlDigits.startsWith('44') && intlDigits.length === 12) {
      return `+44 ${intlDigits.slice(2, 6)} ${intlDigits.slice(6)}`;
    }

    return withPlus;
  },

  /**
   * Strict validation for emergency contact phone numbers with country code.
   */
  validateAndNormalizePhone(rawPhone: string): {
    valid: boolean;
    normalizedPhone: string;
    e164Phone: string;
    error?: string;
  } {
    const trimmed = (rawPhone || '').trim();
    if (!trimmed) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Mobile number with country code is required (e.g., +91 98765 43210).'
      };
    }

    // Reject letters or unexpected characters
    if (/[^0-9+\s\-().]/.test(trimmed)) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Phone number contains invalid characters. Use only digits and country code (e.g., +91 98765 43210).'
      };
    }

    let working = trimmed;
    if (working.startsWith('00')) {
      working = '+' + working.slice(2).trim();
    }

    // Must start with '+' country code (or be a 10-digit mobile that user prefixed via country code selector)
    if (!working.startsWith('+')) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Please include the country code starting with "+" (for example, +91 98765 43210 or +1 555 234 5678).'
      };
    }

    const digitsOnly = working.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Please enter a valid international mobile number (8 to 15 digits including country code).'
      };
    }

    // Check specific country length rules for common country codes (+91 India requires 10 subscriber digits = 12 total)
    if (digitsOnly.startsWith('91') && digitsOnly.length !== 12) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Indian (+91) mobile numbers must have 10 digits after +91 (e.g., +91 98765 43210).'
      };
    }

    if (/^(\d)\1+$/.test(digitsOnly) || digitsOnly.endsWith('00000000')) {
      return {
        valid: false,
        normalizedPhone: '',
        e164Phone: '',
        error: 'Please enter a real, valid emergency contact phone number.'
      };
    }

    const normalizedPhone = this.normalizePhoneNumber(`+${digitsOnly}`);
    return {
      valid: true,
      normalizedPhone,
      e164Phone: `+${digitsOnly}`
    };
  },

  /**
   * Compares two phone numbers by their digits to detect duplicates.
   * Supports optional excludeContactId when editing an existing contact.
   */
  isDuplicate(phone: string, existingContacts: Contact[], excludeContactId?: string): boolean {
    const rawDigits = (phone || '').replace(/\D/g, '');
    if (!rawDigits || rawDigits.length < 7) return false;

    const targetTail = rawDigits.slice(-10);

    return existingContacts.some(c => {
      if (excludeContactId && c.id === excludeContactId) return false;
      const existingDigits = (c.phone || '').replace(/\D/g, '');
      if (!existingDigits) return false;
      return existingDigits === rawDigits || existingDigits.slice(-10) === targetTail;
    });
  },

  /**
   * Pick contacts directly from the device's native address book.
   * Seamlessly handles Android Intent bridge and W3C Contact Picker API.
   */
  async pickFromDevice(options?: { multiple?: boolean }): Promise<NativePickedContact[]> {
    const caps = this.getSyncCapabilities();

    // Strategy 1: Android Native WebView Bridge
    if (caps.mode === 'android-bridge' && window.SmartShieldAndroidBridge?.pickNativeContact) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Address book selection timed out or was dismissed.'));
        }, 45000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          window.onAndroidContactPicked = undefined;
          window.onAndroidContactPickerCancelled = undefined;
        };

        window.onAndroidContactPicked = (result) => {
          cleanup();
          if (result && result.status !== 'error' && (result.name || result.phone)) {
            const rawName = (result.name || 'Device Contact').trim();
            const rawPhone = (result.phone || '').trim();
            const cleanPhone = NativeContactsService.normalizePhoneNumber(rawPhone);
            resolve([
              {
                name: rawName,
                phone: cleanPhone || rawPhone,
                email: result.email?.trim(),
                source: 'android-picker'
              }
            ]);
          } else {
            reject(new Error(result.error || 'No contact was selected from the address book.'));
          }
        };

        window.onAndroidContactPickerCancelled = () => {
          cleanup();
          reject(new Error('Contact picker cancelled by user.'));
        };

        try {
          if (window.SmartShieldAndroidBridge?.pickNativeContact) {
            window.SmartShieldAndroidBridge.pickNativeContact();
          } else {
            cleanup();
            reject(new Error('Android contact picker bridge is not initialized.'));
          }
        } catch (err: any) {
          cleanup();
          reject(new Error(`Failed to invoke Android contact picker: ${err?.message || err}`));
        }
      });
    }

    // Strategy 2: W3C Contact Picker API (Chrome for Android, Edge Mobile, Samsung Internet)
    if (caps.mode === 'w3c-api' && (navigator as any).contacts?.select) {
      try {
        const props = ['name', 'tel', 'email'];
        const results = await (navigator as any).contacts.select(props, {
          multiple: options?.multiple ?? true
        });

        if (!Array.isArray(results) || results.length === 0) {
          return [];
        }

        const pickedList: NativePickedContact[] = [];

        for (const item of results) {
          const rawName = Array.isArray(item.name) ? item.name[0] : item.name || 'Device Contact';
          const phones = Array.isArray(item.tel) ? item.tel : item.tel ? [item.tel] : [];
          const emails = Array.isArray(item.email) ? item.email : item.email ? [item.email] : [];

          if (phones.length > 0) {
            for (const p of phones) {
              const clean = NativeContactsService.normalizePhoneNumber(p);
              if (clean) {
                pickedList.push({
                  name: rawName.trim(),
                  phone: clean,
                  email: emails[0]?.trim(),
                  source: 'w3c-contact-picker'
                });
                break; // Take primary number per contact
              }
            }
          } else if (rawName) {
            pickedList.push({
              name: rawName.trim(),
              phone: '',
              email: emails[0]?.trim(),
              source: 'w3c-contact-picker'
            });
          }
        }

        return pickedList;
      } catch (err: any) {
        if (err.name === 'SecurityError' || err.name === 'AbortError') {
          throw new Error('Contact picker was cancelled or permission was dismissed.');
        }
        throw new Error(`Contact Picker Error: ${err.message || 'Unable to open contacts'}`);
      }
    }

    throw new Error('UNSUPPORTED_NATIVE_PICKER');
  },

  /**
   * Parse vCard (.vcf) address book export format (supports vCard 2.1, 3.0, 4.0)
   */
  parseVCard(vcfText: string): NativePickedContact[] {
    const contacts: NativePickedContact[] = [];
    if (!vcfText || !vcfText.includes('BEGIN:VCARD')) {
      return contacts;
    }

    // Split text into individual VCARD records
    const vcardBlocks = vcfText.split(/BEGIN:VCARD/i).slice(1);

    for (const block of vcardBlocks) {
      const lines = block.split(/\r\n|\r|\n/);
      let name = '';
      let phone = '';
      let email = '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Formatted Name (FN:)
        if (trimmed.toUpperCase().startsWith('FN:')) {
          name = trimmed.slice(3).trim();
        } else if (!name && trimmed.toUpperCase().startsWith('FN;')) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) name = trimmed.slice(colonIdx + 1).trim();
        }

        // Structured Name (N:Last;First;Middle;;) fallback if FN missing
        if (!name && trimmed.toUpperCase().startsWith('N:')) {
          const parts = trimmed.slice(2).split(';').map(p => p.trim()).filter(Boolean);
          if (parts.length > 1) {
            name = `${parts[1]} ${parts[0]}`.trim();
          } else if (parts.length === 1) {
            name = parts[0];
          }
        }

        // Telephone (TEL...:number)
        if (!phone && trimmed.toUpperCase().startsWith('TEL')) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) {
            const rawNum = trimmed.slice(colonIdx + 1).trim();
            phone = this.normalizePhoneNumber(rawNum) || rawNum;
          }
        }

        // Email (EMAIL...:email)
        if (!email && trimmed.toUpperCase().startsWith('EMAIL')) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx !== -1) {
            email = trimmed.slice(colonIdx + 1).trim();
          }
        }
      }

      if (name || phone) {
        contacts.push({
          name: name || 'Address Book Contact',
          phone: phone,
          email: email || undefined,
          source: 'vcard-import'
        });
      }
    }

    return contacts;
  },

  /**
   * Parse contacts from a CSV file (e.g. Google Contacts CSV or standard Name, Phone, Email)
   */
  parseCSV(csvText: string): NativePickedContact[] {
    const list: NativePickedContact[] = [];
    const lines = csvText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return list;

    // Find headers
    const headerRow = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    let nameIdx = headerRow.findIndex(h => h.includes('name') || h === 'fn' || h === 'display name');
    let phoneIdx = headerRow.findIndex(h => h.includes('phone') || h.includes('tel') || h.includes('mobile'));
    let emailIdx = headerRow.findIndex(h => h.includes('email') || h.includes('mail'));

    if (nameIdx === -1 && phoneIdx === -1) {
      // Default to columns 0 (Name), 1 (Phone), 2 (Email)
      nameIdx = 0;
      phoneIdx = 1;
      emailIdx = 2;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const rawName = cols[nameIdx] || '';
      const rawPhone = cols[phoneIdx] || '';
      const rawEmail = emailIdx !== -1 ? cols[emailIdx] : '';

      if (rawName || rawPhone) {
        list.push({
          name: rawName || 'Imported Contact',
          phone: this.normalizePhoneNumber(rawPhone) || rawPhone,
          email: rawEmail || undefined,
          source: 'vcard-import'
        });
      }
    }

    return list;
  },

  /**
   * Export Smart Shield emergency contacts into standard vCard 3.0 string
   */
  exportToVCard(contacts: Contact[]): string {
    return contacts
      .map(c => {
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${c.name}`,
          `TEL;TYPE=CELL,VOICE:${c.phone}`,
          c.email ? `EMAIL:${c.email}` : '',
          `NOTE:Smart Shield Emergency Contact • Relationship: ${c.relationship}${c.isPrimary ? ' (PRIMARY SOS)' : ''}`,
          'END:VCARD'
        ].filter(Boolean).join('\r\n');
      })
      .join('\r\n\r\n');
  },

  /**
   * Trigger direct file download of the emergency contacts vCard
   */
  downloadVCard(contacts: Contact[], filename = 'smartshield_emergency_contacts.vcf') {
    const vcardContent = this.exportToVCard(contacts);
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Convert a picked contact into full Smart Shield Contact data model
   */
  createContactFromPicked(
    picked: NativePickedContact,
    relationship = 'Parent',
    isPrimary = false
  ): Contact {
    const colors = [
      'from-rose-500 to-pink-600',
      'from-purple-500 to-indigo-600',
      'from-cyan-500 to-blue-600',
      'from-teal-500 to-emerald-600',
      'from-amber-500 to-orange-600'
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    return {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: picked.name.trim() || 'Emergency Contact',
      phone: picked.phone.trim(),
      relationship: relationship,
      isPrimary: isPrimary,
      isBackupRelay: !isPrimary,
      canSeeLocation: true,
      canSeePregnancyUpdates: false,
      email: picked.email?.trim(),
      syncedFromDevice: true,
      lastSyncedAt: new Date().toISOString(),
      avatarColor: avatarColor
    };
  },

  /**
   * Checks whether a LocationData object contains valid, current/usable coordinates
   */
  hasValidCoordinates(location: LocationData | null | undefined): location is LocationData {
    if (!location) return false;
    const { latitude, longitude, status } = location;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    if (latitude === 0 && longitude === 0) return false;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
    if (status === 'unavailable') return false;
    return true;
  },

  /**
   * Build the standardized Smart Shield emergency SOS alert message.
   * Format:
   * "EMERGENCY ALERT! I need immediate assistance. My Smart Shield SOS has been activated. My current location is: [Google Maps link / pending]. Please contact me and arrange help immediately."
   */
  buildEmergencySmsBody(
    contactOrLocation?: Contact | LocationData | null,
    maybeLocation?: LocationData | null,
    senderDetails?: { userName?: string; phone?: string; timestamp?: string }
  ): string {
    let location: LocationData | null = null;
    if (maybeLocation !== undefined) {
      location = maybeLocation;
    } else if (contactOrLocation && 'latitude' in contactOrLocation) {
      location = contactOrLocation as LocationData;
    }

    const timeStr = senderDetails?.timestamp || new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    });
    const senderName = senderDetails?.userName?.trim();
    const senderPhone = senderDetails?.phone?.trim();

    const namePrefix = senderName ? `${senderName}: ` : '';
    const callbackText = senderPhone ? ` Call me back at: ${senderPhone}.` : '';

    if (this.hasValidCoordinates(location)) {
      const mapsLink = `https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
      return `EMERGENCY ALERT! ${namePrefix}I need immediate assistance. My Smart Shield SOS has been activated at ${timeStr}. My current location is: ${mapsLink} . Please contact me and arrange help immediately.${callbackText}`;
    }

    return `EMERGENCY ALERT! ${namePrefix}I need immediate assistance. My Smart Shield SOS has been activated at ${timeStr}. My current location is: Unavailable (GPS signal pending — I will send updated coordinates as soon as GPS locks). Please contact me and arrange help immediately.${callbackText}`;
  },

  /**
   * Construct native OS-compatible SMS dispatch URL (supports single or multiple recipients)
   */
  getDirectSmsUrl(phoneOrPhones: string | string[], bodyText: string): string {
    const phones = Array.isArray(phoneOrPhones) ? phoneOrPhones : [phoneOrPhones];
    const cleanPhones = phones
      .map(p => (p || '').replace(/[^\d+]/g, ''))
      .filter(Boolean);
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const recipientJoiner = isIOS ? ',' : ';';
    const recipientStr = cleanPhones.join(recipientJoiner);
    const encodedBody = encodeURIComponent(bodyText);
    const separator = isIOS ? '&' : '?';
    return `sms:${recipientStr}${separator}body=${encodedBody}`;
  },

  /**
   * Construct native tel: URL for fast one-tap phone call
   */
  getDirectCallUrl(phone: string): string {
    const cleanPhone = (phone || '').replace(/[^\d+]/g, '');
    return `tel:${cleanPhone}`;
  }
};
