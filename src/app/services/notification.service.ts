import { Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, Messaging } from 'firebase/messaging';
import { SupabaseService } from './supabase.service';

interface FirebaseWebConfig extends FirebaseOptions {
  vapidKey: string;
}

declare global {
  interface Window { FIREBASE_CONFIG?: FirebaseWebConfig; }
}

/** Registro de notificaciones Web Push para talleres mediante Firebase Cloud Messaging. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /** Solicita permiso, obtiene/renueva el token FCM y lo registra en Supabase. */
  async activarNotificaciones(): Promise<string | null> {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) {
      throw new Error('Este navegador no es compatible con notificaciones push.');
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return null;

    const config = window.FIREBASE_CONFIG;
    if (!config?.apiKey || !config.vapidKey) {
      throw new Error('La configuración pública de Firebase no está disponible.');
    }

    this.app ??= initializeApp(config);
    this.messaging ??= getMessaging(this.app);

    // Alcance aislado: no reemplaza el worker PWA de Angular (`ngsw-worker.js`).
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-messaging/',
    });
    const token = await getToken(this.messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) throw new Error('Firebase no generó un token de notificaciones.');
    await this.supabase.registrarSuscripcionPush(token, navigator.userAgent);
    return token;
  }
}
