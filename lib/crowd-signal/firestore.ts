"use client";

import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { CrowdReportRecord, CrowdReportType } from "@/lib/crowd-signal/model";
import {
  buildPharmacyKey,
  buildSignalKey,
  extractFormulationDescriptor,
  extractStrengthDescriptor,
  getTrustTier,
  normalizeMedicationKey,
} from "@/lib/crowd-signal/scoring";
import { getFirebaseDb } from "@/lib/firebase/firestore-client";
import { toDate } from "@/lib/firebase/firestore-utils";
import { createDefaultProfile } from "@/lib/profile/profile-defaults";
import {
  ensureUserProfile,
  mapProfileDoc,
} from "@/lib/profile/profile-service";
import type { UserProfileRecord } from "@/lib/profile/profile-types";

const MAX_NOTE_LENGTH = 240;

type RawCrowdReport = Record<string, unknown>;

function mapCrowdReport(id: string, value: RawCrowdReport): CrowdReportRecord {
  return {
    id,
    signalKey: String(value.signalKey || ""),
    medicationKey: String(value.medicationKey || ""),
    pharmacyKey: String(value.pharmacyKey || ""),
    pharmacyName: String(value.pharmacyName || ""),
    pharmacyAddress: String(value.pharmacyAddress || ""),
    pharmacyPlaceId: value.pharmacyPlaceId ? String(value.pharmacyPlaceId) : null,
    googleMapsUrl: value.googleMapsUrl ? String(value.googleMapsUrl) : null,
    medicationQuery: String(value.medicationQuery || ""),
    strengthDescriptor: value.strengthDescriptor ? String(value.strengthDescriptor) : null,
    formulationDescriptor: value.formulationDescriptor ? String(value.formulationDescriptor) : null,
    reportType: value.reportType as CrowdReportType,
    note: String(value.note || ""),
    createdAt: toDate(value.createdAt),
    updatedAt: toDate(value.updatedAt),
    userId: String(value.userId || ""),
    reporterDisplayName: String(value.reporterDisplayName || ""),
    publicAliasSnapshot: String(value.publicAliasSnapshot || ""),
    reporterContributionCount: Number(value.reporterContributionCount || 0),
    reporterTrustWeight:
      value.reporterTrustWeight === undefined || value.reporterTrustWeight === null
        ? null
        : Number(value.reporterTrustWeight || 0),
  };
}

export function subscribeToCrowdReportsForMedication(
  medicationQuery: string,
  callback: (reports: CrowdReportRecord[]) => void,
) {
  const db = getFirebaseDb();
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const normalizedMedicationKey = normalizeMedicationKey(medicationQuery);
  if (!normalizedMedicationKey) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, "crowdReports"),
      where("medicationKey", "==", normalizedMedicationKey),
    ),
    (snapshot) => {
      callback(snapshot.docs.map((entry) => mapCrowdReport(entry.id, entry.data())));
    },
  );
}

export async function listCrowdReportsForUser(userId: string) {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "crowdReports"), where("userId", "==", userId)),
  );

  return snapshot.docs
    .map((entry) => mapCrowdReport(entry.id, entry.data()))
    .sort((left, right) => {
      const leftTime = left.createdAt?.getTime() || 0;
      const rightTime = right.createdAt?.getTime() || 0;
      return rightTime - leftTime;
    });
}

export async function submitCrowdReport(input: {
  actor: User;
  profile: UserProfileRecord | null;
  medicationQuery: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPlaceId?: string | null;
  googleMapsUrl?: string | null;
  reportType: CrowdReportType;
  note?: string;
}) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const medicationQuery = input.medicationQuery.trim();
  const pharmacyName = input.pharmacyName.trim();
  const pharmacyAddress = input.pharmacyAddress.trim();
  const pharmacyKey = buildPharmacyKey({
    placeId: input.pharmacyPlaceId,
    pharmacyName,
    pharmacyAddress,
  });
  const medicationKey = normalizeMedicationKey(medicationQuery);
  const signalKey = buildSignalKey({
    medicationQuery,
    placeId: input.pharmacyPlaceId,
    pharmacyName,
    pharmacyAddress,
  });
  const note = (input.note || "").trim().slice(0, MAX_NOTE_LENGTH);

  if (!medicationKey || !pharmacyName || !pharmacyAddress) {
    throw new Error("Medication and pharmacy details are required.");
  }

  await ensureUserProfile(input.actor, input.profile || {});

  const profileRef = doc(db, "profiles", input.actor.uid);
  const reportRef = doc(collection(db, "crowdReports"));

  await runTransaction(db, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const currentProfile = profileSnapshot.exists()
      ? mapProfileDoc(profileSnapshot.id, profileSnapshot.data())
      : input.profile || createDefaultProfile(input.actor);

    const currentContributionCount = Number(currentProfile.contributionCount || 0);
    const nextContributionCount = currentContributionCount + 1;
    const displayName =
      currentProfile.displayName?.trim() ||
      input.actor.displayName?.trim() ||
      "PharmaPath Contributor";
    const contributorAlias =
      currentProfile.contributorAlias?.trim() || displayName;

    transaction.set(reportRef, {
      signalKey,
      medicationKey,
      pharmacyKey,
      pharmacyName,
      pharmacyAddress,
      pharmacyPlaceId: input.pharmacyPlaceId || null,
      googleMapsUrl: input.googleMapsUrl || null,
      medicationQuery,
      strengthDescriptor: extractStrengthDescriptor(medicationQuery),
      formulationDescriptor: extractFormulationDescriptor(medicationQuery),
      reportType: input.reportType,
      note,
      userId: input.actor.uid,
      reporterDisplayName: displayName,
      publicAliasSnapshot: currentProfile.publicContributorAlias ? contributorAlias : "Private contributor",
      reporterContributionCount: currentContributionCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      profileRef,
      {
        uid: input.actor.uid,
        email: input.actor.email || currentProfile.email || "",
        displayName,
        firstName: currentProfile.firstName || "",
        lastName: currentProfile.lastName || "",
        city: currentProfile.city || "",
        state: currentProfile.state || "",
        zipCode: currentProfile.zipCode || "",
        defaultLocationLabel: currentProfile.defaultLocationLabel || "",
        preferredSearchRadius: Number(currentProfile.preferredSearchRadius || 5),
        publicContributorAlias: Boolean(currentProfile.publicContributorAlias),
        contributorAlias,
        notifyCrowdUpdates:
          currentProfile.notifyCrowdUpdates === undefined
            ? true
            : Boolean(currentProfile.notifyCrowdUpdates),
        notifyShortageChanges:
          currentProfile.notifyShortageChanges === undefined
            ? true
            : Boolean(currentProfile.notifyShortageChanges),
        notifySavedSearchUpdates: Boolean(currentProfile.notifySavedSearchUpdates),
        contributionCount: nextContributionCount,
        contributionLevel: getTrustTier(nextContributionCount).label,
        lastContributionAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: profileSnapshot.exists() ? currentProfile.createdAt || serverTimestamp() : serverTimestamp(),
      },
      { merge: true },
    );
  });
}
