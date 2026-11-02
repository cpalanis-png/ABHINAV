import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartHandshake,
  MapPin,
  Sparkles,
  KeyRound,
  FileText,
  X,
  RefreshCw,
  Check,
  MailCheck
} from 'lucide-react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  reload,
  updateProfile
} from '../firebase';
import { AuthScreenState, AuthUser } from '../types';
import { AuthService } from '../services/authService';
import { EmailVerificationScreen } from './EmailVerificationScreen';

interface WelcomeAuthFlowProps {
  onAuthenticated: (user: AuthUser) => void;
  initialScreen?: AuthScreenState;
}

interface PendingSignupProfile {
  fullName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
}

export const WelcomeAuthFlow: React.FC<WelcomeAuthFlowProps> = ({
  onAuthenticated,
  initialScreen = 'welcome'
}) => {
  const [screen, setScreen] = useState<AuthScreenState>(initialScreen);

  // Welcome quick email state
  const [welcomeEmail, setWelcomeEmail] = useState('');

  // Sign In form state (Email + Password via signInWithEmailAndPassword)
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up form state (Email + Password + Confirm Password via createUserWithEmailAndPassword)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Email Verification state (sendEmailVerification & user.emailVerified gate)
  const [verificationEmailTarget, setVerificationEmailTarget] = useState('');
  const [pendingSignupProfile, setPendingSignupProfile] = useState<PendingSignupProfile | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password state (sendPasswordResetEmail)
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Shared UI status state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState<'terms' | 'privacy' | null>(null);

  // If a Firebase user is already signed in but their email is not yet verified, show the verification screen
  useEffect(() => {
    const activeUser = auth.currentUser;
    if (activeUser && !activeUser.emailVerified && activeUser.email) {
      setVerificationEmailTarget(activeUser.email);
      if (initialScreen === 'verify_email' || initialScreen === 'verify_code') {
        setScreen('verify_email');
      }
    }
  }, [initialScreen]);

  // Countdown timer for resending verification email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const switchScreen = (next: AuthScreenState) => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (next === 'forgot_password') {
      setResetEmailSent(false);
      if (signInEmail.trim()) {
        setResetEmail(signInEmail.trim());
      } else if (email.trim()) {
        setResetEmail(email.trim());
      } else if (welcomeEmail.trim()) {
        setResetEmail(welcomeEmail.trim());
      }
    }
    setScreen(next);
  };

  // Opening Page Email Continue Handler
  const handleWelcomeEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = welcomeEmail.trim().toLowerCase();
    if (!AuthService.validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (for example: priya@example.com).');
      return;
    }

    setEmail(cleanEmail);
    setSignInEmail(cleanEmail);
    switchScreen('signup');
  };

  // Sign Up with Firebase createUserWithEmailAndPassword() + sendEmailVerification()
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!AuthService.validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const passCheck = AuthService.validatePassword(password);
    if (!passCheck.valid) {
      setErrorMessage(passCheck.error || 'Please choose a stronger password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-check your confirm password field.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create account in Firebase Authentication using Email & Password
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const firebaseUser = userCredential.user;

      // 2. Save user's full name to their Firebase profile
      if (cleanName) {
        try {
          await updateProfile(firebaseUser, { displayName: cleanName });
        } catch {}
      }

      // 3. Send verification email using Firebase sendEmailVerification()
      await sendEmailVerification(firebaseUser);

      // 4. Require email verification before opening the SmartShield dashboard
      setPendingSignupProfile({
        fullName: cleanName,
        email: cleanEmail,
        password,
        termsAccepted
      });
      setVerificationEmailTarget(firebaseUser.email || cleanEmail);
      setResendCooldown(60);
      setInfoMessage(
        `A verification email has been sent to ${firebaseUser.email || cleanEmail}. Please click the verification link in your email before opening the SmartShield dashboard.`
      );
      setScreen('verify_email');
    } catch (err: any) {
      console.warn('[Firebase createUserWithEmailAndPassword Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Firebase signInWithEmailAndPassword() + verified email check
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = signInEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!AuthService.validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (for example: priya@example.com).');
      return;
    }

    if (!signInPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Firebase Email/Password
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, signInPassword);
      const firebaseUser = userCredential.user;

      // 2. Reload user profile from Firebase to ensure fresh emailVerified status
      await reload(firebaseUser);

      // 3. Require a verified email before opening the SmartShield dashboard
      if (!firebaseUser.emailVerified) {
        setVerificationEmailTarget(firebaseUser.email || cleanEmail);
        setInfoMessage(
          `Your email (${firebaseUser.email || cleanEmail}) is not verified yet. Please check your inbox and click the verification link, or tap "Resend Verification Email" below.`
        );
        setScreen('verify_email');
        return;
      }

      // 4. Email is verified — sync with SmartShield session and open dashboard
      const idToken = await firebaseUser.getIdToken(true);
      const { user } = await AuthService.completeFirebaseEmailAuth({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || cleanEmail,
        emailVerified: true,
        idToken,
        fullName: firebaseUser.displayName || pendingSignupProfile?.fullName || undefined,
        password: signInPassword
      });

      onAuthenticated(user);
    } catch (err: any) {
      console.warn('[Firebase signInWithEmailAndPassword Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Check Email Verification Status and Open SmartShield Dashboard only when emailVerified === true
  const handleCheckEmailVerified = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const activeUser = auth.currentUser;
    if (!activeUser) {
      setErrorMessage('Your session has expired. Please sign in with your email and password.');
      setScreen('signin');
      return;
    }

    setLoading(true);
    try {
      await reload(activeUser);
      const refreshedUser = auth.currentUser;

      if (!refreshedUser || !refreshedUser.emailVerified) {
        setErrorMessage(
          `Email verification is still pending for ${refreshedUser?.email || verificationEmailTarget}. Please open the email we sent you, click the verification link, and then tap this button again.`
        );
        return;
      }

      const idToken = await refreshedUser.getIdToken(true);
      const { user } = await AuthService.completeFirebaseEmailAuth({
        firebaseUid: refreshedUser.uid,
        email: refreshedUser.email || verificationEmailTarget,
        emailVerified: true,
        idToken,
        fullName: refreshedUser.displayName || pendingSignupProfile?.fullName || fullName.trim() || undefined,
        password: pendingSignupProfile?.password || signInPassword || undefined
      });

      onAuthenticated(user);
    } catch (err: any) {
      console.warn('[Firebase Email Verification Check Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification Email via Firebase sendEmailVerification()
  const handleResendVerificationEmail = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const activeUser = auth.currentUser;
    if (!activeUser) {
      setErrorMessage('Please sign in first to request a new verification email.');
      setScreen('signin');
      return;
    }

    setLoading(true);
    try {
      await reload(activeUser);
      if (activeUser.emailVerified) {
        await handleCheckEmailVerified();
        return;
      }

      await sendEmailVerification(activeUser);
      setResendCooldown(60);
      setInfoMessage(
        `A fresh verification email has been sent to ${activeUser.email || verificationEmailTarget}. Please check your inbox and spam folder.`
      );
    } catch (err: any) {
      console.warn('[Firebase sendEmailVerification Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password via Firebase sendPasswordResetEmail()
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (!AuthService.validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (for example: priya@example.com).');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetEmailSent(true);
      setInfoMessage(
        `A password reset link has been sent to ${cleanEmail}. Please check your email inbox (and spam folder) and follow the link to reset your password.`
      );
    } catch (err: any) {
      console.warn('[Firebase sendPasswordResetEmail Notice]:', err?.code || err?.message || err);
      setErrorMessage(AuthService.formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Password live checklist for Sign Up
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-pink-500 selection:text-white">
      {/* Subtle Ambient Navy, Purple & Soft Pink Radial Illumination */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-purple-700/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/4 -right-28 w-96 h-96 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-[28rem] h-[28rem] rounded-full bg-indigo-900/25 blur-3xl" />
      </div>

      {/* Top Brand Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => switchScreen('welcome')}
          className="flex items-center space-x-3 text-left group focus:outline-none"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1E1B4B] via-purple-600 to-pink-400 p-[1.5px] shadow-lg shadow-purple-950/60 transition-transform duration-300 group-hover:scale-105">
            <div className="w-full h-full bg-[#0D132A] rounded-[14px] flex items-center justify-center">
              <Shield className="w-6 h-6 text-pink-300 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <span className="block text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-pink-300 bg-clip-text text-transparent">
              SMART SHIELD
            </span>
            <span className="block text-[11px] text-slate-400 font-medium">
              Personal Safety &amp; Wellness Platform
            </span>
          </div>
        </button>

        {screen !== 'welcome' ? (
          <button
            type="button"
            onClick={() => switchScreen('welcome')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-purple-500/30 text-xs font-semibold text-purple-200 flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-pink-300" />
            <span>Welcome Page</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchScreen('signin')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-purple-950/70 border border-purple-400/30 text-xs sm:text-sm font-semibold text-pink-200 hover:text-white transition-all"
          >
            Sign In
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        {screen === 'welcome' && (
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Hero Brand, Headline, Subtitle & Primary Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Interactive Emblem */}
              <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-2xl bg-[#111836]/90 border border-purple-500/30 shadow-inner">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-md">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-bold tracking-wide text-pink-200">
                  SMART SHIELD • WOMEN SAFETY &amp; WELLNESS
                </span>
              </div>

              {/* Main Headline & Subtitle */}
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] text-white">
                  Your Safety,{' '}
                  <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-rose-300 bg-clip-text text-transparent">
                    Our Priority
                  </span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  Your trusted companion for personal safety, wellness and confidence.
                </p>
              </div>

              {/* Primary CTA Buttons: Get Started & Sign In */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3.5 max-w-md mx-auto lg:mx-0">
                <button
                  type="button"
                  onClick={() => switchScreen('signup')}
                  className="min-h-[52px] flex-1 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-400 text-white font-bold text-base shadow-xl shadow-purple-950/60 flex items-center justify-center space-x-2.5 transition-all duration-200 active:scale-[0.99]"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => switchScreen('signin')}
                  className="min-h-[52px] flex-1 px-6 py-3.5 rounded-2xl bg-[#111936]/95 hover:bg-[#19234B] text-pink-100 border border-purple-400/40 font-bold text-base flex items-center justify-center space-x-2 transition-all duration-200 active:scale-[0.99]"
                >
                  <span>Sign In</span>
                </button>
              </div>

              {/* Core Pillars Summary */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-4 rounded-2xl bg-[#0E1530]/90 border border-slate-800/90">
                  <div className="flex items-center space-x-2 text-pink-300 font-bold text-sm mb-1">
                    <MapPin className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>Instant SOS &amp; GPS</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Zero-delay emergency alerts with live GPS coordinates and audio/video evidence.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0E1530]/90 border border-slate-800/90">
                  <div className="flex items-center space-x-2 text-purple-300 font-bold text-sm mb-1">
                    <HeartHandshake className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Daily Wellness</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Personalized Indian meal planning, mL water tracking, menstrual &amp; maternal care.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0E1530]/90 border border-slate-800/90">
                  <div className="flex items-center space-x-2 text-indigo-300 font-bold text-sm mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Real-Time Shield AI</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    24/7 intelligent safety guidance, live daily updates, and smart nutrition support.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Visual Shield Showcase Card + Firebase Email Authentication */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-gradient-to-b from-[#131C3E] via-[#111735] to-[#0C1126] border border-purple-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative top glow */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-400 p-[2px] shadow-xl shadow-purple-900/50">
                  <div className="w-full h-full rounded-[22px] bg-[#0B1024] flex items-center justify-center">
                    <Shield className="w-8 h-8 text-pink-300 stroke-[2]" />
                  </div>
                </div>

                <div className="text-center space-y-1.5 mb-5">
                  <h2 className="text-xl font-bold text-white">
                    Protected &amp; Private by Design
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Sign in or register with Firebase Email &amp; Password Authentication and verified email security to access your SmartShield dashboard.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start space-x-2.5 text-xs text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Opening Page Email Address Entry Form */}
                <form onSubmit={handleWelcomeEmailSubmit} className="space-y-3.5" noValidate>
                  <div>
                    <label
                      htmlFor="welcome-email-input"
                      className="block text-[11px] font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="welcome-email-input"
                        type="email"
                        autoComplete="email"
                        value={welcomeEmail}
                        onChange={(e) => setWelcomeEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Continue with Email</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Already have a verified account?</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (welcomeEmail.trim()) {
                        setSignInEmail(welcomeEmail.trim());
                      }
                      switchScreen('signin');
                    }}
                    className="font-bold text-pink-300 hover:text-pink-200 underline underline-offset-4"
                  >
                    Sign In →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIGN IN SCREEN (Firebase signInWithEmailAndPassword) */}
        {screen === 'signin' && (
          <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="rounded-3xl bg-[#0B1028]/85 backdrop-blur-2xl border border-purple-500/40 p-6 sm:p-8 shadow-2xl shadow-purple-950/50">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-md shrink-0">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                    Welcome Back
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Sign in with your verified email and password
                  </p>
                </div>
              </div>

              {infoMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="signin-email"
                    className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="signin-password"
                      className="block text-xs font-bold uppercase tracking-wider text-purple-200"
                    >
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => switchScreen('forgot_password')}
                      className="text-xs font-semibold text-pink-300 hover:text-pink-200 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signin-password"
                      type={showSignInPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full min-h-[48px] pl-10 pr-12 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((prev) => !prev)}
                      aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-pink-300 transition-colors"
                    >
                      {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[50px] mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-60 text-white font-bold text-sm sm:text-base shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                <p className="text-xs sm:text-sm text-slate-300">
                  New to Smart Shield?{' '}
                  <button
                    type="button"
                    onClick={() => switchScreen('signup')}
                    className="font-bold text-pink-300 hover:text-pink-200 underline underline-offset-4 ml-1"
                  >
                    Create New Account
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SIGN UP SCREEN (Firebase createUserWithEmailAndPassword + sendEmailVerification) */}
        {screen === 'signup' && (
          <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="rounded-3xl bg-[#0B1028]/85 backdrop-blur-2xl border border-purple-500/40 p-6 sm:p-8 shadow-2xl shadow-purple-950/50">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-md shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                    Create Your Account
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Register with your email and password &amp; verify your email address
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMessage}</span>
                    {errorMessage.toLowerCase().includes('already exists') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSignInEmail(email.trim());
                          switchScreen('signin');
                        }}
                        className="block mt-1.5 font-bold text-pink-300 underline underline-offset-4"
                      >
                        Go to Sign In →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSignUpSubmit} className="space-y-4" noValidate>
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="signup-fullname"
                    className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                  >
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-fullname"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500"
                      required
                    />
                  </div>
                </div>

                {/* Email Address (Replaces Phone Number Input) */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500"
                      required
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                    >
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-password"
                        type={showSignUpPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full min-h-[48px] pl-10 pr-11 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword((prev) => !prev)}
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-pink-300"
                      >
                        {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                    >
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full min-h-[48px] pl-10 pr-11 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-pink-300"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Password Validation Checklist */}
                <div className="p-3 rounded-xl bg-[#090E22]/90 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasLetter ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>At least 1 letter</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>At least 1 number</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Passwords match</span>
                  </div>
                </div>

                {/* Accept Terms and Privacy Policy */}
                <div className="pt-1">
                  <label className="flex items-start space-x-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#090E22] text-pink-500 focus:ring-pink-400"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">
                      I agree to the Smart Shield{' '}
                      <button
                        type="button"
                        onClick={() => setTermsModalOpen('terms')}
                        className="font-semibold text-pink-300 hover:text-pink-200 underline underline-offset-2"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => setTermsModalOpen('privacy')}
                        className="font-semibold text-pink-300 hover:text-pink-200 underline underline-offset-2"
                      >
                        Privacy Policy
                      </button>
                      .
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-60 text-white font-bold text-sm sm:text-base shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Account &amp; Sending Verification Email...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account &amp; Send Verification Email</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                <p className="text-xs sm:text-sm text-slate-300">
                  Already have a Smart Shield account?{' '}
                  <button
                    type="button"
                    onClick={() => switchScreen('signin')}
                    className="font-bold text-pink-300 hover:text-pink-200 underline underline-offset-4 ml-1"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL VERIFICATION REQUIRED SCREEN (Requires verified email before opening SmartShield dashboard) */}
        {(screen === 'verify_email' || screen === 'verify_code') && (
          <EmailVerificationScreen
            email={verificationEmailTarget || auth.currentUser?.email || email || signInEmail || ''}
            onVerified={async () => {
              const activeUser = auth.currentUser;
              if (activeUser) {
                try {
                  const idToken = await activeUser.getIdToken(true);
                  const { user } = await AuthService.completeFirebaseEmailAuth({
                    firebaseUid: activeUser.uid,
                    email: activeUser.email || verificationEmailTarget,
                    emailVerified: true,
                    idToken,
                    fullName: activeUser.displayName || pendingSignupProfile?.fullName || fullName.trim() || undefined,
                    password: pendingSignupProfile?.password || signInPassword || undefined
                  });
                  onAuthenticated(user);
                } catch {
                  await handleCheckEmailVerified();
                }
              } else {
                await handleCheckEmailVerified();
              }
            }}
            onBackToSignIn={() => switchScreen('signin')}
            onUseDifferentEmail={() => switchScreen('signup')}
          />
        )}

        {/* FORGOT PASSWORD SCREEN (Firebase sendPasswordResetEmail) */}
        {screen === 'forgot_password' && (
          <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="rounded-3xl bg-[#0B1028]/85 backdrop-blur-2xl border border-purple-500/40 p-6 sm:p-8 shadow-2xl shadow-purple-950/50">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-md shrink-0">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-white">
                    Reset Your Password
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Receive a password reset email via Firebase Auth
                  </p>
                </div>
              </div>

              {infoMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start space-x-2.5 text-xs sm:text-sm text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-bold uppercase tracking-wider text-purple-200 mb-1.5"
                  >
                    Registered Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl bg-[#090E22] border border-slate-700/90 focus:border-pink-400 focus:outline-none text-sm text-white placeholder-slate-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Password Reset Email...</span>
                    </>
                  ) : (
                    <>
                      <span>{resetEmailSent ? 'Resend Password Reset Email' : 'Send Password Reset Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (resetEmail.trim()) {
                      setSignInEmail(resetEmail.trim());
                    }
                    switchScreen('signin');
                  }}
                  className="text-xs font-semibold text-pink-300 hover:text-pink-200"
                >
                  ← Back to Sign In
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with Direct Emergency Helpline Access */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <span>SMART SHIELD • Personal Safety, Wellness &amp; Confidence</span>
        <div className="flex items-center space-x-4">
          <a
            href="tel:112"
            className="text-pink-300 hover:text-pink-200 font-semibold transition-colors"
          >
            Emergency Helpline: 112
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="tel:1091"
            className="text-purple-300 hover:text-purple-200 font-semibold transition-colors"
          >
            Women Helpline: 1091
          </a>
        </div>
      </footer>

      {/* Terms of Service & Privacy Policy Modal */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#0F1734] border border-purple-500/40 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-pink-400" />
                <h2 className="text-base font-bold text-white">
                  {termsModalOpen === 'terms'
                    ? 'Smart Shield Terms of Service'
                    : 'Smart Shield Privacy & Security Policy'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTermsModalOpen(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pr-1">
              {termsModalOpen === 'terms' ? (
                <>
                  <p>
                    <strong>1. Purpose &amp; Emergency Usage:</strong> Smart Shield provides personal safety tools, SOS alerts to user-saved contacts, GPS location sharing, and educational wellness guidance. In life-threatening situations, always contact official emergency services (112 / 100 / 108) directly.
                  </p>
                  <p>
                    <strong>2. User-Controlled Emergency Contacts:</strong> Smart Shield never dispatches SOS messages to random or dummy contacts. Alerts are sent strictly to contacts you explicitly add and save.
                  </p>
                  <p>
                    <strong>3. Health &amp; Nutrition Disclaimer:</strong> Nutrition AI, menstrual tracking, and pregnancy wellness features provide evidence-based educational information and do not replace professional medical advice from a qualified clinician.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>1. Firebase Email &amp; Password Security:</strong> Smart Shield authenticates your account using Firebase Email/Password Authentication and requires a verified email address before granting access to your dashboard.
                  </p>
                  <p>
                    <strong>2. Location &amp; Sensor Privacy:</strong> GPS coordinates, camera, and microphone permissions are accessed only when you use location or SOS features.
                  </p>
                  <p>
                    <strong>3. Data Control:</strong> You can manage or delete your saved contacts, meal logs, and water tracking records at any time from your dashboard.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(true);
                  setTermsModalOpen(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold"
              >
                Accept &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
