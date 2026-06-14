const taskIdPattern = /^(J-\d+)-\d+$/i;

export function getParentJobIdFromTaskId(value: string) {
  const taskId = value.trim();
  const match = taskId.match(taskIdPattern);

  return match?.[1] ?? "";
}

export function getContractorJobHref(
  parentJobIdOrTaskId: string,
  taskId = "",
) {
  const requestedId = parentJobIdOrTaskId.trim();
  let resolvedTaskId = taskId.trim();
  let parentJobId = requestedId;

  if (!resolvedTaskId) {
    const inferredParentJobId = getParentJobIdFromTaskId(requestedId);

    if (inferredParentJobId) {
      parentJobId = inferredParentJobId;
      resolvedTaskId = requestedId;
    }
  } else if (parentJobId === resolvedTaskId) {
    parentJobId = getParentJobIdFromTaskId(resolvedTaskId) || parentJobId;
  }

  if (!parentJobId) {
    return "/contractor/dashboard";
  }

  const href = `/contractor/jobs/${encodeURIComponent(parentJobId)}`;

  return resolvedTaskId
    ? `${href}?taskId=${encodeURIComponent(resolvedTaskId)}`
    : href;
}

