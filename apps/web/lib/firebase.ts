/**
 * Firebase client SDK initialiser, used to drive the SMS
 * OTP flow for phone verification (10 free SMS/day on the Spark plan).
 * Setup (in Firebase Console):
 *   1. Create a Firebase project (or pick an existing one).
 *   2. Authentication → Sign-in method → enable "Phone".
 *   3. Project Settings → "Your apps" → add a Web app → copy the
 *      generated config object.
 *   4. Set these env vars on Fly (`metu` web app), prefixed
 *      NEXT_PUBLIC_ so they're inlined at build time:
 *        flyctl secrets set \
 *          NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy... \
 *          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com \
 *          NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id> \
 *          -a metu
 * If any of these are missing, `firebaseConfigured` is false and the
 * phone-verify component falls back to the existing in-house OTP flow
 * (with the OTP printed to Fly logs in DEMO_REVEAL_TOKENS mode).
 * Why public-by-design? Firebase relies on App Check / reCAPTCHA +
 * Authentication security rules, not key secrecy. The "API key"
 * here is a project identifier, not a credential.
 */
"use client";
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId,
);

let app: FirebaseApp | null = null;
let authClient: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(config);
  }
  if (!authClient) {
    authClient = getAuth(app);
  }
  return authClient;
}
