import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";

export type ClubRecord = {
  id: string;
  name: string;
  code: string;
  gameModelId: string;
  description: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbClubRow = {
  id: string;
  name: string;
  code: string;
  gameModelId: string;
  description: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const LEGACY_CLUBS_STORE_PATH = path.join(__dirname, "..", "..", ".data", "clubs.json");

let initPromise: Promise<void> | null = null;

function toClubRecord(row: DbClubRow): ClubRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    gameModelId: row.gameModelId,
    description: row.description ?? null,
    active: Boolean(row.active),
    createdBy: row.createdBy ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

async function readLegacyClubsStore(): Promise<ClubRecord[]> {
  try {
    const raw = await fs.readFile(LEGACY_CLUBS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    return [];
  }
}

async function bootstrapFromLegacyFileIfNeeded(): Promise<void> {
  const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*)::bigint AS count FROM "clubs"
  `;
  const countValue = Number(countRows?.[0]?.count ?? 0);
  if (countValue > 0) return;

  const legacy = await readLegacyClubsStore();
  if (!legacy.length) return;

  for (const club of legacy) {
    const normalizedCode = String(club.code || "").trim().toLowerCase();
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "clubs" (
        "id", "name", "code", "game_model_id", "description", "active", "created_by", "created_at", "updated_at"
      )
      VALUES (
        ${String(club.id || "").trim() || randomUUID()},
        ${String(club.name || "").trim()},
        ${normalizedCode},
        ${String(club.gameModelId || "").trim()},
        ${club.description ?? null},
        ${club.active !== false},
        ${club.createdBy ?? null},
        ${club.createdAt ? new Date(club.createdAt) : now},
        ${club.updatedAt ? new Date(club.updatedAt) : now}
      )
      ON CONFLICT ("id") DO NOTHING
    `;
  }
}

async function ensureClubsStoreReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "clubs" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "game_model_id" TEXT NOT NULL,
          "description" TEXT NULL,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "created_by" TEXT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "clubs_name_unique_idx" ON "clubs" ("name")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "clubs_code_lower_unique_idx" ON "clubs" (LOWER("code"))`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "clubs_active_idx" ON "clubs" ("active")`
      );

      await bootstrapFromLegacyFileIfNeeded();
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function listClubs(): Promise<ClubRecord[]> {
  await ensureClubsStoreReady();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    SELECT
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "clubs"
    ORDER BY "created_at" DESC
  `;
  return rows.map(toClubRecord);
}

export async function getClubById(clubId: string): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    SELECT
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "clubs"
    WHERE "id" = ${clubId}
    LIMIT 1
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}

export async function getClubByCode(code: string): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const normalized = String(code || "").trim().toLowerCase();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    SELECT
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "clubs"
    WHERE LOWER("code") = ${normalized}
    LIMIT 1
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}

export async function getClubByName(name: string): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const normalized = String(name || "").trim();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    SELECT
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "clubs"
    WHERE "name" = ${normalized}
    LIMIT 1
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}

export async function createClub(input: {
  id: string;
  name: string;
  code: string;
  gameModelId: string;
  description: string | null;
  active: boolean;
  createdBy: string | null;
}): Promise<ClubRecord> {
  await ensureClubsStoreReady();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    INSERT INTO "clubs" (
      "id", "name", "code", "game_model_id", "description", "active", "created_by", "created_at", "updated_at"
    )
    VALUES (
      ${input.id},
      ${input.name},
      ${String(input.code || "").trim().toLowerCase()},
      ${input.gameModelId},
      ${input.description},
      ${input.active},
      ${input.createdBy},
      now(),
      now()
    )
    RETURNING
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;
  return toClubRecord(rows[0]);
}

export async function updateClub(
  clubId: string,
  patch: {
    name: string;
    code: string;
    gameModelId: string;
    description: string | null;
    active: boolean;
  }
): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    UPDATE "clubs"
    SET
      "name" = ${patch.name},
      "code" = ${String(patch.code || "").trim().toLowerCase()},
      "game_model_id" = ${patch.gameModelId},
      "description" = ${patch.description},
      "active" = ${patch.active},
      "updated_at" = now()
    WHERE "id" = ${clubId}
    RETURNING
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}

export async function deleteClub(clubId: string): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const rows = await prisma.$queryRaw<DbClubRow[]>`
    DELETE FROM "clubs"
    WHERE "id" = ${clubId}
    RETURNING
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}

export async function getActiveClubByOrganizationName(
  organizationName: string
): Promise<ClubRecord | null> {
  await ensureClubsStoreReady();
  const normalized = String(organizationName || "").trim();
  if (!normalized) return null;

  const rows = await prisma.$queryRaw<DbClubRow[]>`
    SELECT
      "id",
      "name",
      "code",
      "game_model_id" AS "gameModelId",
      "description",
      "active",
      "created_by" AS "createdBy",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "clubs"
    WHERE "active" = true
      AND LOWER("name") = LOWER(${normalized})
    LIMIT 1
  `;
  return rows[0] ? toClubRecord(rows[0]) : null;
}
