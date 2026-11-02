import { AuthSession, AuthUser } from '../types';
import { auth, signOut as firebaseSignOut } from '../firebase';

const AUTH_SESSION_STORAGE_KEY = 'smart_shield_auth_session_v1';
const AUTH_COOKIE_NAME = 'smart_shield_session_token';

export interface SignupPayload {
  fullName: string;
  email: string;
  phone: string;
  countryCode?: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface SignupResult {
  status: 'verification_required' | 'success';
  userId?: string;
  email?: string;
  phone?: string;
  e164Phone?: string;
  smsDispatched?: boolean;
  gatewayNotice?: string;
  message?: string;
  user?: AuthUser;
  token?: string;
  requiresVerification?: boolean;
  targetObfuscated?: string;
  deliveryChannel?: 'sms' | 'email';
  cooldownSeconds?: number;
}

export interface SigninPayload {
  identifier: string;
  countryCode?: string;
  password: string;
}

export interface VerifyCodePayload {
  userId?: string;
  identifier?: string;
  phone?: string;
  countryCode?: string;
  code: string;
}

export interface ForgotPasswordRequestResponse {
  status: string;
  maskedEmail: string;
  maskedPhone: string;
  e164Phone?: string;
  smsDispatched: boolean;
  gatewayNotice?: string;
  verificationPrompt: string;
}

export class AuthError extends Error {
  code?: string;
  userId?: string;
  email?: string;
  phone?: string;
  attemptsRemaining?: number;
  waitSeconds?: number;

  constructor(message: string, code?: string, extra?: Record<string, any>) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    if (extra) {
      this.userId = extra.userId;
      this.email = extra.email;
      this.phone = extra.phone;
      this.attemptsRemaining = extra.attemptsRemaining;
      this.waitSeconds = extra.waitSeconds;
    }
  }
}

