import { randomBytes, randomUUID } from "crypto";
import { prisma } from "../prisma";
import { generateText } from "../gemini";
import { listClubs } from "./clubs-store";
import { listClubMembershipsForUsers } from "./club-memberships";
import { hashPassword } from "./auth";
import { logAdminAction, AdminRequest } from "../middleware/admin-auth";

const PENDING_TTL_MS = 5 * 60 * 1000;

type PendingAction = {
  id: string;
  adminUserId: string;
  type:
    | "update_role"
    | "update_subscription"
    | "block_user"
    | "verify_email"
    | "reset_password";
  userId: string;
  payload: Record<string, unknown>;
  summary: string;
  createdAt: number;
};

const pendingActions = new Map<string, PendingAction>();

function prunePending() {
  const now = Date.now();
  for (const [id, action] of pendingActions) {
    if (now - action.createdAt > PENDING_TTL_MS) pendingActions.delete(id);
  }
}

function issuePending(action: Omit<PendingAction, "id" | "createdAt">): PendingAction {
  prunePending();
  const full: PendingAction = {
    ...action,
    id: randomUUID(),
    createdAt: Date.now(),
  };
  pendingActions.set(full.id, full);
  return full;
}

export function getPendingAction(id: string, adminUserId: string): PendingAction | null {
  prunePending();
  const action = pendingActions.get(id);
  if (!action) return null;
  if (action.adminUserId !== adminUserId) return null;
  return action;
}

export function consumePendingAction(id: string, adminUserId: string): PendingAction | null {
  const action = getPendingAction(id, adminUserId);
  if (!action) return null;
  pendingActions.delete(id);
  return action;
}

type AssistantPlan = {
  message: string;
  intent: string;
  params: Record<string, unknown>;
  proposedAction: {
    type: PendingAction["type"];
    userEmailOrId?: string;
    role?: string | null;
    adminRole?: string | null;
    subscriptionPlan?: string;
    subscriptionStatus?: string;
    blocked?: boolean;
    reason?: string;
    summary?: string;
  } | null;
};

const SYSTEM_PROMPT = `You are the CoachAI Admin Ops Assistant. You help SUPER_ADMIN operators with platform administration only — NOT session/drill coaching design.

Capabilities:
READ (executed immediately by the server):
- lookup_user: find one user by email or user id
- search_users: find users by email/name fragment (limit 10)
- user_summary: totals by role / admin role / plan / status
- platform_stats: sessions, drills, API success, token costs
- list_clubs: list clubs with game models and member counts
- account_alerts: open account alerts
- chat: general admin guidance / clarify what you need

WRITE (never execute yourself — only propose; human must confirm):
- update_role: change app role and/or adminRole
- update_subscription: change subscriptionPlan / subscriptionStatus
- block_user: block or unblock (blocked true/false + optional reason)
- verify_email: mark email verified
- reset_password: generate a temporary password

Rules:
1. Never invent user ids. Prefer email when the admin names an email.
2. For destructive or privilege changes, set proposedAction and explain clearly in message.
3. Do NOT help with coaching session generation — redirect to Coach Assistant.
4. Respond ONLY with valid JSON:
{
  "message": "short operator-facing reply",
  "intent": "lookup_user|search_users|user_summary|platform_stats|list_clubs|account_alerts|chat|update_role|update_subscription|block_user|verify_email|reset_password",
  "params": { "email": "...", "userId": "...", "query": "..." },
  "proposedAction": null | {
    "type": "update_role|update_subscription|block_user|verify_email|reset_password",
    "userEmailOrId": "email or id",
    "role": "COACH|FREE|CLUB|ADMIN|TRIAL|null",
    "adminRole": "SUPER_ADMIN|ADMIN|MODERATOR|SUPPORT|null",
    "subscriptionPlan": "FREE|COACH_BASIC|COACH_PRO|CLUB_STANDARD|CLUB_PREMIUM|TRIAL",
    "subscriptionStatus": "ACTIVE|CANCELLED|EXPIRED|TRIAL",
    "blocked": true,
    "reason": "optional",
    "summary": "one-line confirmation text"
  }
}`;

