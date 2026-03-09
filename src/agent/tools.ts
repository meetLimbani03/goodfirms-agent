import type { AppConfig } from "../config.js";
import {
  listOtherSoftwareReviewsByUser,
  loadOtherSoftwareReviewByUserAndId,
} from "../mongo.js";
import { normalizeReview } from "../normalize.js";
import type { ReviewContext } from "../review-context.js";
import type { AgentToolCall, AgentToolResult } from "../types.js";
import { collapseWhitespace, extractUrlHost, normalizeInteger, normalizeText, unixSecondsToIso } from "../utils.js";

import {
  FETCH_URL_TEXT_SNIPPET_LIMIT,
  USER_REVIEW_TOOL_DEFAULT_LIMIT,
  USER_REVIEW_TOOL_MAX_LIMIT,
  WEB_SEARCH_DEFAULT_LIMIT,
  WEB_SEARCH_MAX_LIMIT,
} from "./config.js";

const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";

interface AgentToolRuntime {
  config: AppConfig;
  reviewContext: ReviewContext;
}

export async function executeAgentTool(
  runtime: AgentToolRuntime,
  toolCall: AgentToolCall,
): Promise<AgentToolResult> {
  switch (toolCall.name) {
    case "fetch_user_reviews":
      return executeFetchUserReviews(runtime, toolCall.arguments);
    case "fetch_url_content":
      return executeFetchUrlContent(toolCall.arguments);
    case "web_search":
      return executeWebSearch(toolCall.arguments);
  }
}

async function executeFetchUserReviews(
  runtime: AgentToolRuntime,
  argumentsValue: Record<string, unknown>,
): Promise<AgentToolResult> {
  const userId = runtime.reviewContext.accountContext.userId.trim();
  if (!userId) {
    return {
      ok: false,
      toolName: "fetch_user_reviews",
      payload: {
        error: "current review does not contain a usable user_id",
      },
    };
  }

  const reviewId = normalizeObjectId(argumentsValue.review_id);
  if (reviewId) {
    const review = await loadOtherSoftwareReviewByUserAndId(
      runtime.config.mongoUri,
      userId,
      runtime.reviewContext.reviewId,
      reviewId,
    );

    if (!review) {
      return {
        ok: false,
        toolName: "fetch_user_reviews",
        payload: {
          error: "requested prior review was not found for this user",
          review_id: reviewId,
        },
      };
    }

    const normalized = normalizeReview(review);
    return {
      ok: true,
      toolName: "fetch_user_reviews",
      payload: {
        mode: "full_review",
        review: {
          review_id: normalized.id,
          software_name: normalized.softwareName,
          software_slug: normalized.softwareSlug,
          created_at: unixSecondsToIso(normalized.createdAt),
          status: statusLabel(normalized.isActive),
          rejection_reason:
            typeof review.reason === "string" && review.reason.trim() ? review.reason.trim() : null,
          usage: {
            duration_value: normalized.useInTime,
            duration_unit: normalized.useTimeFormat || null,
            frequency: normalized.frequentUse || null,
            pricing: normalized.softwarePricing || null,
            integrated_other_software: normalized.isIntegrated || null,
            integrated_software: normalized.integrateSoftware,
            switched_from_other_software: normalized.switchedFrom || null,
            used_software_before_switch: normalized.usedSoftware,
          },
          review: {
            title: normalized.title,
            summary: normalized.summary,
            strength: normalized.strength,
            weakness: normalized.weakness,
            ratings: {
              ease_of_use: normalized.easeOfUse,
              features_functionality: normalized.featuresFunctionality,
              customer_support: normalized.customerSupport,
              overall: normalized.overall,
            },
          },
        },
      },
    };
  }

  const limit = clampLimit(argumentsValue.limit, USER_REVIEW_TOOL_DEFAULT_LIMIT, USER_REVIEW_TOOL_MAX_LIMIT);
  const reviews = await listOtherSoftwareReviewsByUser(
    runtime.config.mongoUri,
    userId,
    runtime.reviewContext.reviewId,
    limit,
  );

  return {
    ok: true,
    toolName: "fetch_user_reviews",
    payload: {
      mode: "compact_list",
      total_found: reviews.length,
      reviews: reviews.map((review) => {
        const normalized = normalizeReview(review);
        return {
          review_id: normalized.id,
          software_name: normalized.softwareName,
          software_slug: normalized.softwareSlug,
          created_at: unixSecondsToIso(normalized.createdAt),
          status: statusLabel(normalized.isActive),
          rejection_reason:
            typeof review.reason === "string" && review.reason.trim() ? review.reason.trim() : null,
          title: normalized.title,
          summary_snippet: summarizeText(normalized.summary, 180),
          overall_rating: normalized.overall,
        };
      }),
    },
  };
}

