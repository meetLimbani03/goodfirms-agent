import { randomUUID } from "node:crypto";

export function createRunId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return collapseWhitespace(value);
}

export function normalizeLooseText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return collapseWhitespace(String(value));
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
}

export function normalizeLooseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeLooseText(entry))
    .filter((entry) => entry.length > 0);
}

export function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeEnum(value: unknown, map: Record<string, string>): string {
  const normalized =
    typeof value === "string" || typeof value === "number"
      ? collapseWhitespace(String(value)).toLowerCase()
      : "";
  return map[normalized] ?? normalized;
}

export function normalizeMultiValueText(value: unknown): string {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0)
      .join(", ");
  }

  return "";
}

export function postingPreferenceText(hiddenIdentity: string): string {
  switch (hiddenIdentity) {
    case "1":
      return "Display both my name and the company's name with the review";
    case "2":
      return "Only display my name with the review";
    case "3":
      return "Only display the company's name with the review";
    case "4":
      return "Don't display my name and the company's name with the review";
    default:
      return "";
  }
}

export function unixSecondsToIso(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

export function nullableText(value: string): string | null {
  return value.trim() ? value : null;
}

export function extractEmailDomain(email: string): string | null {
  const normalized = normalizeText(email).toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(atIndex + 1);
}

export function extractUrlHost(value: string): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = normalized.includes("://") ? new URL(normalized) : new URL(`https://${normalized}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function stringsEqualLoose(left: string, right: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

export function timestampFilePart(date = new Date()): string {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
