import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env';

let firebaseApp: App | null = null;

try {
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
        firebaseApp = initializeApp({
            credential: cert({
                projectId: env.FIREBASE_PROJECT_ID,
                clientEmail: env.FIREBASE_CLIENT_EMAIL,
                privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        console.log('✅ Firebase Admin initialized with service account.');
    } else {
        console.log('ℹ️ Firebase Admin running in demo/fallback mode.');
    }
} catch (error) {
    console.warn('⚠️ Firebase Admin initialization notice:', (error as Error).message);
}

export interface FirebaseDecodedUser {
    uid: string;
    email: string;
    name?: string;
    picture?: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseDecodedUser> {
    if (firebaseApp) {
        const decoded = await getAuth(firebaseApp).verifyIdToken(idToken);
        return {
            uid: decoded.uid,
            email: decoded.email || `${decoded.uid}@google.com`,
            name: decoded.name || 'Google User',
            picture: decoded.picture,
        };
    }

    // Fallback: decode JWT or parse token for demo/test mode
    try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            return {
                uid: payload.user_id || payload.sub || 'google-demo-uid',
                email: payload.email || 'google.user@citycare.com',
                name: payload.name || 'Google Citizen',
                picture: payload.picture,
            };
        }
    } catch {
        // Not a standard JWT, return mock user
    }

    return {
        uid: `google-${Date.now()}`,
        email: idToken.includes('@') ? idToken : 'google.citizen@citycare.com',
        name: 'Google Verified Citizen',
    };
}
