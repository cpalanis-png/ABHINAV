import {
  Contact,
  LocationData,
  ContactAlertStatus,
  SOSDispatchSummary
} from '../types';
import { NativeContactsService } from './nativeContactsService';
import { AuthService } from './authService';

type SOSDispatchListener = (summary: SOSDispatchSummary | null) => void;

const RAPID_PRESS_COOLDOWN_MS = 6000;

class SOSAlertService {
  private currentSession: SOSDispatchSummary | null = null;
  private listeners: Set<SOSDispatchListener> = new Set();
  private lastDispatchTimestamp = 0;

  constructor() {
    this.initAndroidSmsBridgeListener();
  }

  private initAndroidSmsBridgeListener() {
    if (typeof window === 'undefined') return;
    window.onAndroidSmsStatusUpdate = (smsJson: string) => {
      try {
        const parsed = typeof smsJson === 'string' ? JSON.parse(smsJson) : smsJson;
        if (!parsed || !this.currentSession) return;

        const { contactId, status, errorReason } = parsed;
        const updatedContacts = this.currentSession.contactStatuses.map((cs) => {
          if (cs.contactId !== contactId) return cs;
          if (status === 'delivered') {
            return {
              ...cs,
              status: 'delivered' as const,
              channel: 'android-sms-manager' as const,
              statusLabel: 'Delivered via Android SMS',
              timestamp: new Date().toISOString(),
              errorReason: undefined
            };
          }
          if (status === 'submitted') {
            return {
              ...cs,
              status: 'submitted' as const,
              channel: 'android-sms-manager' as const,
              statusLabel: 'Sent via Android SMS',
              timestamp: new Date().toISOString(),
              errorReason: undefined
            };
          }
          return {
            ...cs,
            status: 'failed' as const,
            channel: 'android-sms-manager' as const,
            statusLabel: 'SMS Failed — Use 1-Tap SMS App or Call',
            timestamp: new Date().toISOString(),
            errorReason: errorReason || 'Android SMS transmission failed'
          };
        });

        this.recalculateAndNotify(updatedContacts);
      } catch (e) {
        console.warn('Failed to parse Android SMS status update:', e);
      }
    };
  }

  public subscribe(listener: SOSDispatchListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession ? { ...this.currentSession } : null);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCurrentSession(): SOSDispatchSummary | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  public clearSession(): void {
    this.currentSession = null;
    this.lastDispatchTimestamp = 0;
    this.notify();
  }

  private notify(): void {
    const snapshot = this.currentSession ? { ...this.currentSession } : null;
    this.listeners.forEach((l) => l(snapshot));
  }

  private recalculateAndNotify(contactStatuses: ContactAlertStatus[]): void {
    if (!this.currentSession) return;
    if (this.currentSession.overallState === 'cancelled') {
      this.currentSession = {
        ...this.currentSession,
        contactStatuses
      };
      this.notify();
      return;
    }

    const total = contactStatuses.length;
    const openedCount = contactStatuses.filter(
      (c) =>
        c.status === 'sms_composer_opened' ||
        c.status === 'submitted' ||
        c.status === 'sent' ||
        c.status === 'delivered'
    ).length;
    const failedCount = contactStatuses.filter((c) => c.status === 'failed').length;

    let overallState: SOSDispatchSummary['overallState'] = 'sms_composer_opened';
    let overallSummaryText =
      'Messaging application opened with recipient(s) and emergency text prefilled. Press Send in your SMS app to dispatch emergency messages.';

    if (total === 0) {
      overallState = 'no_contacts';
      overallSummaryText = 'Add an emergency contact before using contact-based SOS alerts';
    } else if (openedCount === total) {
      overallState = 'sms_composer_opened';
      overallSummaryText = `Messaging app opened for all ${total} saved contact${total > 1 ? 's' : ''}. Press Send in your SMS app to dispatch emergency messages.`;
    } else if (openedCount > 0) {
      overallState = 'partial_or_manual';
      overallSummaryText = `Messaging app opened for ${openedCount} of ${total} contact(s). ${failedCount} contact(s) have invalid phone numbers.`;
    } else {
      overallState = 'failed';
      overallSummaryText = `Unable to open messaging application (${failedCount}/${total} invalid numbers). Check emergency contact phone formats.`;
    }

    this.currentSession = {
      ...this.currentSession,
      contactStatuses,
      overallState,
      overallSummaryText
    };
    this.notify();
  }

