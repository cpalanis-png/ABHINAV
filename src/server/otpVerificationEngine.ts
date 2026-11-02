import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import twilio from 'twilio';

const DATA_DIR = path.join(process.cwd(), '.data');
const OTP_STORE_FILE = path.join(DATA_DIR, 'otp_verifications.json');

export interface PhoneOtpRecord {
  e164Phone: string;
  userId?: string;
  purpose: 'registration' | 'signin' | 'reset';
  otpHmacHash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  lastSentAt: number;
  createdAt: string;
}

type OtpStoreMap = Record<string, PhoneOtpRecord>;

function readOtpStore(): OtpStoreMap {
  try {
    if (fs.existsSync(OTP_STORE_FILE)) {
      const raw = fs.readFileSync(OTP_STORE_FILE, 'utf-8');
      return JSON.parse(raw) as OtpStoreMap;
    }
  } catch (err) {
    console.warn('[OtpEngine] Failed to read OTP store:', err);
  }
  return {};
}

function writeOtpStore(store: OtpStoreMap): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Prune expired records older than 1 hour
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const key of Object.keys(store)) {
      if (store[key].expiresAt < cutoff) {
        delete store[key];
      }
    }
    fs.writeFileSync(OTP_STORE_FILE, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('[OtpEngine] Failed to write OTP store:', err);
  }
}

/**
 * Validate and normalize a user-entered phone number + country code into strict international E.164 format.
 * Default country code is India (+91).
 */
export function validateAndNormalizePhoneE164(
  rawPhoneInput: string,
  countryCodeInput = '+91'
): { valid: boolean; e164: string; nationalNumber: string; countryCode: string; error?: string } {
  const rawTrimmed = String(rawPhoneInput || '').trim();
  const ccDigits = String(countryCodeInput || '91').replace(/\D/g, '') || '91';
  const normalizedCc = `+${ccDigits}`;

  if (!rawTrimmed) {
    return {
      valid: false,
      e164: '',
      nationalNumber: '',
      countryCode: normalizedCc,
      error:
        ccDigits === '91'
          ? 'Please enter your 10-digit Indian mobile number.'
          : 'Please enter your mobile phone number.'
    };
  }

  // Reject input containing letters
  if (/[a-zA-Z]/.test(rawTrimmed)) {
    return {
      valid: false,
      e164: '',
      nationalNumber: '',
      countryCode: normalizedCc,
      error: 'Phone number must contain digits only. Please remove any letters.'
    };
  }

  if (/[^0-9+\s\-().]/.test(rawTrimmed)) {
    return {
      valid: false,
      e164: '',
      nationalNumber: '',
      countryCode: normalizedCc,
      error: 'Phone number contains invalid characters. Please enter digits only.'
    };
  }

  const compact = rawTrimmed.replace(/[\s\-().]/g, '');

  // If user entered an explicit international number with a different country code (e.g., +1 650-555-3434)
  if (compact.startsWith('+') && !compact.startsWith(`+${ccDigits}`)) {
    const intlDigits = compact.replace(/\D/g, '');
    if (intlDigits.length >= 10 && intlDigits.length <= 15 && /^[1-9]\d{9,14}$/.test(intlDigits)) {
      const nat = intlDigits.slice(-10);
      const detectedCc = intlDigits.slice(0, intlDigits.length - nat.length) || ccDigits;
      return {
        valid: true,
        e164: `+${intlDigits}`,
        nationalNumber: nat,
        countryCode: `+${detectedCc}`
      };
    }
    return {
      valid: false,
      e164: '',
      nationalNumber: '',
      countryCode: normalizedCc,
      error: 'Please enter a valid international phone number in E.164 format (e.g., +91 9876543210).'
    };
  }

  let digits = compact.replace(/\D/g, '');

  if (ccDigits === '91') {
    if (digits.startsWith('0091') && digits.length >= 14) {
      digits = digits.slice(4);
    }
    while (digits.startsWith('91') && digits.length > 10) {
      digits = digits.slice(2);
    }
    if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }

    if (digits.length < 10) {
      return {
        valid: false,
        e164: '',
        nationalNumber: digits,
        countryCode: '+91',
        error: `Please enter a valid 10-digit Indian mobile number (you entered ${digits.length} digit${digits.length === 1 ? '' : 's'}).`
      };
    }

    if (digits.length > 10 || !/^\d{10}$/.test(digits)) {
      return {
        valid: false,
        e164: '',
        nationalNumber: digits,
        countryCode: '+91',
        error: `Please enter a valid 10-digit Indian mobile number without extra digits (you entered ${digits.length} digits).`
      };
    }

    return {
      valid: true,
      e164: `+91${digits}`,
      nationalNumber: digits,
      countryCode: '+91'
    };
  }

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
      nationalNumber: digits,
      countryCode: normalizedCc,
      error: `Please enter a valid phone number for country code ${normalizedCc}.`
    };
  }

  return {
    valid: true,
    e164: `${normalizedCc}${digits}`,
    nationalNumber: digits,
    countryCode: normalizedCc
  };
}

