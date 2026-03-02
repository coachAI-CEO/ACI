import { prisma } from '../prisma';
import { sendNewAccountAlertEmail } from './email';

type NewAccountAlertInput = {
  userId: string;
  email: string;
  name?: string | null;
  role?: string | null;
  subscriptionPlan?: string | null;
  source: 'self_register' | 'admin_quick_create' | 'organization_invite';
  createdById?: string | null;
  createdByEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function parseConfiguredAlertEmails(): string[] {
  return (process.env.ADMIN_ALERT_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => Boolean(value));
}

export async function notifyNewAccountCreated(input: NewAccountAlertInput): Promise<void> {
  const createdAt = new Date();

  const superAdmins = await prisma.user.findMany({
    where: {
      adminRole: 'SUPER_ADMIN',
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
    },
  });

  const superAdminEmails = superAdmins
    .map((admin) => admin.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  const recipients = Array.from(
    new Set([...parseConfiguredAlertEmails(), ...superAdminEmails])
  );

  if (recipients.length > 0) {
    try {
      await sendNewAccountAlertEmail(recipients, {
        userId: input.userId,
        email: input.email,
        name: input.name,
        role: input.role,
        subscriptionPlan: input.subscriptionPlan,
        source: input.source,
        createdAt: createdAt.toISOString(),
        createdByEmail: input.createdByEmail ?? null,
      });
    } catch (error) {
      console.error('[ACCOUNT_ALERT] Failed to send account alert email:', error);
    }
  }

  const actorId = input.createdById || input.userId;

  try {
    await prisma.adminAction.create({
      data: {
        adminId: actorId,
        action: 'user.account_created',
        resourceType: 'User',
        resourceId: input.userId,
        details: {
          source: input.source,
          account: {
            userId: input.userId,
            email: input.email,
            name: input.name ?? null,
            role: input.role ?? null,
            subscriptionPlan: input.subscriptionPlan ?? null,
            createdByEmail: input.createdByEmail ?? null,
            createdById: input.createdById ?? null,
            createdAt: createdAt.toISOString(),
          },
          notification: {
            emailRecipients: recipients,
          },
        },
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    console.error('[ACCOUNT_ALERT] Failed to persist in-app account alert:', error);
  }
}
