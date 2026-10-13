/**
 * Direct (non-HTTP) reset of the three Rocklin FC pilot coaches against the
 * staging Postgres instance. Use this when the API route hasn't been deployed
 * yet but you still need to log into the simulator immediately.
 *
 * DATABASE_URL and JWT_SECRET must be set in env (export from ~/Projects/aci/.env):
 *     set -a && source ~/Projects/aci/.env && set +a
 *     pnpm exec ts-node scripts/direct-reset-pilot-coaches.ts
 *
 * Optional arg: a password to use (defaults to "TestPilot!")
 */
import path from 'path';
import crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import {
  CoachLevel,
  PrismaClient,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  ClubRole,
} from '@prisma/client';

loadEnv({ path: path.resolve(process.cwd(), '../../.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set (export from ~/Projects/aci/.env or your own copy).');
  process.exit(1);
}

const argPw = process.argv[2];
const plainPassword = argPw && argPw.length >= 6 ? argPw : 'TestPilot!';

const PILOT_EMAILS = [
  {
    email: '7v7.coach@rocklinfc.org',
    name: '7v7 Test Coach',
    ageGroups: ['U8', 'U9', 'U10'],
    formats: ['7v7'],
  },
  {
    email: '9v9.coach@rocklinfc.org',
    name: '9v9 Test Coach',
    ageGroups: ['U11', 'U12'],
    formats: ['9v9'],
  },
  {
    email: '11v11.coach@rocklinfc.org',
    name: '11v11 Test Coach',
    ageGroups: ['U13', 'U14', 'U15', 'U16', 'U17', 'U18'],
    formats: ['11v11'],
  },
];

const CLUB_NAME = 'Rocklin FC';

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL as string;
  console.log('[direct-reset-pilot-coaches] DATABASE_URL host=', new URL(dbUrl).host);
  const club = await prisma.club.findFirst({
    where: { name: { equals: CLUB_NAME, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!club) {
    console.error(`Club "${CLUB_NAME}" not found. Aborting.`);
    process.exit(2);
  }
  console.log(`Club: ${club.name} ${club.id}`);

  const passwordHash = await bcrypt.hash(plainPassword, 12);
  const now = new Date();
  const updated: Array<{ email: string; password: string }> = [];

  for (const spec of PILOT_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email: spec.email },
      select: { id: true, email: true },
    });
    if (!user) {
      console.log(`  SKIP ${spec.email} (not present in DB)`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        role: UserRole.COACH,
        coachLevel: CoachLevel.USSF_C,
        organizationName: club.name,
        teamAgeGroups: [...spec.ageGroups],
        subscriptionPlan: SubscriptionPlan.COACH_BASIC,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: now,
      },
    });

    await prisma.clubMembership.upsert({
      where: { userId_clubId: { userId: user.id, clubId: club.id } },
      create: { userId: user.id, clubId: club.id, role: ClubRole.COACH },
      update: { role: ClubRole.COACH },
    });

    const perm = await prisma.accessPermission.findFirst({
      where: { userId: user.id, resourceType: 'BOTH', clubId: club.id },
      select: { id: true },
    });
    const permData = {
      resourceType: 'BOTH',
      userId: user.id,
      clubId: club.id,
      ageGroups: [...spec.ageGroups],
      formats: [...spec.formats],
      canGenerateSessions: true,
      canAccessVault: true,
      canAccessVideoReview: false,
      notes: `Pilot test coach for ${spec.formats[0]} (${spec.ageGroups[0]}–${spec.ageGroups[spec.ageGroups.length - 1]})`,
    };
    if (perm) {
      await prisma.accessPermission.update({ where: { id: perm.id }, data: permData });
    } else {
      await prisma.accessPermission.create({ data: permData });
    }

    updated.push({ email: user.email ?? spec.email, password: plainPassword });
    console.log(`  RESET ${user.email}`);
  }

  console.log('---');
  console.log('Login with these credentials:');
  for (const c of updated) {
    console.log(`  ${c.email}    ${c.password}`);
  }
  if (updated.length === 0) {
    console.log('(No pilots found. The DB may not have been seeded. Try the standard seed-pilot-coaches script.)');
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
