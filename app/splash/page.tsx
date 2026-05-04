"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    console.log("Splash loaded");

    const timer = setTimeout(() => {
      console.log("Redirecting to login...");
      router.replace("/login");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <h1 className="text-4xl font-bold tracking-widest">
        AZI<span className="text-red-500">•</span>STO
      </h1>
    </div>
  );
}
