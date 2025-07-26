import admin from 'firebase-admin';
import path from 'path';

console.log("Firebase config file is being executed!");

if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../../vault-45605-firebase-adminsdk-fbsvc-5f971ccde3.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: process.env.FIREBASE_PROJECT_ID!,
  });
}

export const firestore = admin.firestore();
export const messaging = admin.messaging();
export const auth = admin.auth();

export default admin;