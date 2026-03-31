"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    return null;
  }

  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return cachedApp;
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
}

export async function setAuthPersistence(mode: "local" | "session") {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }

  await setPersistence(
    auth,
    mode === "local" ? browserLocalPersistence : browserSessionPersistence,
  );
}
