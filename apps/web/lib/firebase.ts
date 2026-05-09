/**
 * Firebase client SDK initialiser for the SMS OTP phone-verify flow.
 * Reads NEXT_PUBLIC_FIREBASE_* env vars at build time. When any are
 * missing `firebaseConfigured` is false and the phone-verify component
 * falls back to the in-house OTP flow.
 */
"use client";
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

// Treat the Dockerfile build-time placeholders as "unconfigured" so we
// don't surface auth/api-key-not-valid as a runtime bug.
function looksLikePlaceholder(v: string): boolean {
  return !v || v.includes("placeholder") || v.includes("build-");
}

export const firebaseConfigured = Boolean(
  config.apiKey &&
    config.authDomain &&
    config.projectId &&
    !looksLikePlaceholder(config.apiKey) &&
    !looksLikePlaceholder(config.authDomain) &&
    !looksLikePlaceholder(config.projectId),
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
