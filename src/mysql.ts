import mysql from "mysql2/promise";

import type { MySqlConfig } from "./config.js";

let cachedPool: mysql.Pool | null = null;
let cachedPoolKey: string | null = null;

export interface ReviewerAccountRecord {
  id: number;
  type: string | null;
  name: string | null;
  email: string;
  socialId: string | null;
  googleId: string | null;
  mergeReviewer: number;
  totalReviews: number | null;
  userAddress: string | null;
  profilePic: string | null;
  position: string | null;
  publicUrl: string | null;
  location: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  isGoodfirmsRegistered: boolean;
  isSpam: boolean;
  emailVerifiedAt: string | null;
  emailResult: string;
  emailReason: string | null;
  emailCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerEmailUnverifiedRecord {
  id: number;
  reviewerId: number;
  email: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export async function loadReviewerAccountContext(
  mySqlConfig: MySqlConfig,
  userId: string,
): Promise<{
  account: ReviewerAccountRecord | null;
  unverifiedEmails: ReviewerEmailUnverifiedRecord[];
}> {
  const numericUserId = Number.parseInt(userId, 10);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    return {
      account: null,
      unverifiedEmails: [],
    };
  }

  const pool = getMySqlPool(mySqlConfig);

  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT
        id,
        type,
        name,
        email,
        social_id,
        google_id,
        merge_reviewer,
        total_reviews,
        user_address,
        profile_pic,
        position,
        public_url,
        location,
        company_name,
        company_website,
        is_goodfirms_registered,
        is_spam,
        email_verified_at,
        email_result,
        email_reason,
        email_checked_at,
        created,
        updated
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [numericUserId],
  );

  const [unverifiedRows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT
        id,
        reviewer_id,
        email,
        token,
        created,
        updated
      FROM reviewer_emails_unverified
      WHERE reviewer_id = ?
      ORDER BY created DESC, id DESC
    `,
    [numericUserId],
  );

  const accountRow = userRows[0];

  return {
    account: accountRow
      ? {
          id: toRequiredNumber(accountRow.id),
          type: toNullableString(accountRow.type),
          name: toNullableString(accountRow.name),
          email: toRequiredString(accountRow.email),
          socialId: toNullableString(accountRow.social_id),
          googleId: toNullableString(accountRow.google_id),
          mergeReviewer: toRequiredNumber(accountRow.merge_reviewer),
          totalReviews: toNullableNumber(accountRow.total_reviews),
          userAddress: toNullableString(accountRow.user_address),
          profilePic: toNullableString(accountRow.profile_pic),
          position: toNullableString(accountRow.position),
          publicUrl: toNullableString(accountRow.public_url),
          location: toNullableString(accountRow.location),
          companyName: toNullableString(accountRow.company_name),
          companyWebsite: toNullableString(accountRow.company_website),
          isGoodfirmsRegistered: toRequiredNumber(accountRow.is_goodfirms_registered) === 1,
          isSpam: toRequiredNumber(accountRow.is_spam) === 1,
          emailVerifiedAt: toNullableString(accountRow.email_verified_at),
          emailResult: toRequiredString(accountRow.email_result),
          emailReason: toNullableString(accountRow.email_reason),
          emailCheckedAt: toNullableString(accountRow.email_checked_at),
          createdAt: toRequiredString(accountRow.created),
          updatedAt: toRequiredString(accountRow.updated),
        }
      : null,
    unverifiedEmails: unverifiedRows.map((row) => ({
      id: toRequiredNumber(row.id),
      reviewerId: toRequiredNumber(row.reviewer_id),
      email: toRequiredString(row.email),
      token: toRequiredString(row.token),
      createdAt: toRequiredString(row.created),
      updatedAt: toRequiredString(row.updated),
    })),
  };
}

export async function closeMySqlPool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    cachedPoolKey = null;
  }
}

function getMySqlPool(config: MySqlConfig): mysql.Pool {
  const key = `${config.host}:${config.port}:${config.database}:${config.user}`;
  if (!cachedPool || cachedPoolKey !== key) {
    cachedPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 4,
      namedPlaceholders: false,
    });
    cachedPoolKey = key;
  }

  return cachedPool;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function toRequiredString(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error("Expected required MySQL string value");
  }

  return String(value);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toRequiredNumber(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error("Expected required MySQL numeric value");
  }

  return normalized;
}
