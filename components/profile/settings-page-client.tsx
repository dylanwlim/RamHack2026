"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import {
  AuthButton,
  AuthCheckbox,
  AuthInput,
  AuthLabel,
} from "@/components/auth/auth-primitives";
import { useAuth } from "@/lib/auth/auth-context";
import { createDefaultProfile } from "@/lib/profile/profile-service";

type SettingsFormState = {
  displayName: string;
  city: string;
  state: string;
  zipCode: string;
  defaultLocationLabel: string;
  preferredSearchRadius: number;
  contributorAlias: string;
  publicContributorAlias: boolean;
  notifyCrowdUpdates: boolean;
  notifyShortageChanges: boolean;
  notifySavedSearchUpdates: boolean;
};

export function SettingsPageClient() {
  const { profile, profileLoading, signOut, updateProfileRecord, user } = useAuth();
  const [formState, setFormState] = useState<SettingsFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading || !user) {
      return;
    }

    const currentProfile = profile || createDefaultProfile(user);
    setFormState({
      displayName: currentProfile.displayName || "",
      city: currentProfile.city || "",
      state: currentProfile.state || "",
      zipCode: currentProfile.zipCode || "",
      defaultLocationLabel: currentProfile.defaultLocationLabel || "",
      preferredSearchRadius: currentProfile.preferredSearchRadius || 5,
      contributorAlias: currentProfile.contributorAlias || currentProfile.displayName || "",
      publicContributorAlias: Boolean(currentProfile.publicContributorAlias),
      notifyCrowdUpdates: Boolean(currentProfile.notifyCrowdUpdates),
      notifyShortageChanges: Boolean(currentProfile.notifyShortageChanges),
      notifySavedSearchUpdates: Boolean(currentProfile.notifySavedSearchUpdates),
    });
  }, [profile, profileLoading, user]);

  function updateField<Key extends keyof SettingsFormState>(
    key: Key,
    value: SettingsFormState[Key],
  ) {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setStatusMessage(null);

      await updateProfileRecord(formState);
      setStatusMessage("Settings saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save settings right now.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <RequireAuth>
      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="site-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="eyebrow-label">Settings</span>
            <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.4rem]">
              Set your search defaults and contributor identity.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              These settings shape how PharmaPath pre-fills search state, how your alias appears in
              crowd contributions, and which updates you want surfaced.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="site-shell">
          {!formState ? (
            <div className="surface-panel flex min-h-[20rem] items-center justify-center rounded-[2rem]">
              <div className="flex items-center gap-3 text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading settings...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6">
                  <span className="eyebrow-label">Profile</span>
                  <div className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <AuthLabel htmlFor="displayName">Display name</AuthLabel>
                      <AuthInput
                        id="displayName"
                        value={formState.displayName}
                        onChange={(event) => updateField("displayName", event.currentTarget.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <AuthLabel htmlFor="city">City</AuthLabel>
                        <AuthInput
                          id="city"
                          value={formState.city}
                          onChange={(event) => updateField("city", event.currentTarget.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <AuthLabel htmlFor="state">State</AuthLabel>
                        <AuthInput
                          id="state"
                          value={formState.state}
                          onChange={(event) => updateField("state", event.currentTarget.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <AuthLabel htmlFor="zipCode">ZIP code</AuthLabel>
                        <AuthInput
                          id="zipCode"
                          value={formState.zipCode}
                          onChange={(event) => updateField("zipCode", event.currentTarget.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <AuthLabel htmlFor="defaultLocationLabel">Default search location</AuthLabel>
                        <AuthInput
                          id="defaultLocationLabel"
                          value={formState.defaultLocationLabel}
                          onChange={(event) =>
                            updateField("defaultLocationLabel", event.currentTarget.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6">
                  <span className="eyebrow-label">Search defaults</span>
                  <div className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <AuthLabel htmlFor="preferredSearchRadius">Preferred radius</AuthLabel>
                      <select
                        id="preferredSearchRadius"
                        className="h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus-visible:border-[#156d95] focus-visible:ring-[3px] focus-visible:ring-[#156d95]/12"
                        value={formState.preferredSearchRadius}
                        onChange={(event) =>
                          updateField("preferredSearchRadius", Number(event.currentTarget.value))
                        }
                      >
                        <option value={2}>2 miles</option>
                        <option value={5}>5 miles</option>
                        <option value={10}>10 miles</option>
                        <option value={25}>25 miles</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6">
                  <span className="eyebrow-label">Contributor identity</span>
                  <div className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <AuthLabel htmlFor="contributorAlias">Public contributor alias</AuthLabel>
                      <AuthInput
                        id="contributorAlias"
                        value={formState.contributorAlias}
                        onChange={(event) =>
                          updateField("contributorAlias", event.currentTarget.value)
                        }
                      />
                    </div>
                    <AuthCheckbox
                      checked={formState.publicContributorAlias}
                      onChange={(event) =>
                        updateField("publicContributorAlias", event.currentTarget.checked)
                      }
                      label="Show this alias on future crowd reports"
                    />
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6">
                  <span className="eyebrow-label">Notifications</span>
                  <div className="mt-5 space-y-4">
                    <AuthCheckbox
                      checked={formState.notifyCrowdUpdates}
                      onChange={(event) =>
                        updateField("notifyCrowdUpdates", event.currentTarget.checked)
                      }
                      label="Let crowd activity influence saved searches"
                    />
                    <AuthCheckbox
                      checked={formState.notifyShortageChanges}
                      onChange={(event) =>
                        updateField("notifyShortageChanges", event.currentTarget.checked)
                      }
                      label="Surface shortage context changes in future iterations"
                    />
                    <AuthCheckbox
                      checked={formState.notifySavedSearchUpdates}
                      onChange={(event) =>
                        updateField("notifySavedSearchUpdates", event.currentTarget.checked)
                      }
                      label="Keep saved searches visible in profile history"
                    />
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6">
                  <span className="eyebrow-label">Session</span>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <AuthButton
                      type="submit"
                      className="h-12 px-5 hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save settings"}
                    </AuthButton>
                    <AuthButton
                      type="button"
                      variant="outline"
                      className="h-12 px-5"
                      disabled={isSigningOut}
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      {isSigningOut ? "Signing out..." : "Log out"}
                    </AuthButton>
                  </div>

                  {statusMessage ? (
                    <p className="mt-4 text-sm text-emerald-700">{statusMessage}</p>
                  ) : null}
                  {errorMessage ? (
                    <p className="mt-4 text-sm text-rose-700">{errorMessage}</p>
                  ) : null}
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </RequireAuth>
  );
}
