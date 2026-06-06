export const contractorActiveStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "cancel_requested",
  "hired",
]);

export const contractorPastStatuses = new Set([
  "completed",
  "cancelled",
  "rejected",
  "disputed",
]);

export const unavailableJobStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
  "cancel_requested",
  "disputed",
  "hired",
]);

const statusLabels: Record<string, string> = {
  open: "Open",
  interest_submitted: "Interest submitted",
  hired_pending_contractor: "Pending contractor acceptance",
  accepted: "Accepted",
  hired: "Accepted",
  on_the_way: "Contractor on the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  cancel_requested: "Cancellation requested",
  disputed: "Under review",
  rejected: "Rejected",
  partially_hired: "Partially hired",
};

export function getJobStatusLabel(status: string) {
  const normalizedStatus = status.trim().toLowerCase();

  return (
    statusLabels[normalizedStatus] ||
    normalizedStatus.replaceAll("_", " ") ||
    "Open"
  );
}

export function getCompatibleLifecycleStatus(status: string) {
  return status === "hired" ? "accepted" : status;
}

export function isContractorActiveStatus(status: string) {
  return contractorActiveStatuses.has(status);
}

export function isContractorPastStatus(status: string) {
  return contractorPastStatuses.has(status);
}