async function executeFetchUrlContent(
  argumentsValue: Record<string, unknown>,
): Promise<AgentToolResult> {
  const requestedUrl = normalizeHttpUrl(argumentsValue.url);
  if (!requestedUrl) {
    return {
      ok: false,
      toolName: "fetch_url_content",
      payload: {
        error: "a valid http or https url is required",
      },
    };
  }

  try {
    const response = await fetch(requestedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GoodFirmsReviewAgent/0.1; +https://goodfirms.co/)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const finalUrl = response.url || requestedUrl;
    const textSnippet = summarizeText(extractVisibleText(body), FETCH_URL_TEXT_SNIPPET_LIMIT);

    return {
      ok: response.ok,
      toolName: "fetch_url_content",
      payload: {
        requested_url: requestedUrl,
        final_url: finalUrl,
        domain: extractUrlHost(finalUrl),
        status_code: response.status,
        content_type: contentType,
        title: extractHtmlTag(body, "title"),
        meta_description: extractMetaDescription(body),
        text_snippet: textSnippet || null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      toolName: "fetch_url_content",
      payload: {
        requested_url: requestedUrl,
        error: (error as Error).message,
      },
    };
  }
}

async function executeWebSearch(argumentsValue: Record<string, unknown>): Promise<AgentToolResult> {
  const query = normalizeText(argumentsValue.query);
  if (!query) {
    return {
      ok: false,
      toolName: "web_search",
      payload: {
        error: "query is required",
      },
    };
  }

  const domains = normalizeDomains(argumentsValue.domains);
  const limit = clampLimit(argumentsValue.limit, WEB_SEARCH_DEFAULT_LIMIT, WEB_SEARCH_MAX_LIMIT);

  try {
    const searchParams = new URLSearchParams({ q: query });
    const response = await fetch(`${SEARCH_ENDPOINT}?${searchParams.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GoodFirmsReviewAgent/0.1; +https://goodfirms.co/)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const html = await response.text();
    const parsedResults = parseDuckDuckGoResults(html)
      .filter((result) => domainMatches(result.url, domains))
      .slice(0, limit);

    return {
      ok: response.ok,
      toolName: "web_search",
      payload: {
        query,
        domains,
        total_results: parsedResults.length,
        results: parsedResults,
      },
    };
  } catch (error) {
    return {
      ok: false,
      toolName: "web_search",
      payload: {
        query,
        domains,
        error: (error as Error).message,
      },
    };
  }
}

function statusLabel(isActive: number | null): "pending" | "approved" | "rejected" | "unknown" {
  switch (isActive) {
    case 0:
      return "pending";
    case 1:
      return "approved";
    case 2:
      return "rejected";
    default:
      return "unknown";
  }
}

function clampLimit(value: unknown, fallback: number, max: number): number {
  const normalized = normalizeInteger(value);
  if (normalized === null) {
    return fallback;
  }

  return Math.max(1, Math.min(max, normalized));
}

function normalizeObjectId(value: unknown): string | null {
  const normalized = normalizeText(value);
  return /^[a-f0-9]{24}$/i.test(normalized) ? normalized : null;
}

function normalizeHttpUrl(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function summarizeText(value: string, maxLength: number): string {
  const normalized = collapseWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function extractVisibleText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  return decodeHtmlEntities(withoutScripts.replace(/<[^>]+>/g, " "));
}

function extractHtmlTag(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  if (!match?.[1]) {
    return null;
  }

  const value = collapseWhitespace(decodeHtmlEntities(match[1]));
  return value || null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  if (!match?.[1]) {
    return null;
  }

  const value = collapseWhitespace(decodeHtmlEntities(match[1]));
  return value || null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function normalizeDomains(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry).toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function parseDuckDuckGoResults(html: string): Array<{
  title: string;
  url: string;
  snippet: string | null;
}> {
  const results: Array<{ title: string; url: string; snippet: string | null }> = [];
  const blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/i).slice(1);

  for (const block of blocks) {
    const titleMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch?.[1] || !titleMatch[2]) {
      continue;
    }

    const url = normalizeSearchResultUrl(decodeHtmlEntities(titleMatch[1]));
    if (!url) {
      continue;
    }

    const title = collapseWhitespace(decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, " ")));
    const snippetMatch =
      block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    results.push({
      title,
      url,
      snippet: snippetMatch?.[1]
        ? collapseWhitespace(decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, " "))) || null
        : null,
    });
  }

  return results;
}

function normalizeSearchResultUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, "https://html.duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    const candidate = redirected ? decodeURIComponent(redirected) : url.toString();
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function domainMatches(url: string, domains: string[]): boolean {
  if (domains.length === 0) {
    return true;
  }

  const host = extractUrlHost(url);
  if (!host) {
    return false;
  }

  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
