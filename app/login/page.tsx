"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    return "Something went wrong. Please try again.";
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setMessage("");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/home");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setIsLoading(true);
      setMessage("");
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/home");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-8 text-center">
          <p className="text-3xl font-bold tracking-widest text-slate-950">
            AZI<span className="text-red-500">•</span>STO
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Login or sign up
          </h1>
        </div>

        <div className="space-y-4">
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