function parsePlan(text: string): AssistantPlan {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      message: "I can look up users, show analytics, list clubs, or propose role/subscription/block changes.",
      intent: "chat",
      params: {},
      proposedAction: null,
    };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      message: String(parsed.message || "Done."),
      intent: String(parsed.intent || "chat"),
      params: parsed.params && typeof parsed.params === "object" ? parsed.params : {},
      proposedAction: parsed.proposedAction || null,
    };
  } catch {
    return {
      message: "I had trouble parsing that. Try: “lookup coach@example.com” or “user summary”.",
      intent: "chat",
      params: {},
      proposedAction: null,
    };
  }
}

function heuristicPlan(message: string): AssistantPlan {
  const lower = message.toLowerCase();
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0];

  if (/user summary|summary of users|by plan|by role/.test(lower)) {
    return { message: "Pulling user summary…", intent: "user_summary", params: {}, proposedAction: null };
  }
  if (/platform stats|api stats|token cost|usage stats|dashboard stats/.test(lower)) {
    return { message: "Pulling platform stats…", intent: "platform_stats", params: {}, proposedAction: null };
  }
  if (/list clubs|show clubs|club list/.test(lower)) {
    return { message: "Listing clubs…", intent: "list_clubs", params: {}, proposedAction: null };
  }
  if (/alert/.test(lower)) {
    return { message: "Checking account alerts…", intent: "account_alerts", params: {}, proposedAction: null };
  }
  if (email && (/lookup|find|show|who is|account|user/.test(lower) || lower.trim() === email.toLowerCase())) {
    return {
      message: `Looking up ${email}…`,
      intent: "lookup_user",
      params: { email },
      proposedAction: null,
    };
  }
  if (/search|find users/.test(lower)) {
    return {
      message: "Searching users…",
      intent: "search_users",
      params: { query: message.replace(/search|find users?/gi, "").trim() || message },
      proposedAction: null,
    };
  }
  return {
    message:
      "I can look up accounts, show user/platform analytics, list clubs, and propose role, subscription, block, verify, or password-reset changes (you confirm writes).",
    intent: "chat",
    params: {},
    proposedAction: null,
  };
}

async function resolveUserId(
  emailOrId?: string | null
): Promise<{ id: string; email: string; name: string | null } | null> {
  const raw = String(emailOrId || "").trim();
  if (!raw) return null;
  const row = raw.includes("@")
    ? await prisma.user.findFirst({
        where: { email: { equals: raw, mode: "insensitive" } },
        select: { id: true, email: true, name: true },
      })
    : await prisma.user.findUnique({
        where: { id: raw },
        select: { id: true, email: true, name: true },
      });
  if (!row?.email) return null;
  return { id: row.id, email: row.email, name: row.name };
}

async function lookupUser(emailOrId: string) {
  const base = await resolveUserId(emailOrId);
  if (!base) return null;
  const user = await prisma.user.findUnique({
    where: { id: base.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminRole: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      coachLevel: true,
      organizationName: true,
      teamAgeGroups: true,
      emailVerified: true,
      blocked: true,
      blockedReason: true,
      sessionsGeneratedThisMonth: true,
      drillsGeneratedThisMonth: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  const memberships = await listClubMembershipsForUsers([user.id]);
  return {
    ...user,
    clubMemberships: memberships.get(user.id) ?? [],
  };
}

async function searchUsers(query: string) {
  const q = String(query || "").trim();
  if (!q) return [];
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { organizationName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminRole: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      blocked: true,
      organizationName: true,
    },
  });
  return users;
}

async function userSummary() {
  const [totalUsers, byRoleRaw, byAdminRoleRaw, byPlanRaw, byStatusRaw] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.user.groupBy({
      by: ["adminRole"],
      _count: { id: true },
      where: { adminRole: { not: null } },
    }),
    prisma.user.groupBy({ by: ["subscriptionPlan"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["subscriptionStatus"], _count: { id: true } }),
  ]);
  const toMap = (rows: Array<{ [k: string]: any; _count: { id: number } }>, key: string) =>
    Object.fromEntries(rows.map((r) => [String(r[key]), r._count.id]));
  return {
    totalUsers,
    byRole: toMap(byRoleRaw, "role"),
    byAdminRole: toMap(byAdminRoleRaw, "adminRole"),
    bySubscriptionPlan: toMap(byPlanRaw, "subscriptionPlan"),
    bySubscriptionStatus: toMap(byStatusRaw, "subscriptionStatus"),
  };
}

