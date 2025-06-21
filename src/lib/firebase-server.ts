import admin from 'firebase-admin';

// A singleton instance of admin auth
let adminAuthInstance: admin.auth.Auth | null = null;

// A function to get the admin auth instance.
// It initializes the app only once.
function getAdminAuth() {
  if (adminAuthInstance) {
    return adminAuthInstance;
  }

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    // This error will be caught by the server action and displayed to the user.
    // This allows the app to build and run even without the env vars.
    throw new Error('Konfigurasi Firebase di sisi server tidak lengkap. Fitur otentikasi dinonaktifkan.');
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: (process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
      }),
    });
  }

  adminAuthInstance = admin.auth();
  return adminAuthInstance;
}

export { getAdminAuth };
