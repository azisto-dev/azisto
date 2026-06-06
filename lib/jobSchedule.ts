export type ScheduleMode = "specific" | "urgency";

export type JobSchedule = {
  mode: ScheduleMode;
  date?: string;
  timeWindow?: string;
  urgency?: string;
};

export type JobScheduleSource = {
  scheduleMode?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  preferredTimeWindow?: string | null;
  urgency?: string | null;
  schedule?: Partial<JobSchedule> | null;
};

export function normalizeJobSchedule(source: JobScheduleSource): JobSchedule {
  const schedule = source.schedule ?? {};
  const date = (schedule.date || source.preferredDate || "").trim();
  const timeWindow = (
    schedule.timeWindow ||
    source.preferredTimeWindow ||
    source.preferredTime ||
    ""
  ).trim();
  const urgency = (schedule.urgency || source.urgency || "").trim();
  const requestedMode = schedule.mode || source.scheduleMode;

  if (requestedMode === "specific") {
    return {
      mode: "specific",
      date,
      timeWindow,
    };
  }

  if (requestedMode === "urgency") {
    return {
      mode: "urgency",
      urgency: urgency || "Flexible",
    };
  }

  if (date || timeWindow) {
    return {
      mode: "specific",
      date,
      timeWindow,
    };
  }

  return {
    mode: "urgency",
    urgency: urgency || "Flexible",
  };
}

export function formatScheduleLabel(source: JobScheduleSource) {
  const schedule = normalizeJobSchedule(source);

  if (schedule.mode === "specific") {
    const when = [schedule.date, schedule.timeWindow].filter(Boolean).join(" · ");

    return `When: ${when || "Timing pending"}`;
  }

  return `Urgency: ${schedule.urgency || "Flexible"}`;
}