async function platformStats() {
  const [
    totalSessions,
    totalDrills,
    totalSeries,
    vaultSessions,
    vaultDrills,
    totalApiCalls,
    successfulCalls,
    allTimeTokens,
  ] = await Promise.all([
    prisma.session.count(),
    prisma.drill.count(),
    prisma.session.count({ where: { isSeries: true } }),
    prisma.session.count({ where: { savedToVault: true } }),
    prisma.drill.count({ where: { savedToVault: true } }),
    prisma.apiMetrics.count(),
    prisma.apiMetrics.count({ where: { success: true } }),
    prisma.apiMetrics.aggregate({
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
    }),
  ]);

  const uniqueSeries = await prisma.session.groupBy({
    by: ["seriesId"],
    where: { seriesId: { not: null } },
  });

  const inputPer1M = Number(process.env.GEMINI_INPUT_PRICE_PER_1M) || 0.5;
  const outputPer1M = Number(process.env.GEMINI_OUTPUT_PRICE_PER_1M) || 3.0;
  const promptTokens = allTimeTokens._sum.promptTokens || 0;
  const completionTokens = allTimeTokens._sum.completionTokens || 0;
  const allTimeCost =
    (promptTokens / 1_000_000) * inputPer1M + (completionTokens / 1_000_000) * outputPer1M;

  return {
    database: {
      totalSessions,
      totalDrills,
      totalSeries: uniqueSeries.length,
      seriesSessions: totalSeries,
      vaultSessions,
      vaultDrills,
    },
    api: {
      totalCalls: totalApiCalls,
      successfulCalls,
      failedCalls: totalApiCalls - successfulCalls,
      successRate:
        totalApiCalls > 0
          ? `${((successfulCalls / totalApiCalls) * 100).toFixed(1)}%`
          : "100%",
    },
    tokens: {
      allTimeTotal: allTimeTokens._sum.totalTokens || 0,
      allTimeCost: allTimeCost.toFixed(4),
      model: process.env.GEMINI_MODEL_PRIMARY || "gemini-3.5-flash-lite",
    },
  };
}

async function clubsSnapshot() {
  const clubs = await listClubs();
  const withCounts = await Promise.all(
    clubs.map(async (c) => {
      const memberCount = await prisma.clubMembership.count({ where: { clubId: c.id } });
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        gameModelId: c.gameModelId,
        active: c.active,
        memberCount,
      };
    })
  );
  return withCounts;
}

