import type { AgentToolName } from "../types.js";

export const AGENT_TOOL_ORDER: AgentToolName[] = [
  "fetch_user_reviews",
  "fetch_url_content",
  "web_search",
];

export const USER_REVIEW_TOOL_DEFAULT_LIMIT = 10;
export const USER_REVIEW_TOOL_MAX_LIMIT = 20;
export const WEB_SEARCH_DEFAULT_LIMIT = 5;
export const WEB_SEARCH_MAX_LIMIT = 5;
export const FETCH_URL_TEXT_SNIPPET_LIMIT = 1600;
