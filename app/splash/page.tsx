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
    <main className="az-customer-shell flex min-h-screen items-center justify-center bg-white px-6">
      <img
        src="/azisto-logo.png"
        alt="AZISTO - Your on-demand assistant"
        className="max-h-[80vh] w-full max-w-[620px] object-contain"
      />
    </main>
  );
}
