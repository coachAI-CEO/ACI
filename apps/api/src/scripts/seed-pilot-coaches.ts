/**
 * Create three Rocklin FC testing coaches, one per format band used by
 * session generation (U8–U10 7v7, U11–U12 9v9, U13–U18 11v11).
 *
 * Usage (from apps/api):
 *   pnpm seed:pilot-coaches
 *   pnpm seed:pilot-coaches -- --apply
 *   PILOT_COACH_PASSWORD='...' pnpm seed:pilot-coaches -- --apply
 *   pnpm seed:pilot-coaches -- --apply --reset-password
 *
 * Dry-run (default): prints planned writes, no commits.
 * Idempotent via email + unique(userId, clubId). Does not reset passwords
 * on re-run unless --reset-password or PILOT_COACH_PASSWORD is set on apply.
 */
import path from "path";
import crypto from "crypto";
import { config as loadEnv } from "dotenv";
import {
  ClubRole,
  CoachLevel,
  PrismaClient,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "../services/auth";

const rootEnv = path.resolve(process.cwd(), "../../.env");
const localEnv = path.resolve(process.cwd(), ".env");
loadEnv({ path: rootEnv });
loadEnv({ path: localEnv });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing. Load from repo-root .env or apps/api/.env before running.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const RESET_PASSWORD = process.argv.includes("--reset-password");
const CLUB_NAME = "Rocklin FC";

const COACHES = [
  {
    email: "7v7.coach@rocklinfc.org",
    name: "7v7 Test Coach",
    ageGroups: ["U8", "U9", "U10"],
    formats: ["7v7"],
  },
  {
    email: "9v9.coach@rocklinfc.org",
    name: "9v9 Test Coach",
    ageGroups: ["U11", "U12"],
    formats: ["9v9"],
  },
  {
    email: "11v11.coach@rocklinfc.org",
    name: "11v11 Test Coach",
    ageGroups: ["U13", "U14", "U15", "U16", "U17", "U18"],
    formats: ["11v11"],
  },
] as const;

const prisma = new PrismaClient();

function resolvePlainPassword(): string | null {
  const fromEnv = process.env.PILOT_COACH_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (!APPLY) return null;
  return `PilotCoach-${crypto.randomBytes(6).toString("base64url")}`;
}

async function main() {
  console.log(`[seed-pilot-coaches] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  const club = await prisma.club.findFirst({
    where: { name: { equals: CLUB_NAME, mode: "insensitive" } },
    select: { id: true, name: true, gameModelId: true },
  });

  if (!club) {
    console.error(`Club "${CLUB_NAME}" not found. Run the club membership backfill first.`);
    process.exit(1);
  }

  console.log(`Club: ${club.name} (${club.id}) model=${club.gameModelId}`);

  const plainPassword = resolvePlainPassword();
  const passwordHash =
    APPLY && (RESET_PASSWORD || plainPassword)
      ? await hashPassword(plainPassword as string)
      : null;
  const now = new Date();
  const printedCredentials: Array<{ email: string; password: string }> = [];

  for (const spec of COACHES) {
    const existing = await prisma.user.findUnique({
      where: { email: spec.email },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!APPLY) {
      console.log(
        `  WOULD ${existing ? "UPDATE" : "CREATE"} ${spec.email} ages=${spec.ageGroups.join(",")} formats=${spec.formats.join(",")}`
      );
      continue;
    }

    const envPassword = Boolean(process.env.PILOT_COACH_PASSWORD?.trim());
    const shouldSetPassword =
      Boolean(passwordHash) && (!existing || RESET_PASSWORD || envPassword);
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: spec.name,
            role: UserRole.COACH,
            coachLevel: CoachLevel.USSF_C,
            organizationName: club.name,
            teamAgeGroups: [...spec.ageGroups],
            subscriptionPlan: SubscriptionPlan.COACH_BASIC,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: now,
            ...(shouldSetPassword ? { passwordHash } : {}),
          },
          select: { id: true, email: true },
        })
      : await prisma.user.create({
          data: {
            email: spec.email,
            name: spec.name,
            passwordHash: passwordHash as string,
            role: UserRole.COACH,
            coachLevel: CoachLevel.USSF_C,
            organizationName: club.name,
            teamAgeGroups: [...spec.ageGroups],
            subscriptionPlan: SubscriptionPlan.COACH_BASIC,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            subscriptionStartDate: now,
            lastResetDate: now,
            emailVerified: true,
            emailVerifiedAt: now,
          },
          select: { id: true, email: true },
        });

    if (!existing || shouldSetPassword) {
      printedCredentials.push({ email: user.email!, password: plainPassword as string });
    }

    await prisma.clubMembership.upsert({
      where: { userId_clubId: { userId: user.id, clubId: club.id } },
      create: { userId: user.id, clubId: club.id, role: ClubRole.COACH },
      update: { role: ClubRole.COACH },
    });

    const permission = await prisma.accessPermission.findFirst({
      where: { userId: user.id, resourceType: "BOTH", clubId: club.id },
      select: { id: true },
    });

    const permissionData = {
      resourceType: "BOTH",
      userId: user.id,
      clubId: club.id,
      ageGroups: [...spec.ageGroups],
      formats: [...spec.formats],
      canGenerateSessions: true,
      canAccessVault: true,
      canAccessVideoReview: false,
      notes: `Pilot test coach for ${spec.formats[0]} (${spec.ageGroups[0]}–${spec.ageGroups[spec.ageGroups.length - 1]})`,
    };

    if (permission) {
      await prisma.accessPermission.update({
        where: { id: permission.id },
        data: permissionData,
      });
    } else {
      await prisma.accessPermission.create({ data: permissionData });
    }

    console.log(`  ${existing ? "UPDATED" : "CREATED"} ${spec.email} id=${user.id}`);
  }

  if (!APPLY) {
    console.log("Re-run with --apply to write changes.");
    return;
  }

  if (printedCredentials.length > 0) {
    console.log("---");
    console.log("Login (shared password for accounts created or reset this run):");
    for (const row of printedCredentials) {
      console.log(`  ${row.email}  ${row.password}`);
    }
  } else {
    console.log("Passwords left unchanged. Pass --reset-password or PILOT_COACH_PASSWORD to set them.");
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
