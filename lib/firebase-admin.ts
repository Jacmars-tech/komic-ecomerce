import * as admin from "firebase-admin";

export const hasAdminCreds =
  !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_CLIENT_EMAIL && !!process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (hasAdminCreds) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
      })
    });
  } else {
    console.warn("Firebase Admin credentials missing. Server-side Firebase features will not function.");
  }
}

export const adminDb: admin.firestore.Firestore | null = hasAdminCreds ? admin.firestore() : null;
export const adminAuth: admin.auth.Auth | null = hasAdminCreds ? admin.auth() : null;

export function requireAdminDb(): admin.firestore.Firestore {
  if (!adminDb) {
    throw new Error("Firestore admin client is not configured.");
  }
  return adminDb;
}

export function requireAdminAuth(): admin.auth.Auth {
  if (!adminAuth) {
    throw new Error("Firebase admin auth is not configured.");
  }
  return adminAuth;
}
