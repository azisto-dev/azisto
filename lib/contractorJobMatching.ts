function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function normalizeMatchValue(value: unknown) {
  return readText(value).toLocaleLowerCase("en-CA");
}

export function isContractorEligibleForJobNotifications(
  data: Record<string, unknown>,
) {
  const verificationStatus = normalizeMatchValue(data.verificationStatus);
  const accountStatus = normalizeMatchValue(data.accountStatus);
  const blockedVerificationStatuses = new Set([
    "rejected",
    "suspended",
    "blocked",
    "inactive",
  ]);
  const blockedAccountStatuses = new Set([
    "inactive",
    "suspended",
    "blocked",
    "closed",
    "disabled",
  ]);

  return (
    !blockedVerificationStatuses.has(verificationStatus) &&
    !blockedAccountStatuses.has(accountStatus)
  );
}

export function hasActiveContractorSubscription(
  data: Record<string, unknown>,
) {
  const subscription = readRecord(data.subscription);
  const subscriptionStatus = normalizeMatchValue(
    data.subscriptionStatus ??
      data.billingStatus ??
      data.planStatus ??
      subscription.status,
  );

  if (!subscriptionStatus) {
    return true;
  }

  return ["active", "trial", "trialing"].includes(subscriptionStatus);
}

export function getMatchingContractorSubcategories(
  data: Record<string, unknown>,
  category: string,
  subcategories: string[],
) {
  const selectedServices = readStringList(data.selectedServices);
  const legacyServices = Array.isArray(data.servicesOffered)
    ? readStringList(data.servicesOffered)
    : readText(data.servicesOffered)
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);
  const normalizedServices = new Set(
    [...selectedServices, ...legacyServices].map(normalizeMatchValue),
  );
  const savedByService = readRecord(
    data.selectedSubcategoriesByService ?? data.serviceSubcategories,
  );
  const savedSubcategories = Object.entries(savedByService).flatMap(
    ([savedCategory, value]) =>
      normalizeMatchValue(savedCategory) === normalizeMatchValue(category)
        ? readStringList(value)
        : [],
  );
  const normalizedCategory = normalizeMatchValue(category);
  const normalizedSavedSubcategories = new Set(
    savedSubcategories.map(normalizeMatchValue),
  );
  const directlySelectedSubcategories = subcategories.filter((subcategory) =>
    normalizedServices.has(normalizeMatchValue(subcategory)),
  );

  if (
    !normalizedServices.has(normalizedCategory) &&
    directlySelectedSubcategories.length === 0
  ) {
    return [];
  }

  if (savedSubcategories.length === 0) {
    return normalizedServices.has(normalizedCategory)
      ? subcategories
      : directlySelectedSubcategories;
  }

  return subcategories.filter((subcategory) =>
    normalizedSavedSubcategories.has(normalizeMatchValue(subcategory)),
  );
}
