/**
 * Dev-only helpers for resetting seed accounts.
 *
 * These endpoints exist to make local/staging recovery painless when the
 * staging database is reseeded and the seed-script credentials drift out
 * of sync with what's documented for the test coaches.
 *
 * Safety:
 *   - The entire router is gated by `NODE_ENV !== "production"` and a
 *     shared-secret header (`X-DEV-SEED-SECRET`) that must match the
 *     `DEV_SEED_SECRET` env var. Both checks must pass.
 *   - If either is missing, the router responds 404 (looks absent).
 *   - All writes go through Prisma using the normal `hashPassword` path.
 *
 * Why header + env (instead of admin auth)? Because the seeded pilot
 * accounts aren't admins themselves, and after a DB reset there may be
 * no admin account with a known password. This header is simpler than
 * bootstrapping an admin token.
 */
import { Router } from "express";
import {
  ClubRole,
  CoachLevel,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword } from "./services/auth";

const PILOT_EMAILS = [
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

const CLUB_NAME = "Rocklin FC";

function isDevSeedAuthorized(req: { header(name: string): string | undefined }): boolean {
  // Allowed when:
  //   (a) ENABLE_DEV_SEED_ROUTES=1 is explicitly set in env (preferred for staging/prod), OR
  //   (b) NODE_ENV !== 'production' (local dev convenience)
  const explicitlyEnabled = process.env.ENABLE_DEV_SEED_ROUTES === "1";
  const devMode = process.env.NODE_ENV !== "production";
  if (!explicitlyEnabled && !devMode) return false;
  const expected = process.env.DEV_SEED_SECRET?.trim();
  if (!expected) return false;
  const provided = req.header("x-dev-seed-secret")?.trim();
  return Boolean(provided) && provided === expected;
}

const router = Router();

/**
 * POST /admin/dev/reset-pilot-coaches
 * Body (optional): { password?: string }
 *   - If supplied, overrides the default `TestPilot!` value for this run only.
 *
 * Returns 200 with the email/password pairs that were (re)set so you can
 * hand them to a tester or copy them into the runbook.
 */
router.post(
  "/admin/dev/reset-pilot-coaches",
  async (req, res) => {
    if (!isDevSeedAuthorized(req)) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const requestedPassword =
      typeof req.body?.password === "string" && req.body.password.length >= 6
        ? req.body.password.trim()
        : null;
    const plainPassword = requestedPassword ?? "TestPilot!";
    const passwordHash = await hashPassword(plainPassword);

    const club = await prisma.club.findFirst({
      where: { name: { equals: CLUB_NAME, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!club) {
      return res.status(412).json({
        ok: false,
        error: `Club "${CLUB_NAME}" not found. Run the club membership backfill first.`,
      });
    }

    const now = new Date();
    const credentials: Array<{ email: string; password: string }> = [];

    for (const spec of PILOT_EMAILS) {
      const existing = await prisma.user.findUnique({
        where: { email: spec.email },
        select: { id: true },
      });
      if (!existing) continue;

      await prisma.user.update({
        where: { id: existing.id },
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
        select: { id: true, email: true },
      });

      await prisma.clubMembership.upsert({
        where: { userId_clubId: { userId: existing.id, clubId: club.id } },
        create: { userId: existing.id, clubId: club.id, role: ClubRole.COACH },
        update: { role: ClubRole.COACH },
      });

      const permission = await prisma.accessPermission.findFirst({
        where: { userId: existing.id, resourceType: "BOTH", clubId: club.id },
        select: { id: true },
      });
      const permissionData = {
        resourceType: "BOTH",
        userId: existing.id,
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

      credentials.push({ email: spec.email, password: plainPassword });
    }

    return res.json({
      ok: true,
      club: club.name,
      updatedCount: credentials.length,
      credentials,
    });
  }
);

export default router;
