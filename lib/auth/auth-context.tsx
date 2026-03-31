"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth";
import { formatAuthError } from "@/lib/auth/auth-errors";
import { getFirebaseAuth, setAuthPersistence } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { UserProfileRecord } from "@/lib/profile/profile-types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type SignInInput = {
  email: string;
  password: string;
  remember: boolean;
};

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  defaultLocationLabel?: string;
};

type PendingSignUpProfile = {
  email: string;
  overrides: Partial<UserProfileRecord>;
};

type AuthContextValue = {
  firebaseReady: boolean;
  firebaseMessage: string | null;
  user: User | null;
  profile: UserProfileRecord | null;
  status: AuthStatus;
  profileLoading: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  updateProfileRecord: (input: Partial<UserProfileRecord>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCOUNT_ACCESS_UNAVAILABLE = "Account access is temporarily unavailable right now.";

function buildSignUpProfileOverrides(input: SignUpInput): Partial<UserProfileRecord> {
  const displayName = input.displayName.trim();

  return {
    displayName,
    firstName: input.firstName?.trim() || "",
    lastName: input.lastName?.trim() || "",
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    zipCode: input.zipCode?.trim() || "",
    defaultLocationLabel: input.defaultLocationLabel?.trim() || "",
    contributorAlias: displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profileLoading, setProfileLoading] = useState(true);
  const pendingSignUpProfileRef = useRef<PendingSignUpProfile | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || !isFirebaseConfigured) {
      setStatus("unauthenticated");
      setProfileLoading(false);
      return () => undefined;
    }

    let unsubscribeProfile: () => void = () => undefined;
    let unsubscribeAuth: () => void = () => undefined;
    let isActive = true;

    void import("@/lib/profile/profile-service")
      .then(({ ensureUserProfile, subscribeToUserProfile }) => {
        if (!isActive) {
          return;
        }

        unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
          unsubscribeProfile();
          setUser(nextUser);

          if (!nextUser) {
            setProfile(null);
            setStatus("unauthenticated");
            setProfileLoading(false);
            return;
          }

          setStatus("authenticated");
          setProfileLoading(true);

          const pendingSignUpProfile = pendingSignUpProfileRef.current;
          const pendingSignUpEmail = pendingSignUpProfile?.email || "";
          const nextUserEmail = nextUser.email?.trim().toLowerCase() || "";
          const bootstrapOverrides =
            pendingSignUpEmail && pendingSignUpEmail === nextUserEmail
              ? pendingSignUpProfile?.overrides || {}
              : {};

          try {
            await ensureUserProfile(nextUser, bootstrapOverrides);
          } catch {
            // Profile creation is retried on explicit writes later.
          } finally {
            if (pendingSignUpEmail && pendingSignUpEmail === nextUserEmail) {
              pendingSignUpProfileRef.current = null;
            }
          }

          unsubscribeProfile = subscribeToUserProfile(nextUser.uid, (nextProfile) => {
            setProfile(nextProfile);
            setProfileLoading(false);
          });
        });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setProfile(null);
        setStatus("unauthenticated");
        setProfileLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseReady: isFirebaseConfigured,
      firebaseMessage: isFirebaseConfigured ? null : ACCOUNT_ACCESS_UNAVAILABLE,
      user,
      profile,
      status,
      profileLoading,
      async signIn(input) {
        const auth = getFirebaseAuth();
        if (!auth) {
          throw new Error(ACCOUNT_ACCESS_UNAVAILABLE);
        }

        try {
          await setAuthPersistence(input.remember ? "local" : "session");
          await signInWithEmailAndPassword(
            auth,
            input.email.trim(),
            input.password,
          );
        } catch (error) {
          throw new Error(formatAuthError(error));
        }
      },
      async signUp(input) {
        const auth = getFirebaseAuth();
        if (!auth) {
          throw new Error(ACCOUNT_ACCESS_UNAVAILABLE);
        }

        const normalizedEmail = input.email.trim().toLowerCase();
        const profileOverrides = buildSignUpProfileOverrides(input);
        let accountCreated = false;

        pendingSignUpProfileRef.current = {
          email: normalizedEmail,
          overrides: profileOverrides,
        };

        try {
          await setAuthPersistence("local");
          const credential = await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            input.password,
          );
          accountCreated = true;

          await updateFirebaseProfile(credential.user, {
            displayName: profileOverrides.displayName || "",
          });

          return credential.user;
        } catch (error) {
          if (!accountCreated) {
            pendingSignUpProfileRef.current = null;
          }
          throw new Error(formatAuthError(error));
        }
      },
      async signOut() {
        const auth = getFirebaseAuth();
        if (!auth) {
          return;
        }

        await firebaseSignOut(auth);
      },
      async sendResetEmail(email: string) {
        const auth = getFirebaseAuth();
        if (!auth) {
          throw new Error(ACCOUNT_ACCESS_UNAVAILABLE);
        }

        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (error) {
          throw new Error(formatAuthError(error));
        }
      },
      async updateProfileRecord(input) {
        if (!user) {
          throw new Error("Sign in to update profile settings.");
        }

        try {
          if (input.displayName?.trim() && input.displayName.trim() !== user.displayName) {
            await updateFirebaseProfile(user, {
              displayName: input.displayName.trim(),
            });
          }

          const { saveUserProfile } = await import("@/lib/profile/profile-service");
          await saveUserProfile(user, input);
        } catch (error) {
          throw new Error(formatAuthError(error));
        }
      },
    }),
    [profile, profileLoading, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AppProviders.");
  }

  return context;
}
