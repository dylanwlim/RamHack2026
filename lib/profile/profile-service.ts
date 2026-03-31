"use client";

import type { User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getTrustTier } from "@/lib/crowd-signal/scoring";
import { getFirebaseDb } from "@/lib/firebase/client";
import { toDate } from "@/lib/firebase/firestore-utils";
import {
  createDefaultProfile,
  deriveDisplayName,
  deriveNameParts,
} from "@/lib/profile/profile-defaults";
import type { RecentSearchEntry, UserProfileRecord } from "@/lib/profile/profile-types";

const ALLOWED_SEARCH_RADII = [2, 5, 10, 25] as const;

type ProfileUser = Pick<User, "uid" | "email" | "displayName">;
type RawRecentSearchEntry = {
  medication?: string;
  location?: string;
  radiusMiles?: number;
  createdAt?: unknown;
};

function cleanString(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value.trim();
  }

  return fallback;
}

function cleanContributionCount(value: unknown) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return 0;
  }

  return Math.floor(nextValue);
}

function cleanSearchRadius(value: unknown) {
  const nextValue = Number(value);
  return ALLOWED_SEARCH_RADII.includes(nextValue as (typeof ALLOWED_SEARCH_RADII)[number])
    ? nextValue
    : 5;
}

function normalizeProfileRecord(
  user: ProfileUser,
  existing: Partial<UserProfileRecord> | null = null,
  overrides: Partial<UserProfileRecord> = {},
): UserProfileRecord {
  const base = createDefaultProfile(user);
  const merged = {
    ...base,
    ...(existing || {}),
    ...overrides,
  };

  const displayName = cleanString(merged.displayName, "") || deriveDisplayName(user);
  const names = deriveNameParts(displayName);
  const city = cleanString(merged.city);
  const state = cleanString(merged.state);
  const zipCode = cleanString(merged.zipCode);
  const contributionCount = cleanContributionCount(merged.contributionCount);
  const contributorAlias = cleanString(merged.contributorAlias, displayName) || displayName;

  return {
    uid: user.uid,
    email: cleanString(merged.email, user.email || ""),
    displayName,
    firstName: cleanString(merged.firstName, names.firstName),
    lastName: cleanString(merged.lastName, names.lastName),
    city,
    state,
    zipCode,
    defaultLocationLabel: cleanString(merged.defaultLocationLabel),
    preferredSearchRadius: cleanSearchRadius(merged.preferredSearchRadius),
    publicContributorAlias: Boolean(merged.publicContributorAlias),
    contributorAlias,
    notifyCrowdUpdates:
      merged.notifyCrowdUpdates === undefined ? true : Boolean(merged.notifyCrowdUpdates),
    notifyShortageChanges:
      merged.notifyShortageChanges === undefined ? true : Boolean(merged.notifyShortageChanges),
    notifySavedSearchUpdates: Boolean(merged.notifySavedSearchUpdates),
    contributionCount,
    contributionLevel:
      cleanString(merged.contributionLevel, getTrustTier(contributionCount).label) ||
      getTrustTier(contributionCount).label,
    createdAt: toDate(merged.createdAt),
    updatedAt: toDate(merged.updatedAt),
    lastContributionAt: toDate(merged.lastContributionAt),
    recentSearches: mapRecentSearches(merged.recentSearches),
  };
}

function mapRecentSearches(value: unknown): RecentSearchEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const item = entry as RawRecentSearchEntry;
      return {
        medication: item.medication?.trim() || "",
        location: item.location?.trim() || "",
        radiusMiles: Number(item.radiusMiles || 5),
        createdAt: toDate(item.createdAt),
      };
    })
    .filter((entry) => entry.medication && entry.location)
    .slice(0, 6);
}

