import admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!FIREBASE_PROJECT_ID) {
	throw new Error('FIREBASE_PROJECT_ID must be set');
}

if (!admin.apps.length) {
	admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
}

export async function verify_firebase_token(token: string): Promise<string> {
	const decoded = await admin.auth().verifyIdToken(token);
	return decoded.uid;
}