export function maskE164Phone(e164Phone: string): string {
  const digits = String(e164Phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '******';
  const ccLen = digits.length > 10 ? digits.length - 10 : 2;
  const cc = digits.slice(0, ccLen);
  const last4 = digits.slice(-4);
  return `+${cc}******${last4}`;
}

export function computePhoneBoundOtpHmac(e164Phone: string, code: string, secret: string): string {
  const normalizedPhone = String(e164Phone || '').trim();
  const normalizedCode = String(code || '').trim();
  return crypto
    .createHmac('sha256', secret)
    .update(`otp_v1:${normalizedPhone}:${normalizedCode}`)
    .digest('hex');
}

export interface OtpDispatchResult {
  success: boolean;
  e164Phone: string;
  maskedPhone: string;
  smsDispatched: boolean;
  provider: 'twilio' | 'fast2sms' | 'unconfigured';
  expiresInSeconds: number;
  cooldownSeconds: number;
  gatewayNotice?: string;
  error?: string;
  codeType?: string;
  waitSeconds?: number;
}

/**
 * Generates a unique 6-digit OTP bound to the exact user-submitted `e164Phone` and dispatches it via SMS gateway.
 * Never hardcodes any recipient number and never logs the plaintext OTP to console.
 */
export async function issueAndSendOtpToUserPhone(params: {
  e164Phone: string;
  userId?: string;
  purpose: 'registration' | 'signin' | 'reset';
  secret: string;
  bypassCooldown?: boolean;
}): Promise<{ result: OtpDispatchResult; otpHash: string; expiresAt: number }> {
  const { e164Phone, userId, purpose, secret, bypassCooldown } = params;
  const store = readOtpStore();
  const now = Date.now();
  const existing = store[e164Phone];

  if (!bypassCooldown && existing && now - existing.lastSentAt < 60000) {
    const waitSeconds = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
    return {
      result: {
        success: false,
        e164Phone,
        maskedPhone: maskE164Phone(e164Phone),
        smsDispatched: false,
        provider: 'unconfigured',
        expiresInSeconds: 600,
        cooldownSeconds: 60,
        waitSeconds,
        codeType: 'COOLDOWN_ACTIVE',
        error: `Please wait ${waitSeconds}s before requesting another OTP for ${maskE164Phone(e164Phone)}.`
      },
      otpHash: existing.otpHmacHash,
      expiresAt: existing.expiresAt
    };
  }

  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHmacHash = computePhoneBoundOtpHmac(e164Phone, rawOtp, secret);
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  store[e164Phone] = {
    e164Phone,
    userId,
    purpose,
    otpHmacHash,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: now,
    createdAt: new Date(now).toISOString()
  };
  writeOtpStore(store);

  // Dispatch strictly to the user-entered e164Phone (no hardcoded recipient numbers, no raw OTP logging)
  const masked = maskE164Phone(e164Phone);
  const prefix =
    purpose === 'reset'
      ? 'Password Reset OTP'
      : purpose === 'signin'
      ? 'Sign-In Verification OTP'
      : 'Account Verification OTP';
  const smsBody = `SMART SHIELD ${prefix}: ${rawOtp}. Valid for 10 minutes for ${masked}. Do not share this code with anyone.`;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();
  const fast2SmsKey = process.env.FAST2SMS_API_KEY?.trim();

  let smsDispatched = false;
  let provider: 'twilio' | 'fast2sms' | 'unconfigured' = 'unconfigured';
  let gatewayNotice: string | undefined;

  // Log only masked recipient metadata — NEVER log the raw OTP code
  console.log(`[OTP Service] Generated phone-bound ${prefix} for recipient ${masked} (Valid 10m)`);

  if (twilioSid && twilioSid.startsWith('AC') && twilioToken && twilioFrom) {
    provider = 'twilio';
    try {
      const client = twilio(twilioSid, twilioToken);
      await client.messages.create({
        to: e164Phone, // Strictly the current user's normalized phone number
        from: twilioFrom,
        body: smsBody
      });
      smsDispatched = true;
    } catch (smsErr: any) {
      console.warn(`[OTP Service] Twilio dispatch error for ${masked}:`, smsErr?.message || smsErr);
      gatewayNotice = `SMS gateway reported a delivery error for ${masked}: ${smsErr?.message || 'Carrier rejection'}.`;
    }
  } else if (fast2SmsKey && e164Phone.startsWith('+91')) {
    provider = 'fast2sms';
    try {
      const tenDigit = e164Phone.slice(3);
      const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2SmsKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message: smsBody,
          language: 'english',
          flash: 0,
          numbers: tenDigit // Strictly the current user's 10-digit number
        })
      });
      if (resp.ok) {
        smsDispatched = true;
      } else {
        gatewayNotice = `Fast2SMS gateway returned status ${resp.status} for ${masked}.`;
      }
    } catch (fErr: any) {
      console.warn(`[OTP Service] Fast2SMS dispatch error for ${masked}:`, fErr?.message || fErr);
      gatewayNotice = `Fast2SMS connection error for ${masked}.`;
    }
  } else {
    gatewayNotice =
      twilioSid && !twilioSid.startsWith('AC')
        ? `TWILIO_ACCOUNT_SID in environment does not start with 'AC'. Configure valid SMS credentials to deliver live SMS to ${masked}.`
        : `Live SMS gateway credentials (TWILIO_* or FAST2SMS_API_KEY) are not configured on the server for ${masked}.`;
  }

  return {
    result: {
      success: true,
      e164Phone,
      maskedPhone: masked,
      smsDispatched,
      provider,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
      gatewayNotice
    },
    otpHash: otpHmacHash,
    expiresAt
  };
}

