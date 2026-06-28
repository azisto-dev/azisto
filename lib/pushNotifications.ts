"use client";

import type { User } from "firebase/auth";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import app from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/authenticatedFetch";

export type PushNotificationStatus =
  | "enabled"
  | "not_enabled"
  | "blocked"
  | "not_supported";

const pushTokenStorageKey = "azisto:fcmToken";
const serviceWorkerPath = "/firebase-messaging-sw.js";

function hasBrowserPushApis() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (!hasBrowserPushApis() || !(await isSupported().catch(() => false))) {
    return "not_supported";
  }

  if (Notification.permission === "granted") {
    return localStorage.getItem(pushTokenStorageKey) ? "enabled" : "not_enabled";
  }

  if (Notification.permission === "denied") {
    return "blocked";
  }

  return "not_enabled";
}

async function registerMessagingServiceWorker() {
  const registration = await navigator.serviceWorker.register(serviceWorkerPath);
  await navigator.serviceWorker.ready;
  return registration;
}

async function saveToken(user: User, token: string) {
  const response = await authenticatedFetch(user, "/api/push/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to enable push notifications.",
    );
  }
}

export async function enablePushNotifications(user: User) {
  if (!hasBrowserPushApis() || !(await isSupported().catch(() => false))) {
    return "not_supported" satisfies PushNotificationStatus;
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  if (!vapidKey) {
    throw new Error("Push notifications are not configured yet.");
  }

  const permission = await Notification.requestPermission();

  if (permission === "denied") {
    return "blocked" satisfies PushNotificationStatus;
  }

  if (permission !== "granted") {
    return "not_enabled" satisfies PushNotificationStatus;
  }

  const serviceWorkerRegistration = await registerMessagingServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    return "not_enabled" satisfies PushNotificationStatus;
  }

  await saveToken(user, token);
  localStorage.setItem(pushTokenStorageKey, token);

  return "enabled" satisfies PushNotificationStatus;
}

export async function disablePushNotifications(user: User) {
  if (!hasBrowserPushApis() || !(await isSupported().catch(() => false))) {
    return "not_supported" satisfies PushNotificationStatus;
  }

  const messaging = getMessaging(app);
  const savedToken = localStorage.getItem(pushTokenStorageKey);

  if (savedToken) {
    await authenticatedFetch(user, "/api/push/unregister", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: savedToken }),
    }).catch(() => null);
  }

  await deleteToken(messaging).catch(() => false);
  localStorage.removeItem(pushTokenStorageKey);

  return getPushNotificationStatus();
}
