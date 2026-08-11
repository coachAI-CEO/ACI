/**
 * Phase 0 backfill: ensure a Club exists for every organizationName and create
 * ClubMembership rows (CLUB → DOC, COACH → COACH). Keeps organizationName as-is.
 *
 * Usage (from apps/api):
 *   node -r dotenv/config -r ts-node/register/transpile-only \
 *     src/scripts/backfill-club-memberships.ts
 *
 * Dry-run (default): prints planned writes, no commits.
 * Apply: pass --apply
 *
 * Safety: never runs prisma migrate reset. Idempotent via unique(userId, clubId).
 */
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, ClubRole, GameModelId, UserRole } from '@prisma/client';

// Prefer repo-root .env (this project's convention), then apps/api/.env
const rootEnv = path.resolve(process.cwd(), '../../.env');
const localEnv = path.resolve(process.cwd(), '.env');
loadEnv({ path: rootEnv });
loadEnv({ path: localEnv });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL missing. Load from repo-root .env or apps/api/.env before running.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return base || 'CLUB';
}

async function uniqueClubCode(desired: string): Promise<string> {
  let code = desired;
  let n = 2;
  while (true) {
    const existing = await prisma.club.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!existing) return code;
    code = `${desired.slice(0, 20)}_${n}`;
    n += 1;
  }
}

async function ensureClubForOrgName(orgName: string): Promise<{ id: string; name: string; created: boolean }> {
  const existing = await prisma.club.findFirst({
    where: { name: { equals: orgName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  const code = await uniqueClubCode(slugCode(orgName));
  // Default game model: COACHAI unless the org is known Rocklin FC.
  const gameModelId =
    orgName.trim().toLowerCase() === 'rocklin fc' ? GameModelId.ROCKLIN_FC : GameModelId.COACHAI;

  if (!APPLY) {
    return { id: `dry-run-${code}`, name: orgName, created: true };
  }

  const created = await prisma.club.create({
    data: {
      name: orgName.trim(),
      code,
      gameModelId,
      description: `Backfilled from organizationName "${orgName}"`,
      active: true,
    },
    select: { id: true, name: true },
  });
  return { ...created, created: true };
}

function membershipRoleForUser(user: {
  role: UserRole;
  email: string | null;
}): ClubRole | null {
  if (user.role === 'CLUB') return ClubRole.DOC;

  // Heuristic for clubs that never used UserRole.CLUB: emails that clearly
  // mark a director (e.g. doc@rocklinfc.org) become DOC, not COACH.
  const local = String(user.email || '')
    .split('@')[0]
    .toLowerCase();
  if (
    local === 'doc' ||
    local.startsWith('doc.') ||
    local.startsWith('doc_') ||
    local.includes('director')
  ) {
    return ClubRole.DOC;
  }

  if (user.role === 'COACH' || user.role === 'ADMIN' || user.role === 'FREE' || user.role === 'TRIAL') {
    return ClubRole.COACH;
  }
  return null;
}

async function main() {
  console.log(`[backfill-club-memberships] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const users = await prisma.user.findMany({
    where: {
      organizationName: { not: null },
      NOT: { organizationName: '' },
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationName: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const byOrg = new Map<string, typeof users>();
  for (const u of users) {
    const key = u.organizationName!.trim();
    if (!key) continue;
    const list = byOrg.get(key) ?? [];
    list.push(u);
    byOrg.set(key, list);
  }

  console.log(`Found ${users.length} users with organizationName across ${byOrg.size} org(s)`);

  let clubsCreated = 0;
  let membershipsCreated = 0;
  let membershipsSkipped = 0;

  for (const [orgName, members] of byOrg) {
    const club = await ensureClubForOrgName(orgName);
    if (club.created) {
      clubsCreated += 1;
      console.log(`  club ${APPLY ? 'CREATE' : 'WOULD CREATE'}: "${orgName}"`);
    } else {
      console.log(`  club EXISTS: "${club.name}" (${club.id})`);
    }

    for (const member of members) {
      const role = membershipRoleForUser(member);
      if (!role) {
        membershipsSkipped += 1;
        continue;
      }

      if (!APPLY) {
        console.log(
          `    WOULD UPSERT membership user=${member.email ?? member.id} role=${role}`
        );
        membershipsCreated += 1;
        continue;
      }

      const existing = await prisma.clubMembership.findUnique({
        where: {
          userId_clubId: { userId: member.id, clubId: club.id },
        },
        select: { id: true, role: true },
      });

      if (existing) {
        // Never downgrade an existing DOC/SECTION_DIRECTOR to COACH on re-run
        if (
          (existing.role === ClubRole.DOC || existing.role === ClubRole.SECTION_DIRECTOR) &&
          role === ClubRole.COACH
        ) {
          membershipsSkipped += 1;
          continue;
        }
        if (existing.role !== role) {
          await prisma.clubMembership.update({
            where: { id: existing.id },
            data: { role },
          });
          console.log(`    UPDATE ${member.email ?? member.id}: ${existing.role} → ${role}`);
        } else {
          membershipsSkipped += 1;
        }
        continue;
      }

      await prisma.clubMembership.create({
        data: {
          userId: member.id,
          clubId: club.id,
          role,
        },
      });
      membershipsCreated += 1;
      console.log(`    CREATE ${member.email ?? member.id} as ${role}`);
    }
  }

  console.log('---');
  console.log(
    `Done. clubsCreated=${clubsCreated} membershipsWritten=${membershipsCreated} skipped=${membershipsSkipped}`
  );
  if (!APPLY) {
    console.log('Re-run with --apply to write changes.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
