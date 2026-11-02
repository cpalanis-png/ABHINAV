# SMART SHIELD 5.0 — Free-Tier Static Deployment Guide (No Billing / No Credit Card Required)

## 1. Why AI Studio's Built-In "Publish" Button Requested Google Cloud Billing
When you click **Publish** directly inside Google AI Studio, AI Studio provisions a managed **Google Cloud Run** container (`server.ts` + Node.js Express server) inside your Google Cloud project.
- **Google Cloud Run**, **Cloud Build**, and **Artifact Registry** require an active **Google Cloud Billing Account** attached to the project—even if your traffic stays within the monthly free quota.
- Similarly, deploying **Firebase Cloud Functions** requires upgrading a Firebase project from the free **Spark Plan** to the pay-as-you-go **Blaze Plan**.

To publish Smart Shield **without enabling Google Cloud Billing, without entering a credit card, and without upgrading Firebase to Blaze**, deploy the compiled React frontend (`dist/`) to **Firebase Hosting (Spark Free Plan)**, **Vercel (Hobby Free)**, **Netlify (Starter Free)**, or **GitHub Pages**.

---

## 2. How Frontend & Backend Dependencies Were Separated
1. **100% Client-Side Firebase Spark Authentication (`src/services/authService.ts`)**
   - Firebase Email/Password Authentication and Email Verification are **free on the Firebase Spark Plan** (up to 50,000 Monthly Active Users).
   - `AuthService.completeFirebaseEmailAuth()` and `AuthService.verifyActiveSession()` now automatically detect when the app is hosted on a static host (where `/api/auth/*` is not running) and complete session creation directly using the verified Firebase Authentication user and `localStorage`—without requiring a Node.js backend.
2. **Software-Only Android SOS SMS (`src/services/sosAlertService.ts`)**
   - Does **not** require Twilio, paid SMS gateways, or Cloud Functions.
   - Uses standard Android `smsto:` / `ACTION_SENDTO` intents to open the device's default Messaging app pre-populated with your saved emergency contacts and GPS Google Maps link, and clearly instructs the user to press **Send**.
3. **Static Frontend Build Script (`package.json` & `firebase.json`)**
   - Added `"build:static": "vite build"` to compile the pure static SPA bundle into `dist/`.
   - Added `firebase.json` configured strictly for **Firebase Hosting (Spark Plan)** with SPA rewrites (`** -> /index.html`) and **zero** Cloud Functions or Cloud Run bindings.
4. **No Exposed API Keys in Frontend Code**
   - `GEMINI_API_KEY` is never bundled into the frontend code.

---

## 3. Feature Availability Matrix (Free Static Hosting vs. Paid/Server Backend)

| Feature | Works on Free Static Hosting (Spark Plan)? | Technical Details & Limitations |
| :--- | :--- | :--- |
| **3D Holographic Login & UI** | **Yes (100% Free)** | Runs client-side via WebGL / Three.js with CSS fallback. |
| **Firebase Email Auth & Verification** | **Yes (100% Free)** | Uses Firebase Auth Spark Free Tier (no credit card required). |
| **Emergency SOS & Trusted Contacts** | **Yes (100% Free)** | Opens the Android Messaging app with recipient & GPS link prefilled; user presses **Send** to dispatch. |
| **GPS Truth Engine & Offline Map Cache** | **Yes (100% Free)** | Uses browser/Android Geolocation, OpenStreetMap tiles, Overpass public API, and IndexedDB offline persistence. |
| **AI Private Space Security Scanner** | **Yes (100% Free)** | Camera Lens CV reflection detector, IR remote calibration, IEEE OUI MAC vendor lookup, hardware Magnetometer, Electronic Bug Checklist, and On-Device Deterministic Security Reports all run 100% on-device. |
| **Menstrual, Pregnancy & Nutrition Hub** | **Yes (100% Free)** | Cycle tracking, South Indian meal planner, water tracker, and kick counter persist locally on the device. |
| **Cloud Gemini AI Chat / Media Generation** | **Requires Backend Proxy** | `/api/chat` and `/api/media/*` require the Node.js server with `GEMINI_API_KEY`. On static-only hosting, the app honestly reports that the AI server is unreachable rather than faking AI responses or exposing API keys in the browser. |
| **Automatic Background Carrier SMS** | **Not Used (Software-Only)** | Carrier APIs like Twilio require paid per-SMS billing; Smart Shield uses the free Android SMS composer intent instead. |

---

## 4. Exact Steps to Deploy for Free (Zero Billing)

### Option A: Firebase Hosting on the Free Spark Plan (Recommended)
Firebase Hosting is included in the **Firebase Spark Plan ($0/month, no credit card or billing account required)**.

1. **Download / Clone Your Project** to your computer and install dependencies:
   ```bash
   npm install
   ```
2. **Build the Static Frontend Bundle (`dist/`)**:
   ```bash
   npm run build:static
   ```
3. **Install the Firebase CLI** (if not already installed) and log in:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
4. **Deploy Only Static Hosting** to your existing Firebase project (`firebase.json` is already pre-configured):
   ```bash
   firebase deploy --only hosting --project <YOUR_FIREBASE_PROJECT_ID>
   ```
5. **Authorize Your Free `.web.app` Domain in Firebase Auth**:
   - Open [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Settings** → **Authorized domains**, and ensure `<YOUR_FIREBASE_PROJECT_ID>.web.app` is listed (Firebase adds it automatically by default).

### Option B: Vercel or Netlify Free Static Hosting (No Credit Card Required)
1. Push your repository to GitHub.
2. Import the repository into **Vercel (Hobby Free)** or **Netlify (Starter Free)**.
3. Set the build settings:
   - **Build Command:** `npm run build:static`
   - **Output / Publish Directory:** `dist`
4. After deployment, copy your free `.vercel.app` or `.netlify.app` domain and add it under **Firebase Console → Authentication → Settings → Authorized domains** so Firebase Email Authentication works on that domain.
