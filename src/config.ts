import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export interface MySqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AgentToolLimits {
  maxTurns: number;
  perTool: {
    fetch_user_reviews: number;
    fetch_url_content: number;
    web_search: number;
  };
}

export interface AppConfig {
  mongoUri: string;
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterHttpReferer?: string;
  openRouterTitle?: string;
  logDir: string;
  mySql: MySqlConfig;
  agentToolLimits: AgentToolLimits;
}

export const DEFAULT_AGENT_TOOL_LIMITS: AgentToolLimits = {
  maxTurns: 6,
  perTool: {
    fetch_user_reviews: 2,
    fetch_url_content: 3,
    web_search: 2,
  },
};

export function getConfig(): AppConfig {
  const logDir = process.env.LOG_DIR?.trim() || "logs/review-runs";
  const config: AppConfig = {
    mongoUri: readRequiredEnv("MONGODB_URI"),
    openRouterApiKey: readRequiredEnv("OPENROUTER_API_KEY"),
    openRouterModel: readRequiredEnv("OPENROUTER_MODEL"),
    logDir,
    mySql: resolveMySqlConfig(),
    agentToolLimits: DEFAULT_AGENT_TOOL_LIMITS,
  };

  const openRouterHttpReferer = readOptionalEnv("OPENROUTER_HTTP_REFERER");
  const openRouterTitle = readOptionalEnv("OPENROUTER_X_TITLE");

  if (openRouterHttpReferer) {
    config.openRouterHttpReferer = openRouterHttpReferer;
  }

  if (openRouterTitle) {
    config.openRouterTitle = openRouterTitle;
  }

  return config;
}

function resolveMySqlConfig(): MySqlConfig {
  const envConfig = {
    host: readOptionalEnv("MYSQL_HOST"),
    port: readOptionalEnv("MYSQL_PORT"),
    user: readOptionalEnv("MYSQL_USER"),
    password: readOptionalEnv("MYSQL_PASS"),
    database: readOptionalEnv("MYSQL_DB"),
  };

  if (
    envConfig.host &&
    envConfig.port &&
    envConfig.user &&
    envConfig.password &&
    envConfig.database
  ) {
    return {
      host: envConfig.host,
      port: Number.parseInt(envConfig.port, 10),
      user: envConfig.user,
      password: envConfig.password,
      database: envConfig.database,
    };
  }

  const tomlConfig = readMySqlConfigFromCodexToml();
  if (tomlConfig) {
    return tomlConfig;
  }

  throw new Error(
    "Missing MySQL config. Set MYSQL_HOST/MYSQL_PORT/MYSQL_USER/MYSQL_PASS/MYSQL_DB or configure dumped-goodfirms-mysql in .codex/config.toml.",
  );
}

function readMySqlConfigFromCodexToml(): MySqlConfig | null {
  const configPath =
    readOptionalEnv("MYSQL_CONFIG_TOML_PATH") || path.resolve(process.cwd(), ".codex/config.toml");
  if (!existsSync(configPath)) {
    return null;
  }

  const lines = readFileSync(configPath, "utf8").split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => line.trim() === "[mcp_servers.dumped-goodfirms-mysql.env]",
  );
  if (startIndex < 0) {
    return null;
  }

  const entries = new Map<string, string>();
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (rawLine === undefined) {
      break;
    }

    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("[")) {
      break;
    }

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/);
    if (match?.[1] && match[2] !== undefined) {
      entries.set(match[1], match[2]);
    }
  }

  const host = entries.get("MYSQL_HOST");
  const port = entries.get("MYSQL_PORT");
  const user = entries.get("MYSQL_USER");
  const password = entries.get("MYSQL_PASS");
  const database = entries.get("MYSQL_DB");

  if (!host || !port || !user || !password || !database) {
    return null;
  }

  return {
    host,
    port: Number.parseInt(port, 10),
    user,
    password,
    database,
  };
}