// Client Cookie Helper Functions for Appilix WebView & Browser Persistence
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setPersistentCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export const AuthService = {
  /**
   * Returns the currently authenticated user from persistent session storage, or null if not signed in.
   */
  getCurrentUser(): AuthUser | null {
    const session = this.getStoredSession();
    return session?.user || null;
  },

  /**
   * Retrieves active session using multi-layer persistent storage:
   * 1. Primary: localStorage
   * 2. Secondary: Document Cookie (survives Android WebView process clearing)
   * 3. Tertiary: Appilix Android Native SharedPreferences Bridge (if present)
   */
  getStoredSession(): AuthSession | null {
    try {
      // Layer 1: LocalStorage
      const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed: AuthSession = JSON.parse(raw);
        if (parsed && parsed.token && parsed.user && parsed.user.id) {
          if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now()) {
            return parsed;
          }
        }
      }

      // Layer 2: Android Native Storage Bridge (Appilix SharedPreferences)
      if (
        typeof window !== 'undefined' &&
        typeof (window as any).SmartShieldAndroidBridge?.getPersistentAuthToken === 'function'
      ) {
        try {
          const nativeData = (window as any).SmartShieldAndroidBridge.getPersistentAuthToken();
          if (nativeData) {
            const parsed = typeof nativeData === 'string' ? JSON.parse(nativeData) : nativeData;
            if (parsed?.token && parsed?.user) {
              // Re-populate localStorage from native bridge
              localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(parsed));
              return parsed;
            }
          }
        } catch {}
      }

      // Layer 3: Cookie Token Fallback
      const cookieToken = getCookie(AUTH_COOKIE_NAME);
      if (cookieToken) {
        // Token exists in cookie; will be restored via verifyActiveSession
        return null;
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Persists the session across all durable layers:
   * 1. localStorage
   * 2. Cookie (1 month expiration)
   * 3. Android SharedPreferences Bridge
   */
  saveSession(session: AuthSession): void {
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
      setPersistentCookie(AUTH_COOKIE_NAME, session.token, 30);

      // Appilix Android SharedPreferences Bridge
      if (
        typeof window !== 'undefined' &&
        typeof (window as any).SmartShieldAndroidBridge?.savePersistentAuthToken === 'function'
      ) {
        try {
          (window as any).SmartShieldAndroidBridge.savePersistentAuthToken(
            session.token,
            JSON.stringify(session)
          );
        } catch {}
      }
    } catch (e) {
      console.warn('[AuthService] Failed to persist session:', e);
    }
  },

  /**
   * Completely clears user session across all storage tiers on explicit logout.
   */
  clearSession(): void {
    try {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      removeCookie(AUTH_COOKIE_NAME);

      if (
        typeof window !== 'undefined' &&
        typeof (window as any).SmartShieldAndroidBridge?.clearPersistentAuthToken === 'function'
      ) {
        try {
          (window as any).SmartShieldAndroidBridge.clearPersistentAuthToken();
        } catch {}
      }
    } catch {}
  },

  getAuthHeader(): Record<string, string> {
    const session = this.getStoredSession();
    if (session?.token) {
      return { Authorization: `Bearer ${session.token}` };
    }
    return {};
  },

  validateEmail(email: string): boolean {
    const clean = (email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  },

  validatePhone(phone: string): boolean {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  },

  validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number.' };
    }
    return { valid: true };
  },

  /**
   * Restores and verifies active session on startup:
   * - Restores from cache/cookie.
   * - Performs server-side cryptographic signature check.
   * - Auto-renews expired/near-expiry tokens seamlessly.
   * - Does NOT log out on temporary network/offline errors.
   */
  async verifyActiveSession(): Promise<AuthUser | null> {
    const stored = this.getStoredSession();
    const tokenToVerify = stored?.token || getCookie(AUTH_COOKIE_NAME) || '';

    if (!tokenToVerify) return null;

    try {
      const resp = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
          Accept: 'application/json'
        }
      });

      if (resp.status === 401 || resp.status === 403) {
        // Genuine invalid or revoked session
        this.clearSession();
        return null;
      }

      if (resp.ok) {
        const data = await resp.json();
        if (data?.valid && data?.user) {
          const updatedSession: AuthSession = {
            token: data.token || tokenToVerify,
            user: data.user,
            expiresAt: data.expiresAt || stored?.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
          };
          this.saveSession(updatedSession);
          return data.user;
        }
      }

      // If server returned non-auth error (e.g. 500 or timeout), keep valid cached session
      return stored?.user || null;
    } catch {
      // Offline / network failure on mobile APK: preserve session!
      return stored?.user || null;
    }
  },

  /**
   * Registers a new account and triggers the 6-digit verification code.
   */
  async signUp(payload: SignupPayload): Promise<SignupResult> {
    let response: Response;
    try {
      response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Registration failed. Please check your details and try again.',
        data?.code
      );
    }

    if (data.status === 'verification_required') {
      const pendingUser: AuthUser = {
        id: data.userId || `usr-${Date.now()}`,
        fullName: payload.fullName,
        email: data.email || payload.email,
        phone: data.e164Phone || data.phone || payload.phone,
        isVerified: false,
        consentGiven: true,
        emergencyContactsCount: 0,
        createdAt: new Date().toISOString()
      };
      return {
        status: 'verification_required',
        requiresVerification: true,
        userId: data.userId,
        email: data.email,
        phone: data.phone,
        e164Phone: data.e164Phone,
        smsDispatched: data.smsDispatched,
        gatewayNotice: data.gatewayNotice,
        targetObfuscated: data.targetObfuscated || data.phone || data.email,
        deliveryChannel: data.deliveryChannel || 'sms',
        cooldownSeconds: data.cooldownSeconds || 60,
        message: data.message,
        user: pendingUser
      };
    }

    if (data?.user && data?.token) {
      const session: AuthSession = {
        token: data.token,
        user: data.user,
        expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
      };
      this.saveSession(session);
      return {
        status: 'success',
        requiresVerification: false,
        user: data.user,
        token: data.token
      };
    }

    throw new AuthError('Unexpected authentication response from server.');
  },

  /**
   * Validates the 6-digit verification code.
   */
  async verifyCode(payload: VerifyCodePayload): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
    let response: Response;
    try {
      response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Verification failed. Please check the code.',
        data?.code,
        {
          attemptsRemaining: data?.attemptsRemaining,
          userId: payload.userId
        }
      );
    }

    if (!data?.user || !data?.token) {
      throw new AuthError('Unexpected verification response from server.');
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    };
    this.saveSession(session);
    return {
      user: data.user,
      token: data.token,
      isNewUser: Boolean(data.isNewUser)
    };
  },

  /**
   * Resends verification code with rate limiting / cooldown.
   */
  async resendVerificationCode(
    payloadOrUserId: string | { userId?: string; identifier?: string; phone?: string; countryCode?: string },
    optionalTarget?: string
  ): Promise<{
    message: string;
    cooldownSeconds?: number;
    phone?: string;
    e164Phone?: string;
    email?: string;
    smsDispatched?: boolean;
    gatewayNotice?: string;
  }> {
    const payload =
      typeof payloadOrUserId === 'string'
        ? { userId: payloadOrUserId, identifier: optionalTarget }
        : payloadOrUserId;

    let response: Response;
    try {
      response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Failed to resend verification code.',
        data?.code,
        { waitSeconds: data?.waitSeconds }
      );
    }

    return {
      message: data?.message || 'Verification code resent.',
      cooldownSeconds: data?.cooldownSeconds || data?.waitSeconds || 60,
      phone: data?.phone,
      e164Phone: data?.e164Phone,
      email: data?.email,
      smsDispatched: data?.smsDispatched,
      gatewayNotice: data?.gatewayNotice
    };
  },

  /**
   * Normalizes and validates a user-entered phone number into international E.164 format (+CountryCodeNumber).
   * - Trims spaces and formatting characters.
   * - When India (+91) is selected, accepts a valid 10-digit Indian mobile number (including Firebase configured fictional test numbers).
   * - Combines the selected country calling code with the 10-digit number exactly once and never prepends +91 twice.
   */
  normalizePhoneE164(rawPhone: string, countryCode = '+91'): { valid: boolean; e164: string; error?: string } {
    const trimmed = String(rawPhone || '').trim();
    const ccDigits = String(countryCode || '+91').replace(/\D/g, '') || '91';
    const normalizedCc = `+${ccDigits}`;

    if (!trimmed) {
      return {
        valid: false,
        e164: '',
        error:
          ccDigits === '91'
            ? 'Please enter your 10-digit Indian mobile number.'
            : 'Please enter your mobile phone number.'
      };
    }

    if (/[a-zA-Z]/.test(trimmed)) {
      return {
        valid: false,
        e164: '',
        error: 'Phone number must contain digits only. Please remove any letters.'
      };
    }

    // Reject disallowed punctuation (allow digits, spaces, +, -, (, ), .)
    if (/[^0-9+\s\-().]/.test(trimmed)) {
      return {
        valid: false,
        e164: '',
        error: 'Phone number contains invalid characters. Please enter digits only.'
      };
    }

    // Compact string removing spaces, hyphens, parentheses, and dots
    const compact = trimmed.replace(/[\s\-().]/g, '');

    // If the user explicitly entered an international number starting with '+' for a DIFFERENT country code
    // (for example, a Firebase test number like +1 650-555-3434 while +91 is selected), preserve its country code once.
    if (compact.startsWith('+') && !compact.startsWith(`+${ccDigits}`)) {
      const intlDigits = compact.replace(/\D/g, '');
      if (intlDigits.length >= 10 && intlDigits.length <= 15 && /^[1-9]\d{9,14}$/.test(intlDigits)) {
        return { valid: true, e164: `+${intlDigits}` };
      }
      return {
        valid: false,
        e164: '',
        error: 'Please enter a valid international phone number (e.g., +91 followed by 10 digits).'
      };
    }

    // Strip any leading '+' signs and extract pure digits
    let digits = compact.replace(/\D/g, '');

    if (ccDigits === '91') {
      // Remove leading 0091 if present (e.g., 00919876543210 -> 9876543210)
      if (digits.startsWith('0091') && digits.length >= 14) {
        digits = digits.slice(4);
      }
      // Remove repeated or single leading '91' country code prefix when user typed +91 / 91 in the input box
      // so +91 is never prepended twice (e.g., +91 9876543210 or 919876543210 -> 9876543210)
      while (digits.startsWith('91') && digits.length > 10) {
        digits = digits.slice(2);
      }
      // Strip a single leading trunk '0' if 11 digits (e.g., 09876543210 -> 9876543210)
      if (digits.startsWith('0') && digits.length === 11) {
        digits = digits.slice(1);
      }

      if (digits.length < 10) {
        return {
          valid: false,
          e164: '',
          error: `Please enter a valid 10-digit Indian mobile number (you entered ${digits.length} digit${digits.length === 1 ? '' : 's'}).`
        };
      }

      if (digits.length > 10) {
        return {
          valid: false,
          e164: '',
          error: `Please enter a valid 10-digit Indian mobile number without extra digits (you entered ${digits.length} digits).`
        };
      }

      // Accept any 10-digit numeric subscriber number (supports real Indian numbers and Firebase configured fictional test numbers)
      if (!/^\d{10}$/.test(digits)) {
        return {
          valid: false,
          e164: '',
          error: 'Please enter a valid 10-digit Indian mobile number.'
        };
      }

      return {
        valid: true,
        e164: `+91${digits}`
      };
    }

    // Non-India country code handling (e.g. +1, +44, +61, +65, +971)
    while (digits.startsWith(ccDigits) && digits.length > 10) {
      digits = digits.slice(ccDigits.length);
    }
    if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.slice(1);
    }

    if (digits.length < 7 || digits.length > 14) {
      return {
        valid: false,
        e164: '',
        error: `Please enter a valid mobile number for country code ${normalizedCc}.`
      };
    }

    return {
      valid: true,
      e164: `${normalizedCc}${digits}`
    };
  },

  /**
   * Sends a dynamic 6-digit OTP to the exact phone number entered by the user.
   */
  async sendPhoneOtp(
    phone: string,
    countryCode = '+91',
    purpose: 'registration' | 'signin' | 'reset' = 'signin'
  ): Promise<{
    userId?: string;
    existingAccount: boolean;
    phone: string;
    e164Phone: string;
    smsDispatched: boolean;
    gatewayNotice?: string;
    message: string;
  }> {
    let response: Response;
    try {
      response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode, purpose })
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Could not send OTP to this phone number.',
        data?.code,
        { waitSeconds: data?.waitSeconds, phone: data?.phone }
      );
    }
    return data;
  },

  /**
   * Signs in an existing user with exact error discrimination:
   * - INCORRECT_PASSWORD: "Incorrect password. Please try again."
   * - ACCOUNT_NOT_FOUND: "No account found with this email/mobile number."
   * - UNVERIFIED_ACCOUNT: Automatically routes to verification screen.
   */
  async signIn(payload: SigninPayload): Promise<{ user: AuthUser; token: string }> {
    let response: Response;
    try {
      response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Sign in failed.',
        data?.code,
        {
          userId: data?.userId,
          email: data?.email,
          phone: data?.phone
        }
      );
    }

    if (!data?.user || !data?.token) {
      throw new AuthError('Unexpected authentication response from server.');
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    };
    this.saveSession(session);
    return { user: data.user, token: data.token };
  },

  async logout(): Promise<void> {
    const stored = this.getStoredSession();
    this.clearSession();

    try {
      await firebaseSignOut(auth);
    } catch {}

    if (stored?.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${stored.token}`
          },
          body: JSON.stringify({ token: stored.token })
        });
      } catch {}
    }
  },

  async requestPasswordReset(identifier: string): Promise<ForgotPasswordRequestResponse> {
    let response: Response;
    try {
      response = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Could not find an account with that email or mobile number.',
        data?.code,
        { waitSeconds: data?.waitSeconds }
      );
    }
    return data as ForgotPasswordRequestResponse;
  },

  async completePasswordReset(params: {
    identifier: string;
    verificationInput: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<string> {
    let response: Response;
    try {
      response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch {
      throw new AuthError('Network connection error. Please check your internet connection and try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AuthError(
        data?.error || 'Password reset failed. Please check your verification code.',
        data?.code,
        { attemptsRemaining: data?.attemptsRemaining }
      );
    }
    return data?.message || 'Password updated successfully.';
  },

  /**
   * Completes SmartShield session creation after Firebase Phone Authentication confirmationResult.confirm(otp) succeeds.
   */
  async completeFirebasePhoneAuth(params: {
    firebaseUid: string;
    phoneNumber: string;
    idToken?: string;
    countryCode?: string;
    fullName?: string;
    email?: string;
    password?: string;
  }): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
    let response: Response;
    try {
      response = await fetch('/api/auth/firebase-phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch {
      throw new AuthError('Network connection error while syncing verified Firebase account.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user || !data?.token) {
      throw new AuthError(
        data?.error || 'Could not complete SmartShield sign-in after Firebase phone verification.',
        data?.code
      );
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    };
    this.saveSession(session);
    return {
      user: data.user,
      token: data.token,
      isNewUser: Boolean(data.isNewUser)
    };
  },

  /**
   * Completes SmartShield session creation after Firebase Email/Password Authentication and Email Verification.
   */
  async completeFirebaseEmailAuth(params: {
    firebaseUid: string;
    email: string;
    emailVerified: boolean;
    idToken?: string;
    fullName?: string;
    password?: string;
  }): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
    if (!params.emailVerified) {
      throw new AuthError(
        'Please verify your email address before opening the SmartShield dashboard.',
        'EMAIL_NOT_VERIFIED'
      );
    }

    const buildClientSideFirebaseSession = (): { user: AuthUser; token: string; isNewUser: boolean } => {
      const cleanEmail = params.email.trim().toLowerCase();
      const displayName =
        (params.fullName || '').trim() ||
        auth.currentUser?.displayName ||
        cleanEmail.split('@')[0] ||
        'SmartShield User';
      const fallbackUser: AuthUser = {
        id: params.firebaseUid,
        fullName: displayName,
        email: cleanEmail,
        phone: auth.currentUser?.phoneNumber || '',
        isVerified: true,
        createdAt: new Date().toISOString()
      };
      const token = params.idToken || `firebase-spark-${params.firebaseUid}`;
      const session: AuthSession = {
        token,
        user: fallbackUser,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
      };
      this.saveSession(session);
      return { user: fallbackUser, token, isNewUser: false };
    };

    let response: Response;
    try {
      response = await fetch('/api/auth/firebase-email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch {
      // Running on Free Static Hosting without Node.js backend: use verified Firebase Auth user directly
      return buildClientSideFirebaseSession();
    }

    const contentType = response.headers.get('content-type') || '';
    if (response.status === 404 || !contentType.includes('application/json')) {
      // Static host returned 404 or SPA index.html rewrite for /api/*: use verified Firebase Auth user directly
      return buildClientSideFirebaseSession();
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user || !data?.token) {
      // If backend is unavailable (5xx), fall back to verified Firebase client session
      if (response.status >= 500) {
        return buildClientSideFirebaseSession();
      }
      throw new AuthError(
        data?.error || 'Could not complete SmartShield sign-in after Firebase email verification.',
        data?.code
      );
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
    };
    this.saveSession(session);
    return {
      user: data.user,
      token: data.token,
      isNewUser: Boolean(data.isNewUser)
    };
  },

  /**
   * Translates Firebase Authentication errors into clear, actionable user-facing messages.
   */
  formatFirebaseAuthError(err: any): string {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');

    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in or use Forgot Password.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address (for example: priya@example.com).';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a password with at least 8 characters, including a letter and a number.';
      case 'auth/missing-password':
        return 'Please enter your password.';
      case 'auth/missing-email':
        return 'Please enter your email address.';
      case 'auth/user-not-found':
        return 'No account found with this email address. Please check the email or create a new account.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Invalid email or password. Please check your credentials or use Forgot Password.';
      case 'auth/user-disabled':
        return 'This user account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many authentication attempts or email requests. Please wait a few minutes before trying again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in Firebase Console. Please enable the Email/Password provider in Firebase Console → Authentication → Sign-in method.';
      case 'auth/invalid-app-credential':
      case 'auth/app-not-authorized':
      case 'auth/unauthorized-domain':
        return `Firebase Auth domain/app credential error (${code}). Please ensure this app domain (${typeof window !== 'undefined' ? window.location.hostname : 'current domain'}) is added under Firebase Console → Authentication → Settings → Authorized domains, and Email/Password Sign-In is enabled.`;
      case 'auth/network-request-failed':
        return 'Network error while communicating with Firebase Authentication. Please check your internet connection and try again.';
      case 'auth/internal-error':
        return `Firebase Authentication encountered an error (${msg || code}). Ensure Email/Password Auth and Authorized Domains are configured in Firebase Console.`;
      default:
        return msg || 'Authentication failed. Please check your details and try again.';
    }
  }
};

