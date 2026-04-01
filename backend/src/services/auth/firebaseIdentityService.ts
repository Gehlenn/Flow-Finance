import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import env from '../../config/env';

export interface VerifiedFirebaseIdentity {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}

function hasServiceAccountCredentials(): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

function hasApplicationDefaultCredentials(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export function isFirebaseIdentityVerificationConfigured(): boolean {
  return hasServiceAccountCredentials() || hasApplicationDefaultCredentials();
}

function getFirebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  if (hasServiceAccountCredentials()) {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  }

  if (hasApplicationDefaultCredentials()) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: env.FIREBASE_PROJECT_ID || undefined,
    });
  }

  throw new Error('Firebase identity verification is not configured');
}

function mapDecodedToken(decoded: DecodedIdToken): VerifiedFirebaseIdentity {
  const email = decoded.email;
  if (!email) {
    throw new Error('Firebase token is missing email');
  }

  return {
    userId: decoded.uid,
    email,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
    emailVerified: Boolean(decoded.email_verified),
  };
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const adminApp = getFirebaseAdminApp();
  const decoded = await getAuth(adminApp).verifyIdToken(idToken, true);
  return mapDecodedToken(decoded);
}
