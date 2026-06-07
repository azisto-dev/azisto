"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { BriefcaseBusiness, X } from "lucide-react";

type HireNotification = {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  jobId: string;
  read: boolean;
};

async function fetchPendingHireNotification(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    notifications?: unknown;
  } | null;

  if (!response.ok || !Array.isArray(body?.notifications)) {
    return null;
  }

  return (
    (body.notifications as HireNotification[]).find(
      (notification) =>
        notification.type === "contractor_selected" &&
        !notification.read &&
        Boolean(notification.jobId),
    ) ?? null
  );
}

async function markNotificationRead(user: User, notificationId: string) {
  const token = await user.getIdToken();

  await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notificationId }),
  });
}

async function submitDecision(
  user: User,
  jobId: string,
  decision: "accepted" | "rejected",
) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/contractor-decision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to update this job.",
    );
  }
}

export default function ContractorHirePopup({
  user,
  refreshKey,
}: {
  user: User | null;
  refreshKey: number;
}) {
  const router = useRouter();
  const [notification, setNotification] = useState<HireNotification | null>(
    null,
  );
  const [activeDecision, setActiveDecision] = useState<
    "accepted" | "rejected" | ""
  >("");
  const [errorMessage, setErrorMessage] = useState("");
  const dismissedIds = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;

    if (!user || notification) {
      return;
    }

    void fetchPendingHireNotification(user)
      .then((pendingNotification) => {
        if (
          isMounted &&
          pendingNotification &&
          !dismissedIds.current.has(pendingNotification.notificationId)
        ) {
          setNotification(pendingNotification);
        }
      })
      .catch(() => {
        // The regular notification page remains available if this lightweight
        // popup check is temporarily interrupted.
      });

    return () => {
      isMounted = false;
    };
  }, [notification, refreshKey, user]);

  function closePopup() {
    if (notification) {
      dismissedIds.current.add(notification.notificationId);
    }
    setNotification(null);
    setErrorMessage("");
  }

  async function handleDecision(decision: "accepted" | "rejected") {
    if (!user || !notification || activeDecision) {
      return;
    }

    try {
      setActiveDecision(decision);
      setErrorMessage("");
      await submitDecision(user, notification.jobId, decision);
      await markNotificationRead(user, notification.notificationId);
      const jobId = notification.jobId;
      setNotification(null);

      if (decision === "accepted") {
        router.push(`/contractor/jobs/${encodeURIComponent(jobId)}`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update this job.",
      );
    } finally {
      setActiveDecision("");
    }
  }

  async function handleViewJob() {
    if (!user || !notification) {
      return;
    }

    const jobId = notification.jobId;

    try {
      await markNotificationRead(user, notification.notificationId);
    } catch {
      // Navigation is still useful even if marking the notification read fails.
    }

    setNotification(null);
    router.push(`/contractor/jobs/${encodeURIComponent(jobId)}`);
  }

  if (!notification) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contractor-hire-popup-title"
    >
      <section className="az-contractor-card relative w-full max-w-[350px] p-5 shadow-[0_16px_40px_rgba(92,0,50,0.18)]">
        <button
          type="button"
          onClick={closePopup}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-text)]"
          aria-label="Close job notification"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(122_0_60_/_0.09)] text-[var(--azisto-contractor-burgundy)]">
          <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-burgundy)]">
          New job selection
        </p>
        <h2
          id="contractor-hire-popup-title"
          className="mt-1 pr-8 text-xl font-bold text-[var(--azisto-contractor-text)]"
        >
          {notification.title || "You were selected"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
          {notification.message}
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-[var(--azisto-contractor-burgundy)]">
          {notification.jobId}
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleDecision("rejected")}
            disabled={Boolean(activeDecision)}
            className="az-btn-contractor-outline flex h-11 items-center justify-center rounded-full text-sm font-bold"
          >
            {activeDecision === "rejected" ? "Rejecting..." : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => void handleDecision("accepted")}
            disabled={Boolean(activeDecision)}
            className="az-btn-contractor flex h-11 items-center justify-center rounded-full text-sm font-bold"
          >
            {activeDecision === "accepted" ? "Accepting..." : "Accept"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleViewJob()}
          disabled={Boolean(activeDecision)}
          className="az-btn-contractor-outline mt-2 flex h-11 w-full items-center justify-center rounded-full text-sm font-bold"
        >
          View job
        </button>
      </section>
    </div>
  );
}
