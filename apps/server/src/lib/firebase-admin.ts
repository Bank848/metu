/**
 * Phase 46 — Firebase Admin SDK initialiser, used to verify ID tokens
 * issued by Firebase Phone Auth on the client.
 *
 * Setup (one-time, in Firebase Console):
 *   1. Console → Authentication → Sign-in method → enable "Phone".
 *   2. Console → Project Settings → Service Accounts → "Generate new
 *      private key". Download the JSON.
 *   3. On Fly: paste the entire JSON content as the value of the
 *      FIREBASE_SERVICE_ACCOUNT_JSON secret:
 *
 *        flyctl secrets set FIREBASE_SERVICE_ACCOUNT_JSON='<paste>' -a metu-api
 *
 *   4. The web app additionally needs (in Fly secrets on `metu`):
 *        NEXT_PUBLIC_FIREBASE_API_KEY
 *        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN  (typically <project>.firebaseapp.com)
 *        NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *
 *      These come from Console → Project Settings → "Your apps" → Web
 *      app config object. They're public-by-design (Firebase relies on
 *      reCAPTCHA + security rules, not key secrecy).
 *
 * If FIREBASE_SERVICE_ACCOUNT_JSON is not set, this module exports
 * `firebaseAdminConfigured = false` and verification calls throw a
 * clean 503 — useful for keeping the rest of the API working when
 * we haven't onboarded Firebase yet.
 */
import type { App } from "firebase-admin/app";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { AppError } from "../utils/errors.js";

const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let app: App | null = null;

if (SERVICE_ACCOUNT_JSON) {
  try {
    const parsed = JSON.parse(SERVICE_ACCOUNT_JSON);
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          // Newlines in the private key get escaped when set via flyctl;
          // unescape so PEM parsing works.
          privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
        }),
      });
    } else {
      app = getApp();
    }
  } catch (err) {
    console.error(
      "[firebase-admin] Failed to initialise from FIREBASE_SERVICE_ACCOUNT_JSON. Phone-auth verify endpoint will return 503.",
      err,
    );
    app = null;
  }
}

export const firebaseAdminConfigured = app !== null;

/**
 * Verify a Firebase ID token issued to the user's session by the
 * client SDK after a successful phone-OTP confirmation. Returns the
 * decoded token (which contains `phone_number`, `uid`, etc.) so the
 * caller can mark `user.phoneVerifiedAt` in our own DB.
 *
 * Throws AppError(503) when Firebase isn't configured yet so the
 * frontend can show a clean "phone verification temporarily
 * unavailable" message instead of a generic 500.
 */
export async function verifyFirebaseIdToken(idToken: string) {
  if (!app) {
    throw new AppError(
      503,
      "PhoneAuthNotConfigured",
      "Phone verification is temporarily unavailable.",
    );
  }
  try {
    const decoded = await getAdminAuth(app).verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    throw new AppError(401, "InvalidFirebaseToken", "Phone token is invalid or expired.");
  }
}