  /**
   * Builds the required Smart Shield emergency message.
   */
  public buildEmergencyMessage(location: LocationData | null): {
    messageBody: string;
    locationIncluded: boolean;
    mapsUrl: string | null;
  } {
    const hasCoords = NativeContactsService.hasValidCoordinates(location);
    const mapsUrl = hasCoords
      ? `https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`
      : null;

    let senderDetails: { userName?: string; phone?: string } | undefined = undefined;
    try {
      const session = AuthService.getStoredSession();
      if (session?.user) {
        senderDetails = {
          userName: session.user.fullName,
          phone: session.user.phone
        };
      }
    } catch {}

    const messageBody = NativeContactsService.buildEmergencySmsBody(null, location, senderDetails);
    return {
      messageBody,
      locationIncluded: hasCoords,
      mapsUrl
    };
  }

  /**
   * Software-Only Android SOS Dispatch:
   * 1. Retrieves user's saved emergency contacts.
   * 2. Validates recipient phone numbers.
   * 3. Generates emergency alert message with user details and GPS map link.
   * 4. Launches native Android Messaging app (or Appilix bridge) with prefilled contacts and text.
   * 5. Displays clear status requiring user confirmation (pressing Send in SMS app).
   */
  public async dispatchInstantSOS(
    contacts: Contact[],
    initialLocation: LocationData | null,
    options?: { forceRetry?: boolean }
  ): Promise<SOSDispatchSummary> {
    // Trigger Vibration API for immediate physical haptic feedback
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        console.warn('Vibration API error:', e);
      }
    }

    const now = Date.now();
    if (
      !options?.forceRetry &&
      this.currentSession &&
      this.currentSession.overallState !== 'cancelled' &&
      now - this.lastDispatchTimestamp < RAPID_PRESS_COOLDOWN_MS
    ) {
      return this.currentSession;
    }
    this.lastDispatchTimestamp = now;

    const { messageBody, locationIncluded, mapsUrl } = this.buildEmergencyMessage(initialLocation);

    // Filter & validate user-saved contacts
    const validContacts: Contact[] = [];
    const invalidContacts: Contact[] = [];

    for (const c of contacts || []) {
      if (!c || !c.name || !c.phone) {
        if (c) invalidContacts.push(c);
        continue;
      }
      const val = NativeContactsService.validateAndNormalizePhone(c.phone);
      if (val.valid) {
        validContacts.push({
          ...c,
          phone: val.normalizedPhone
        });
      } else {
        invalidContacts.push(c);
      }
    }

    // Case 1: User has 0 saved emergency contacts
    if (contacts.length === 0 || (validContacts.length === 0 && invalidContacts.length === 0)) {
      this.currentSession = {
        sessionId: `sos_${now}`,
        startedAt: new Date(now).toISOString(),
        messageBody,
        locationIncluded,
        mapsUrl,
        overallState: 'no_contacts',
        overallSummaryText: 'Add an emergency contact before using contact-based SOS alerts',
        contactStatuses: []
      };
      this.notify();
      return this.currentSession;
    }

    // Build per-contact initial statuses
    const initialStatuses: ContactAlertStatus[] = [];

    for (const c of validContacts) {
      initialStatuses.push({
        contactId: c.id,
        contactName: c.name,
        phone: c.phone,
        relationship: c.relationship,
        status: 'sms_composer_opened',
        channel: 'native-sms-intent',
        statusLabel: 'SMS App Opened — Press Send in SMS App',
        timestamp: new Date(now).toISOString(),
        locationIncluded
      });
    }

    for (const c of invalidContacts) {
      initialStatuses.push({
        contactId: c.id || `inv_${Date.now()}`,
        contactName: c.name || 'Emergency Contact',
        phone: c.phone || 'Invalid',
        relationship: c.relationship,
        status: 'failed',
        channel: 'native-sms-intent',
        statusLabel: 'Invalid Phone Number',
        timestamp: new Date(now).toISOString(),
        errorReason: 'Phone number format invalid. Please include country code or valid 10 digits.',
        locationIncluded
      });
    }

    this.currentSession = {
      sessionId: `sos_${now}`,
      startedAt: new Date(now).toISOString(),
      messageBody,
      locationIncluded,
      mapsUrl,
      overallState: validContacts.length > 0 ? 'sms_composer_opened' : 'failed',
      overallSummaryText:
        validContacts.length > 0
          ? `Messaging app opened for ${validContacts.length} saved contact${validContacts.length > 1 ? 's' : ''}. Press Send in your SMS app.`
          : 'Unable to open messaging app due to invalid phone numbers.',
      contactStatuses: initialStatuses,
      locationUpdatedFollowUpSent: false
    };
    this.notify();

    // Launch Android Messaging App for valid contacts
    if (validContacts.length > 0) {
      try {
        this.openSmsAppForAllContacts(validContacts, initialLocation);
      } catch (e: any) {
        console.warn('Failed to launch SMS intent:', e);
      }
    }

    return this.currentSession!;
  }

  /**
   * Cancels the active SOS session and broadcasts a Stand-Down / "I Am Safe" message
   * to all emergency contacts without delaying the original emergency workflow.
   */
  public async cancelActiveSOS(contacts: Contact[], reason?: string): Promise<SOSDispatchSummary | null> {
    if (!this.currentSession) return null;
    const now = Date.now();
    const cancelledStatuses: ContactAlertStatus[] = this.currentSession.contactStatuses.map((cs) => ({
      ...cs,
      status: 'cancelled',
      statusLabel: 'SOS Cancelled (Stand Down)',
      timestamp: new Date(now).toISOString()
    }));

    this.currentSession = {
      ...this.currentSession,
      overallState: 'cancelled',
      overallSummaryText: 'SOS alert cancelled — Stand-down notice recorded.',
      cancelledAt: new Date(now).toISOString(),
      cancellationSent: true,
      contactStatuses: cancelledStatuses
    };
    this.notify();

    // Broadcast Stand-Down notice to server if backend is reachable
    try {
      const session = AuthService.getStoredSession();
      await fetch('/api/sos/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts,
          reason: reason || 'Accidental activation',
          userName: session?.user?.fullName,
          phone: session?.user?.phone
        })
      });
    } catch {}

    return this.currentSession;
  }

  /**
   * When an SOS alert was initially sent while GPS was unavailable, and a valid GPS location
   * becomes available shortly after, update the emergency message with the Google Maps link
   * and dispatch/update the location for all saved contacts.
   */
  public async updateLocationForActiveSOS(
    contacts: Contact[],
    freshLocation: LocationData
  ): Promise<void> {
    if (!this.currentSession) return;
    if (!NativeContactsService.hasValidCoordinates(freshLocation)) return;

    const { messageBody, mapsUrl } = this.buildEmergencyMessage(freshLocation);
    const neededFollowUp = !this.currentSession.locationIncluded;

    this.currentSession = {
      ...this.currentSession,
      messageBody,
      locationIncluded: true,
      mapsUrl,
      contactStatuses: this.currentSession.contactStatuses.map((cs) => ({
        ...cs,
        locationIncluded: true
      }))
    };
    this.notify();

    // If the initial SOS was sent without coordinates, automatically send the follow-up with coordinates
    if (neededFollowUp && !this.currentSession.locationUpdatedFollowUpSent && contacts.length > 0) {
      this.currentSession = {
        ...this.currentSession,
        locationUpdatedFollowUpSent: true
      };
      this.notify();
      await this.dispatchInstantSOS(contacts, freshLocation, { forceRetry: true });
    }
  }

  /**
   * Opens the device's native SMS app pre-populated for a specific contact
   */
  public openSmsAppForContact(contact: Contact, location: LocationData | null): void {
    const { messageBody } = this.buildEmergencyMessage(location);
    const cleanPhone = '+' + contact.phone.replace(/\D/g, '');

    if (
      typeof window !== 'undefined' &&
      typeof window.SmartShieldAndroidBridge?.openSmsComposer === 'function'
    ) {
      window.SmartShieldAndroidBridge.openSmsComposer(cleanPhone, messageBody);
    } else if (
      typeof window !== 'undefined' &&
      typeof (window as any).Appilix?.openSms === 'function'
    ) {
      (window as any).Appilix.openSms(cleanPhone, messageBody);
    } else if (typeof window !== 'undefined') {
      const smsUrl = NativeContactsService.getDirectSmsUrl(cleanPhone, messageBody);
      window.location.href = smsUrl;
    }

    if (this.currentSession) {
      const updated = this.currentSession.contactStatuses.map((cs) =>
        cs.contactId === contact.id
          ? {
              ...cs,
              status: 'sms_composer_opened' as const,
              channel: 'native-sms-intent' as const,
              statusLabel: 'SMS App Opened — Press Send in SMS App',
              timestamp: new Date().toISOString()
            }
          : cs
      );
      this.recalculateAndNotify(updated);
    }
  }

  /**
   * Opens the device's native SMS app pre-populated with all saved contacts at once
   */
  public openSmsAppForAllContacts(contacts: Contact[], location: LocationData | null): void {
    if (!contacts || contacts.length === 0) return;
    const { messageBody } = this.buildEmergencyMessage(location);
    const cleanPhones = contacts.map((c) => '+' + c.phone.replace(/\D/g, ''));

    if (
      typeof window !== 'undefined' &&
      typeof window.SmartShieldAndroidBridge?.openSmsComposer === 'function'
    ) {
      window.SmartShieldAndroidBridge.openSmsComposer(cleanPhones.join(';'), messageBody);
    } else if (
      typeof window !== 'undefined' &&
      typeof (window as any).Appilix?.openSms === 'function'
    ) {
      (window as any).Appilix.openSms(cleanPhones.join(','), messageBody);
    } else if (typeof window !== 'undefined') {
      const smsUrl = NativeContactsService.getDirectSmsUrl(cleanPhones, messageBody);
      window.location.href = smsUrl;
    }

    if (this.currentSession) {
      const updated = this.currentSession.contactStatuses.map((cs) => ({
        ...cs,
        status: 'sms_composer_opened' as const,
        channel: 'native-sms-intent' as const,
        statusLabel: 'SMS App Opened — Press Send in SMS App',
        timestamp: new Date().toISOString()
      }));
      this.recalculateAndNotify(updated);
    }
  }

  private async pollCarrierDeliveryStatuses(_sids: { sid: string; contactId: string }[]): Promise<void> {
    // Legacy carrier polling placeholder
  }

  /**
   * Diagnostic status for software-only Android messaging intent
   */
  public async checkSmsGatewayDiagnosticStatus(): Promise<{
    providerConfigured: boolean;
    activeProvider: string;
    channels: any;
    diagnosticGuidance: string;
  }> {
    return {
      providerConfigured: true,
      activeProvider: 'Android Native SMS Intent (Software-Only)',
      channels: {
        androidNativeSms: {
          supportedInApk: true,
          mode: 'Software-Only Native SMS Intent'
        }
      },
      diagnosticGuidance:
        'Software-only SOS messaging active. Smart Shield opens your device Android Messaging app pre-populated with emergency contacts and location message. Press Send in your SMS app to dispatch.'
    };
  }
}

export const sosAlertService = new SOSAlertService();

