import admin from 'firebase-admin';

if (!admin.apps.length) {
	admin.initializeApp({
		projectId: process.env.FIREBASE_PROJECT_ID,
	});
}

export async function verify_firebase_token(token: string): Promise<string> {
	const decoded = await admin.auth().verifyIdToken(token);
	return decoded.uid;
}
