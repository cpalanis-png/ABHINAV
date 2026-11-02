import React, { useState, useEffect } from 'react';
import {
  MailCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Check,
  Shield,
  ArrowRight
} from 'lucide-react';
import {
  auth,
  sendEmailVerification,
  reload,
  signOut
} from '../firebase';
import { AuthService } from '../services/authService';

interface EmailVerificationScreenProps {
  email: string;
  onVerified: () => void;
  onBackToSignIn: () => void;
  onUseDifferentEmail: () => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  email,
  onVerified,
  onBackToSignIn,
  onUseDifferentEmail
}) => {
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    `A verification email has been sent to ${email || 'your inbox'}. Please check your email inbox and click the verification link before opening SmartShield.`
  );

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check Email Verification Status with reload(auth.currentUser)
  const handleCheckVerification = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const activeUser = auth.currentUser;
    if (!activeUser) {
      setErrorMessage('Session expired. Please sign in with your email and password.');
      onBackToSignIn();
      return;
    }

    setLoading(true);
    try {
      await reload(activeUser);
      const refreshedUser = auth.currentUser;

      if (!refreshedUser || !refreshedUser.emailVerified) {
        setErrorMessage(
          `Email verification is still pending for ${refreshedUser?.email || email}. Please open your email, click the verification link sent by Firebase Authentication, and then tap this button again.`
        );
        return;
      }

      setInfoMessage('Email verified successfully! Opening your SmartShield dashboard...');
      setTimeout(() => {
        onVerified();
      }, 500);
    } catch (err: any) {
      console.warn('[Firebase Email Verification Check Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } fontFinally: {
      setLoading(false);
    }
  };

  // Resend Verification Email using Firebase sendEmailVerification()
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const activeUser = auth.currentUser;
    if (!activeUser) {
      setErrorMessage('Please sign in first to request a fresh verification email.');
      onBackToSignIn();
      return;
    }

    setLoading(true);
    try {
      await reload(activeUser);
      if (activeUser.emailVerified) {
        onVerified();
        return;
      }

      await sendEmailVerification(activeUser);
      setResendCooldown(60);
      setInfoMessage(
        `A fresh verification email has been sent to ${activeUser.email || email}. Please check your inbox and spam/junk folder.`
      );
    } catch (err: any) {
      console.warn('[Firebase sendEmailVerification Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const targetEmail = auth.currentUser?.email || email || 'your registered email';

  return (
    <div
      data-testid="email-verification-required-screen"
      className="w-full max-w-md mx-auto"
    >
      <div className="rounded-3xl bg-[#0E1530]/95 border border-purple-500/35 p-6 sm:p-8 shadow-2xl space-y-5">
        
        {/* Top Icon & Heading */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shrink-0">
            <MailCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Email Verification Required
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Verify your inbox to open SmartShield
            </p>
          </div>
        </div>

        {/* Informational Message Banner */}
        {infoMessage && (
          <div
            data-testid="verification-info-banner"
            className="p-3.5 rounded-xl bg-purple-950/70 border border-purple-500/40 flex items-start space-x-2.5 text-xs text-purple-200"
          >
            <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{infoMessage}</span>
          </div>
        )}

        {/* Error Message Banner */}
        {errorMessage && (
          <div
            data-testid="verification-error-banner"
            className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Email Address & Step Instructions */}
        <div className="p-4 rounded-2xl bg-[#090E22]/90 border border-slate-800 space-y-2.5">
          <div className="text-xs text-slate-400">
            Verification email sent via Firebase Auth to:
          </div>
          <div
            data-testid="verification-target-email"
            className="text-sm font-bold text-pink-300 tracking-wide break-all font-mono"
          >
            {targetEmail}
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300 leading-relaxed">
            <div className="flex items-start space-x-2">
              <span className="font-bold text-pink-400">1.</span>
              <span>Open your email client and check your inbox or spam folder.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold text-pink-400">2.</span>
              <span>Click the verification link in the email from Firebase Authentication.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold text-pink-400">3.</span>
              <span>Tap the button below to confirm verification and open your dashboard.</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button: I've Verified My Email */}
        <button
          type="button"
          onClick={handleCheckVerification}
          disabled={loading}
          data-testid="check-verification-status-btn"
          className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-50 text-white font-bold text-sm sm:text-base shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Checking Verification Status...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>I&apos;ve Verified My Email — Open SmartShield</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Resend Verification Email Button using sendEmailVerification() */}
        <div className="pt-3 border-t border-slate-800 flex flex-col items-center space-y-3">
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resendCooldown > 0 || loading}
            data-testid="resend-verification-email-btn"
            className={`text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              resendCooldown > 0
                ? 'text-slate-500 cursor-not-allowed'
                : 'text-pink-300 hover:text-pink-200 cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {resendCooldown > 0
                ? `Resend Verification Email in ${resendCooldown}s`
                : 'Did not receive the email? Resend Verification Email'}
            </span>
          </button>

          {/* Additional Options */}
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut(auth);
                } catch {}
                onUseDifferentEmail();
              }}
              className="hover:text-slate-200 underline underline-offset-2 cursor-pointer"
            >
              Use a different email
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut(auth);
                } catch {}
                onBackToSignIn();
              }}
              className="hover:text-slate-200 underline underline-offset-2 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
