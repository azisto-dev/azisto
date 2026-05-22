type RiskScoreInput = {
  accountCreatedAt?: unknown;
  phoneVerified: boolean;
  openJobsCount: number;
  openJobLimit: number;
  jobDescription: string;
  reportsCount: number;
};

const NEW_ACCOUNT_DAYS = 7;

function readTimestampDate(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return null;
}

export function hasSuspiciousLinks(text: string) {
  return /(https?:\/\/|www\.|bit\.ly|tinyurl\.com|t\.me\/|wa\.me\/)/i.test(
    text,
  );
}

export function hasBlockedSpamText(text: string) {
  const linkMatches = text.match(/(https?:\/\/|www\.)/gi) ?? [];
  const spamPhrasePattern =
    /\b(crypto|casino|wire transfer|gift card|telegram|whatsapp|investment opportunity|make money fast)\b/i;

  return linkMatches.length > 1 || spamPhrasePattern.test(text);
}

export function calculateRiskScore(input: RiskScoreInput) {
  let score = 0;
  const reasons: string[] = [];
  const accountCreatedAt = readTimestampDate(input.accountCreatedAt);
  const now = Date.now();
  const accountAgeDays = accountCreatedAt
    ? (now - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  if (!accountCreatedAt || accountAgeDays < NEW_ACCOUNT_DAYS) {
    score += 10;
    reasons.push("new_account");
  }

  if (!input.phoneVerified) {
    score += 20;
    reasons.push("phone_not_verified");
  }

  if (input.openJobsCount >= input.openJobLimit) {
    score += 30;
    reasons.push("too_many_open_jobs");
  }

  if (input.jobDescription.trim().length < 20) {
    score += 20;
    reasons.push("very_short_description");
  }

  if (hasSuspiciousLinks(input.jobDescription)) {
    score += 50;
    reasons.push("suspicious_links");
  }

  if (input.reportsCount > 0) {
    score += 20;
    reasons.push("customer_reports");
  }

  return {
    score,
    reasons,
  };
}