export function mapProfileDoc(id: string, value: Record<string, unknown>): UserProfileRecord {
  const displayName = String(value.displayName || "").trim() || "PharmaPath User";
  const names = deriveNameParts(displayName);
  const contributionCount = cleanContributionCount(value.contributionCount);

  return {
    uid: id,
    email: String(value.email || "").trim(),
    displayName,
    firstName: String(value.firstName || names.firstName).trim(),
    lastName: String(value.lastName || names.lastName).trim(),
    city: String(value.city || "").trim(),
    state: String(value.state || "").trim(),
    zipCode: String(value.zipCode || "").trim(),
    defaultLocationLabel: String(value.defaultLocationLabel || "").trim(),
    preferredSearchRadius: cleanSearchRadius(value.preferredSearchRadius),
    publicContributorAlias: Boolean(value.publicContributorAlias),
    contributorAlias: String(value.contributorAlias || displayName).trim(),
    notifyCrowdUpdates:
      value.notifyCrowdUpdates === undefined ? true : Boolean(value.notifyCrowdUpdates),
    notifyShortageChanges:
      value.notifyShortageChanges === undefined ? true : Boolean(value.notifyShortageChanges),
    notifySavedSearchUpdates: Boolean(value.notifySavedSearchUpdates),
    contributionCount,
    contributionLevel: String(value.contributionLevel || getTrustTier(contributionCount).label),
    createdAt: toDate(value.createdAt),
    updatedAt: toDate(value.updatedAt),
    lastContributionAt: toDate(value.lastContributionAt),
    recentSearches: mapRecentSearches(value.recentSearches),
  };
}

async function writeUserProfile(
  user: ProfileUser,
  overrides: Partial<UserProfileRecord> = {},
) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const profileRef = doc(db, "profiles", user.uid);
  await runTransaction(db, async (transaction) => {
    const existingSnapshot = await transaction.get(profileRef);
    const existingProfile = existingSnapshot.exists()
      ? mapProfileDoc(existingSnapshot.id, existingSnapshot.data())
      : null;
    const nextProfile = normalizeProfileRecord(user, existingProfile, overrides);
    const existingCreatedAt = existingSnapshot.exists() ? existingSnapshot.data().createdAt : null;

    transaction.set(profileRef, {
      ...nextProfile,
      createdAt: existingCreatedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function ensureUserProfile(
  user: ProfileUser,
  overrides: Partial<UserProfileRecord> = {},
) {
  await writeUserProfile(user, overrides);
}

export function subscribeToUserProfile(
  uid: string,
  callback: (profile: UserProfileRecord | null) => void,
) {
  const db = getFirebaseDb();
  if (!db) {
    callback(null);
    return () => undefined;
  }

  return onSnapshot(doc(db, "profiles", uid), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(mapProfileDoc(snapshot.id, snapshot.data()));
  });
}

export async function saveUserProfile(
  user: ProfileUser,
  input: Partial<UserProfileRecord>,
) {
  await writeUserProfile(user, input);
}

export async function saveRecentSearch(
  uid: string,
  input: {
    medication: string;
    location: string;
    radiusMiles: number;
  },
) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  const profileRef = doc(db, "profiles", uid);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    const existing = snapshot.exists() ? mapProfileDoc(snapshot.id, snapshot.data()) : null;

    const nextEntry = {
      medication: input.medication.trim(),
      location: input.location.trim(),
      radiusMiles: input.radiusMiles,
      createdAt: new Date().toISOString(),
    };

    const currentEntries = (existing?.recentSearches || [])
      .map((entry) => ({
        medication: entry.medication,
        location: entry.location,
        radiusMiles: entry.radiusMiles,
        createdAt: entry.createdAt?.toISOString() || new Date().toISOString(),
      }))
      .filter(
        (entry) =>
          !(
            entry.medication.toLowerCase() === nextEntry.medication.toLowerCase() &&
            entry.location.toLowerCase() === nextEntry.location.toLowerCase()
          ),
      );

    transaction.set(
      profileRef,
      {
        recentSearches: [nextEntry, ...currentEntries].slice(0, 6),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}
