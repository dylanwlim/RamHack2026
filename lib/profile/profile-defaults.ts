"use client";

import type { User } from "firebase/auth";
import { getTrustTier } from "@/lib/crowd-signal/scoring";
import type { UserProfileRecord } from "@/lib/profile/profile-types";

type ProfileUser = Pick<User, "uid" | "email" | "displayName">;

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function deriveDisplayName(user: Pick<User, "displayName" | "email">) {
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  const emailPrefix = user.email?.split("@")[0] || "PharmaPath User";
  return titleCase(emailPrefix.replace(/[._-]+/g, " "));
}

export function deriveNameParts(displayName: string) {
  const [firstName = "", ...rest] = displayName.trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export function createDefaultProfile(user: ProfileUser): UserProfileRecord {
  const displayName = deriveDisplayName(user);
  const names = deriveNameParts(displayName);

  return {
    uid: user.uid,
    email: user.email || "",
    displayName,
    firstName: names.firstName,
    lastName: names.lastName,
    city: "",
    state: "",
    zipCode: "",
    defaultLocationLabel: "",
    preferredSearchRadius: 5,
    publicContributorAlias: false,
    contributorAlias: displayName,
    notifyCrowdUpdates: true,
    notifyShortageChanges: true,
    notifySavedSearchUpdates: false,
    contributionCount: 0,
    contributionLevel: getTrustTier(0).label,
    createdAt: null,
    updatedAt: null,
    lastContributionAt: null,
    recentSearches: [],
  };
}
