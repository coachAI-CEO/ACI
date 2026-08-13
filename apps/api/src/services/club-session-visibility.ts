export function sessionVisibleToClub(opts: {
  sessionClubId: string | null | undefined;
  sessionGameModelId: string;
  clubId: string;
  clubGameModelId: string;
}): boolean {
  if (opts.sessionClubId) return opts.sessionClubId === opts.clubId;
  return String(opts.sessionGameModelId) === String(opts.clubGameModelId);
}

/** Prisma where fragment: this club's sessions, plus unstamped legacy rows on the same model. */
export function clubVaultWhere(opts: {
  clubId?: string | null;
  gameModelId?: string | null;
}): Record<string, unknown> {
  if (opts.clubId) {
    return {
      OR: [
        { clubId: opts.clubId },
        {
          clubId: null,
          ...(opts.gameModelId ? { gameModelId: opts.gameModelId } : {}),
        },
      ],
    };
  }
  if (opts.gameModelId) {
    return { gameModelId: opts.gameModelId };
  }
  return {};
}

/** True when a club member may list/open/save this vault row. Admins (empty scope) see all. */
export function sessionInClubVaultScope(
  session: { clubId?: string | null; gameModelId?: string | null },
  scope: { clubId?: string | null; gameModelId?: string | null }
): boolean {
  if (scope.clubId) {
    return sessionVisibleToClub({
      sessionClubId: session.clubId,
      sessionGameModelId: String(session.gameModelId || ""),
      clubId: scope.clubId,
      clubGameModelId: String(scope.gameModelId || ""),
    });
  }
  if (scope.gameModelId) {
    return String(session.gameModelId || "") === String(scope.gameModelId);
  }
  return true;
}
