"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  type AuthError,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, authPersistenceReady } from "@/lib/firebase";
import {
  fetchSessionProfile,
  getDefaultRouteForSession,
} from "@/lib/sessionProfile";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSubmitRequestNotice =
    searchParams.get("reason") === "submit-request";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return "Please enter your email address.";
    }

    if (!emailPattern.test(trimmedEmail)) {
      return "Please enter a valid email address.";
    }

    if (!password) {
      return "Please enter your password.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return "";
  };

  const getErrorMessage = (error: unknown) => {
    const authError = error as Partial<AuthError>;

    if (authError.code === "auth/invalid-credential") {
      return "The email or password you entered is incorrect.";
    }

    if (authError.code === "auth/email-already-in-use") {
      return "An account with this email already exists.";
    }

    if (authError.code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a moment and try again.";
    }

    if (authError.code === "auth/network-request-failed") {
      return "Network error. Please check your connection and try again.";
    }

    if (error instanceof Error && error.message === "auth-state-missing") {
      return "Your account was created, but sign-in did not finish. Please try logging in.";
    }

    return "Something went wrong. Please try again.";
  };

  const handleLogin = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");
      await authPersistenceReady;
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await auth.authStateReady();
      console.log("Login auth state loaded");
      console.log("Login current uid:", auth.currentUser?.uid ?? "none");
      if (!auth.currentUser) {
        throw new Error("auth-state-missing");
      }

      const profile = await fetchSessionProfile(auth.currentUser);
      console.log("Login role API result:", profile);
      const nextRoute = getDefaultRouteForSession(profile);
      console.log("Login redirect reason:", `role:${profile.role}`);
      router.push(nextRoute);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");
      await authPersistenceReady;
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      console.log("Signup successful user UID:", userCredential.user.uid);
      await auth.authStateReady();

      if (!auth.currentUser) {
        throw new Error("auth-state-missing");
      }

      console.log("Signup auth state ready for UID:", userCredential.user.uid);
      console.log("Signup redirect reason: new account needs account type");
      router.push("/account-type");
    } catch (error) {
      console.error("Signup failed:", error);
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-8 pt-4 text-center">
          <img
            src="/azisto-logo-cropped.png"
            alt="AZISTO - Your on-demand assistant"
            className="mx-auto w-full max-w-[250px] object-contain"
          />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            Login or sign up
          </h1>
        </div>

        <div className="space-y-4">
          {showSubmitRequestNotice ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              Please sign in or create an account to submit your request.
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Password
            </span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              type="password"
              value={password}
              placeholder="At least 6 characters"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              className="rounded-md bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              type="button"
              disabled={isLoading}
              onClick={handleLogin}
            >
              Login
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-3 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
              type="button"
              disabled={isLoading}
              onClick={handleSignup}
            >
              Sign up
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