/**
 * Verify a 6-digit OTP strictly against the phone-bound HMAC record for `e164Phone`.
 * Invalidates the OTP immediately upon successful verification.
 */
export function verifyPhoneBoundOtp(params: {
  e164Phone: string;
  code: string;
  secret: string;
  fallbackStoredHash?: string;
  fallbackExpiresAt?: number;
  fallbackAttempts?: number;
}): {
  valid: boolean;
  error?: string;
  codeType?: 'INVALID_FORMAT' | 'CODE_EXPIRED' | 'MAX_ATTEMPTS_EXCEEDED' | 'INVALID_CODE' | 'NO_ACTIVE_OTP';
  attemptsRemaining?: number;
} {
  const { e164Phone, code, secret, fallbackStoredHash, fallbackExpiresAt, fallbackAttempts } = params;
  const cleanCode = String(code || '').trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      valid: false,
      codeType: 'INVALID_FORMAT',
      error: 'Please enter a valid 6-digit numeric OTP.'
    };
  }

  const store = readOtpStore();
  const record = store[e164Phone];
  const now = Date.now();

  if (record) {
    if (record.attempts >= record.maxAttempts) {
      return {
        valid: false,
        codeType: 'MAX_ATTEMPTS_EXCEEDED',
        attemptsRemaining: 0,
        error: 'Too many incorrect OTP attempts. Please request a new verification code.'
      };
    }

    if (now > record.expiresAt) {
      delete store[e164Phone];
      writeOtpStore(store);
      return {
        valid: false,
        codeType: 'CODE_EXPIRED',
        error: 'This verification code has expired (valid for 10 minutes). Please tap Resend OTP.'
      };
    }

    const candidateHmac = computePhoneBoundOtpHmac(e164Phone, cleanCode, secret);
    const aBuf = Buffer.from(candidateHmac, 'hex');
    const bBuf = Buffer.from(record.otpHmacHash, 'hex');

    if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
      record.attempts += 1;
      writeOtpStore(store);
      const remaining = Math.max(0, record.maxAttempts - record.attempts);
      return {
        valid: false,
        codeType: 'INVALID_CODE',
        attemptsRemaining: remaining,
        error: `Incorrect OTP for ${maskE164Phone(e164Phone)}. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      };
    }

    // Valid! Invalidate immediately so it can never be reused
    delete store[e164Phone];
    writeOtpStore(store);
    return { valid: true };
  }

  // Fallback check if user record holds phone-bound HMAC hash
  if (fallbackStoredHash && fallbackExpiresAt) {
    if ((fallbackAttempts || 0) >= 5) {
      return {
        valid: false,
        codeType: 'MAX_ATTEMPTS_EXCEEDED',
        attemptsRemaining: 0,
        error: 'Too many incorrect OTP attempts. Please request a new verification code.'
      };
    }
    if (now > fallbackExpiresAt) {
      return {
        valid: false,
        codeType: 'CODE_EXPIRED',
        error: 'Verification code has expired. Please request a new code.'
      };
    }
    const candidateHmac = computePhoneBoundOtpHmac(e164Phone, cleanCode, secret);
    if (candidateHmac === fallbackStoredHash) {
      return { valid: true };
    }
    const remaining = Math.max(0, 5 - ((fallbackAttempts || 0) + 1));
    return {
      valid: false,
      codeType: 'INVALID_CODE',
      attemptsRemaining: remaining,
      error: `Incorrect verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
    };
  }

  return {
    valid: false,
    codeType: 'NO_ACTIVE_OTP',
    error: 'No active verification code found for this phone number. Please request a new OTP.'
  };
}