function formatDataBlock(title: string, data: unknown): string {
  return `\n\n**${title}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export async function runAdminOpsAssistant(input: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  adminUserId: string;
  req: AdminRequest;
}): Promise<{
  ok: true;
  message: string;
  intent: string;
  data: unknown;
  proposedAction: null | {
    confirmId: string;
    type: string;
    summary: string;
    userId: string;
    userEmail?: string;
    payload: Record<string, unknown>;
  };
  model: string;
}> {
  const historyText = (input.history || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Admin" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `${SYSTEM_PROMPT}

Previous conversation:
${historyText || "(new)"}

Admin message: "${input.message}"

Return JSON only.`;

  let plan: AssistantPlan;
  let model = process.env.GEMINI_MODEL_PRIMARY || "gemini-3.5-flash-lite";
  try {
    const text = await generateText(prompt, { timeout: 30000, retries: 0 });
    plan = parsePlan(text);
  } catch {
    plan = heuristicPlan(input.message);
  }

  // Normalize write intents into proposedAction
  const writeIntents = new Set([
    "update_role",
    "update_subscription",
    "block_user",
    "verify_email",
    "reset_password",
  ]);
  if (writeIntents.has(plan.intent) && !plan.proposedAction) {
    plan.proposedAction = {
      type: plan.intent as PendingAction["type"],
      userEmailOrId:
        String(plan.params.email || plan.params.userId || plan.params.userEmailOrId || "") ||
        undefined,
      role: plan.params.role as string | undefined,
      adminRole: plan.params.adminRole as string | null | undefined,
      subscriptionPlan: plan.params.subscriptionPlan as string | undefined,
      subscriptionStatus: plan.params.subscriptionStatus as string | undefined,
      blocked: plan.params.blocked as boolean | undefined,
      reason: plan.params.reason as string | undefined,
      summary: plan.message,
    };
  }

  let data: unknown = null;
  let message = plan.message;

  switch (plan.intent) {
    case "lookup_user": {
      const key = String(plan.params.email || plan.params.userId || "").trim();
      if (!key) {
        message = "Which user email or id should I look up?";
        break;
      }
      data = await lookupUser(key);
      message = data
        ? `Found account for ${(data as any).email}.${formatDataBlock("User", data)}`
        : `No user found for "${key}".`;
      break;
    }
    case "search_users": {
      const query = String(plan.params.query || plan.params.email || input.message).trim();
      data = await searchUsers(query);
      message =
        Array.isArray(data) && data.length
          ? `Found ${data.length} user(s).${formatDataBlock("Users", data)}`
          : `No users matched "${query}".`;
      break;
    }
    case "user_summary": {
      data = await userSummary();
      message = `User summary ready.${formatDataBlock("Summary", data)}`;
      break;
    }
    case "platform_stats": {
      data = await platformStats();
      message = `Platform stats ready.${formatDataBlock("Stats", data)}`;
      break;
    }
    case "list_clubs": {
      data = await clubsSnapshot();
      message = `Clubs snapshot.${formatDataBlock("Clubs", data)}`;
      break;
    }
    case "account_alerts": {
      data = { alerts: [] };
      message = "No open account alerts right now.";
      break;
    }
    default:
      break;
  }

  let proposedAction: null | {
    confirmId: string;
    type: string;
    summary: string;
    userId: string;
    userEmail?: string;
    payload: Record<string, unknown>;
  } = null;

  if (plan.proposedAction?.type) {
    const target = await resolveUserId(
      plan.proposedAction.userEmailOrId ||
        String(plan.params.email || plan.params.userId || "")
    );
    if (!target) {
      message +=
        "\n\nI need a valid user email/id before I can propose that change.";
    } else if (target.id === input.adminUserId && plan.proposedAction.type === "update_role") {
      message += "\n\nYou can’t change your own role via the assistant.";
    } else if (target.id === input.adminUserId && plan.proposedAction.type === "block_user") {
      message += "\n\nYou can’t block your own account.";
    } else {
      const payload: Record<string, unknown> = {};
      const type = plan.proposedAction.type;
      if (type === "update_role") {
        if (plan.proposedAction.role !== undefined) payload.role = plan.proposedAction.role;
        if (plan.proposedAction.adminRole !== undefined) {
          payload.adminRole = plan.proposedAction.adminRole;
        }
      } else if (type === "update_subscription") {
        payload.subscriptionPlan = plan.proposedAction.subscriptionPlan;
        payload.subscriptionStatus = plan.proposedAction.subscriptionStatus;
      } else if (type === "block_user") {
        payload.blocked = Boolean(plan.proposedAction.blocked);
        payload.reason = plan.proposedAction.reason || null;
      }

      const summary =
        plan.proposedAction.summary ||
        `${type.replace(/_/g, " ")} for ${target.email}`;

      if (
        type === "update_role" &&
        payload.role === undefined &&
        payload.adminRole === undefined
      ) {
        message += "\n\nSpecify the new role and/or adminRole to propose.";
      } else if (
        type === "update_subscription" &&
        (!payload.subscriptionPlan || !payload.subscriptionStatus)
      ) {
        message += "\n\nSpecify subscriptionPlan and subscriptionStatus.";
      } else if (type === "block_user" && typeof plan.proposedAction.blocked !== "boolean") {
        message += "\n\nSay whether to block or unblock.";
      } else {
        const pending = issuePending({
          adminUserId: input.adminUserId,
          type,
          userId: target.id,
          payload,
          summary,
        });
        proposedAction = {
          confirmId: pending.id,
          type,
          summary,
          userId: target.id,
          userEmail: target.email,
          payload,
        };
        message += `\n\n**Confirm required:** ${summary}\nClick Confirm to apply (expires in 5 minutes).`;
      }
    }
  }

  await logAdminAction(
    input.adminUserId,
    "ops_assistant.query",
    {
      resourceType: "AdminOpsAssistant",
      data: { intent: plan.intent, hasProposal: Boolean(proposedAction) },
    },
    input.req
  ).catch(() => undefined);

  return {
    ok: true,
    message,
    intent: plan.intent,
    data,
    proposedAction,
    model,
  };
}

export async function confirmAdminOpsAction(input: {
  confirmId: string;
  adminUserId: string;
  req: AdminRequest;
}): Promise<{ ok: boolean; message: string; result?: unknown; error?: string }> {
  const pending = consumePendingAction(input.confirmId, input.adminUserId);
  if (!pending) {
    return { ok: false, error: "Proposal expired or not found. Ask again." , message: "Proposal expired or not found." };
  }

  const { type, userId, payload } = pending;

  try {
    if (type === "update_role") {
      if (userId === input.adminUserId) {
        return { ok: false, error: "Cannot change your own role", message: "Cannot change your own role." };
      }
      const updateData: any = {};
      if (payload.role) {
        updateData.role = payload.role;
      }
      if (payload.adminRole !== undefined) {
        updateData.adminRole = payload.adminRole;
      }
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          adminRole: true,
        },
      });
      await logAdminAction(
        input.adminUserId,
        "ops_assistant.role_updated",
        { resourceType: "User", resourceId: userId, data: payload },
        input.req
      );
      return { ok: true, message: `Updated roles for ${user.email}.`, result: user };
    }

    if (type === "update_subscription") {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: payload.subscriptionPlan as any,
          subscriptionStatus: payload.subscriptionStatus as any,
          subscriptionStartDate:
            payload.subscriptionStatus === "ACTIVE" ? new Date() : undefined,
        },
        select: {
          id: true,
          email: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
        },
      });
      await logAdminAction(
        input.adminUserId,
        "ops_assistant.subscription_updated",
        { resourceType: "User", resourceId: userId, data: payload },
        input.req
      );
      return { ok: true, message: `Updated subscription for ${user.email}.`, result: user };
    }

    if (type === "block_user") {
      if (userId === input.adminUserId) {
        return { ok: false, error: "Cannot block yourself", message: "Cannot block yourself." };
      }
      const blocked = Boolean(payload.blocked);
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          blocked,
          blockedAt: blocked ? new Date() : null,
          blockedReason: blocked ? (payload.reason as string) || null : null,
        },
        select: {
          id: true,
          email: true,
          blocked: true,
          blockedReason: true,
        },
      });
      await logAdminAction(
        input.adminUserId,
        blocked ? "ops_assistant.user_blocked" : "ops_assistant.user_unblocked",
        { resourceType: "User", resourceId: userId, data: payload },
        input.req
      );
      return {
        ok: true,
        message: blocked ? `Blocked ${user.email}.` : `Unblocked ${user.email}.`,
        result: user,
      };
    }

    if (type === "verify_email") {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
        select: { id: true, email: true, emailVerified: true },
      });
      await logAdminAction(
        input.adminUserId,
        "ops_assistant.email_verified",
        { resourceType: "User", resourceId: userId },
        input.req
      );
      return { ok: true, message: `Verified email for ${user.email}.`, result: user };
    }

    if (type === "reset_password") {
      const tempPassword = `Tmp-${randomBytes(4).toString("hex")}!A1`;
      const passwordHash = await hashPassword(tempPassword);
      const user = await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { id: true, email: true },
      });
      await logAdminAction(
        input.adminUserId,
        "ops_assistant.password_reset",
        { resourceType: "User", resourceId: userId },
        input.req
      );
      return {
        ok: true,
        message: `Temporary password set for ${user.email}. Share securely, then ask them to change it.`,
        result: { email: user.email, temporaryPassword: tempPassword },
      };
    }

    return { ok: false, error: "Unknown action", message: "Unknown action type." };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), message: e?.message || "Action failed." };
  }
}
