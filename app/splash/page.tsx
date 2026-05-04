"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/home");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <h1 className="text-4xl font-bold tracking-widest text-slate-950">
        AZI<span className="text-red-500">•</span>STO
      </h1>
    </main>
  );
}
