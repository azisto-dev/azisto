export type ParentJobStatus = {
  status: string;
  overallStatus: string;
  matchingStatus: "open" | "closed";
};

export function getParentJobStatus(taskStatuses: string[]): ParentJobStatus {
  if (taskStatuses.length === 0) {
    return { status: "open", overallStatus: "open", matchingStatus: "open" };
  }

  if (taskStatuses.every((status) => status === "cancelled")) {
    return {
      status: "cancelled",
      overallStatus: "cancelled",
      matchingStatus: "closed",
    };
  }

  if (
    taskStatuses.every(
      (status) => status === "completed" || status === "cancelled",
    )
  ) {
    return {
      status: "completed",
      overallStatus: "completed",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("open")) {
    const hasAssignedTask = taskStatuses.some(
      (status) =>
        status !== "open" && status !== "cancelled" && status !== "expired",
    );

    return {
      status: "open",
      overallStatus: hasAssignedTask ? "partially_hired" : "open",
      matchingStatus: "open",
    };
  }

  if (taskStatuses.includes("completion_pending_customer")) {
    return {
      status: "completion_pending_customer",
      overallStatus: "completion_pending_customer",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("in_progress")) {
    return {
      status: "in_progress",
      overallStatus: "in_progress",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("on_the_way")) {
    return {
      status: "on_the_way",
      overallStatus: "on_the_way",
      matchingStatus: "closed",
    };
  }

  if (
    taskStatuses.some(
      (status) => status === "accepted" || status === "hired",
    )
  ) {
    return {
      status: "accepted",
      overallStatus: "accepted",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("hired_pending_contractor")) {
    return {
      status: "hired_pending_contractor",
      overallStatus: "hired_pending_contractor",
      matchingStatus: "closed",
    };
  }

  if (
    taskStatuses.every(
      (status) => status === "expired" || status === "cancelled",
    )
  ) {
    return {
      status: "expired",
      overallStatus: "expired",
      matchingStatus: "closed",
    };
  }

  return { status: "open", overallStatus: "open", matchingStatus: "open" };
}
