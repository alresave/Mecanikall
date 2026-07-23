import { access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const output = new URL('../firebase-config.js', import.meta.url);
const variables = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  vapidKey: process.env.FIREBASE_VAPID_KEY,
};
const missing = Object.entries(variables).filter(([, value]) => !value).map(([name]) => name);

if (missing.length) {
  // Permite compilar localmente si el archivo público ya fue creado de forma manual.
  try {
    await access(output, constants.F_OK);
    console.warn('[firebase-config] Se conserva el archivo local existente.');
  } catch {
    console.warn(`[firebase-config] No se generó configuración: faltan ${missing.join(', ')}.`);
  }
} else {
  const content = `// Generado durante el build. No contiene credenciales de servidor.\nself.FIREBASE_CONFIG = ${JSON.stringify(variables, null, 2)};\n`;
  await writeFile(output, content, 'utf8');
  console.log('[firebase-config] Configuración pública de Firebase generada.');
}
