"use client";

import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase/client";

let cachedDb: Firestore | null = null;

export function getFirebaseDb() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!cachedDb) {
    cachedDb = getFirestore(app);
  }

  return cachedDb;
}
