"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  type AuthError,
  type User,
} from "firebase/auth";
import { auth, authPersistenceReady } from "@/lib/firebase";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSignupError(error: unknown) {
  const authError = error as Partial<AuthError>;

  if (authError.code === "auth/email-already-in-use") {
    return "An account with this email already exists. Please log in instead.";
  }

  if (authError.code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (authError.code === "auth/weak-password") {
    return "Please choose a stronger password with at least 6 characters.";
  }

  if (authError.code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (authError.code === "auth/network-request-failed") {
    return "Network error. Please check your connection and try again.";
  }

  return error instanceof Error ? error.message : "Unable to create account.";
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "contractor" ? "contractor" : "user";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        return;
      }

      setCreatedUser(user);
      setEmail(user.email ?? "");
      setSuccessMessage(
        user.emailVerified
          ? "Email verified. Continue to profile setup."
          : "Verification email sent. Please verify your email before continuing.",
      );
    });

    return unsubscribe;
  }, []);

  function validate() {
    if (!emailPattern.test(email.trim())) {
      return "Please enter a valid email address.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  }

  async function createAccountAndSendVerification() {
    const validationMessage = validate();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setIsWorking(true);
      setMessage("");
      setSuccessMessage("");
      await authPersistenceReady;
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await sendEmailVerification(credential.user);
      setCreatedUser(credential.user);
      setSuccessMessage(
        "Verification email sent. Please verify your email before continuing.",
      );
    } catch (error) {
      setMessage(getSignupError(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function resendVerification() {
    const user = createdUser ?? auth.currentUser;

    if (!user) {
      setMessage("Please create your account first.");
      return;
    }

    try {
      setIsWorking(true);
      setMessage("");
      await sendEmailVerification(user);
      setSuccessMessage(
        "Verification email sent. Please verify your email before continuing.",
      );
    } catch (error) {
      setMessage(getSignupError(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function checkVerification() {
    const user = createdUser ?? auth.currentUser;

    if (!user) {
      setMessage("Please create your account first.");
      return;
    }

    try {
      setIsWorking(true);
      setMessage("");
      await reload(user);

      if (!user.emailVerified) {
        setMessage(
          "Your email is not verified yet. Open the verification link, then check again.",
        );
        return;
      }

      await user.getIdToken(true);
      setSuccessMessage("Email verified. Continuing to profile setup.");
      router.push(
        role === "contractor"
          ? "/contractor/onboarding"
          : "/customer/onboarding",
      );
    } catch (error) {
      setMessage(getSignupError(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="az-customer-shell flex min-h-screen items-center justify-center bg-azisto-background px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-azisto-border bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <img
          src="/azisto-logo-cropped.png"
          alt="AZISTO - Your on-demand assistant"
          className="mx-auto w-full max-w-[230px] object-contain"
        />
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.14em] text-[#7A003C]">
          {role === "contractor" ? "Contractor account" : "Customer account"}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#111827]">
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">
          Verify your email before creating your AZISTO profile.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[#111827]">Email</span>
            <input
              type="email"
              value={email}
              disabled={Boolean(createdUser)}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-13 w-full rounded-xl border border-azisto-border bg-white px-4 outline-none az-focus-field disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#111827]">Password</span>
            <span className="relative mt-2 block">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                disabled={Boolean(createdUser)}
                onChange={(event) => setPassword(event.target.value)}
                className="h-13 w-full rounded-xl border border-azisto-border bg-white px-4 pr-12 outline-none az-focus-field disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#111827]">
              Confirm password
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              disabled={Boolean(createdUser)}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 h-13 w-full rounded-xl border border-azisto-border bg-white px-4 outline-none az-focus-field disabled:bg-slate-50"
            />
          </label>

          {message ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </p>
          ) : null}
          {successMessage ? (
            <p className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {successMessage}
            </p>
          ) : null}

          {!createdUser ? (
            <button
              type="button"
              onClick={() => void createAccountAndSendVerification()}
              disabled={isWorking}
              className="az-btn-primary flex h-13 w-full items-center justify-center gap-2 rounded-xl font-bold"
            >
              <Mail className="h-4 w-4" />
              {isWorking ? "Creating account..." : "Send verification link"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void checkVerification()}
                disabled={isWorking}
                className="az-btn-primary h-13 w-full rounded-xl font-bold"
              >
                {isWorking ? "Checking..." : "I have verified my email"}
              </button>
              <button
                type="button"
                onClick={() => void resendVerification()}
                disabled={isWorking}
                className="az-btn-secondary h-12 w-full rounded-xl text-sm font-bold"
              >
                Send verification link again
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#111827]">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
