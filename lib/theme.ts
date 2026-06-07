export const azistoColors = {
  primary: "#1E3A8A",
  primaryHover: "#273F7A",
  accent: "#2563EB",
  gold: "#C8A96B",
  background: "#FAFAF8",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111111",
  muted: "#6B7280",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

export const azistoUi = {
  primaryButton: "az-btn-primary",
  secondaryButton: "az-btn-secondary",
  dangerButton: "az-btn-danger-soft",
  focusField: "az-focus-field",
  kicker: "az-kicker",
  jobId: "az-job-id",
  statusChip: "az-status-chip",
} as const;

export function getStatusChipClass(status: string) {
  const normalizedStatus = (
    status === "cancel_requested" ||
    status === "disputed" ||
    status === "under_review"
      ? "accepted"
      : status
  )
    .toLowerCase()
    .replaceAll("_", " ");

  if (normalizedStatus === "open" || normalizedStatus === "completed") {
    return "az-status-chip az-status-success";
  }

  if (
    normalizedStatus === "pending" ||
    normalizedStatus === "hired pending contractor" ||
    normalizedStatus === "pending contractor acceptance" ||
    normalizedStatus === "partially hired"
  ) {
    return "az-status-chip az-status-warning";
  }

  if (
    normalizedStatus === "hired" ||
    normalizedStatus === "accepted" ||
    normalizedStatus === "on the way" ||
    normalizedStatus === "in progress" ||
    normalizedStatus === "partially active" ||
    normalizedStatus === "partially in progress"
  ) {
    return "az-status-chip az-status-info";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled" ||
    normalizedStatus === "error" ||
    normalizedStatus === "failed" ||
    normalizedStatus === "rejected" ||
    normalizedStatus === "expired"
  ) {
    return "az-status-chip az-status-danger";
  }

  return "az-status-chip az-status-neutral";
}
