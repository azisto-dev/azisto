export const contractorActiveStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "completion_pending_customer",
  "hired",
]);

export const contractorPastStatuses = new Set([
  "completed",
  "cancelled",
  "rejected",
]);

export const unavailableJobStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "completion_pending_customer",
  "completed",
  "cancelled",
  "hired",
]);

const statusLabels: Record<string, string> = {
  open: "Open",
  interest_submitted: "Interest submitted",
  hired_pending_contractor: "Pending contractor acceptance",
  pending_contractor_acceptance: "Pending contractor acceptance",
  accepted: "Accepted",
  hired: "Accepted",
  on_the_way: "Contractor on the way",
  in_progress: "In progress",
  completion_pending_customer: "Waiting for customer confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  partially_hired: "Partially hired",
  partially_active: "Partially active",
  partially_in_progress: "Partially in progress",
  expired: "Expired",
};

export function getJobStatusLabel(status: string) {
  const normalizedStatus = getCompatibleLifecycleStatus(
    status.trim().toLowerCase(),
  );

  return (
    statusLabels[normalizedStatus] ||
    normalizedStatus.replaceAll("_", " ") ||
    "Open"
  );
}

export function getCompatibleLifecycleStatus(status: string) {
  if (
    status === "hired" ||
    status === "cancel_requested" ||
    status === "disputed" ||
    status === "under_review"
  ) {
    return "accepted";
  }

  return status;
}

export function isContractorActiveStatus(status: string) {
  return contractorActiveStatuses.has(getCompatibleLifecycleStatus(status));
}

export function isContractorPastStatus(status: string) {
  return contractorPastStatuses.has(getCompatibleLifecycleStatus(status));
}
