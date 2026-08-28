import { getScopedGameModelOptions, type CurrentUser } from '@aci/shared';

/** Single club/game-model lock for UI (hide model filter/label when only one applies). */
export function resolveLockedGameModelId(user?: CurrentUser | null): string | null {
  if (!user) return null;
  if (user.enforcedGameModelId) return String(user.enforcedGameModelId);

  const membershipModels = [
    ...new Set(
      (user.clubMemberships || [])
        .map((m) => m.gameModelId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  if (membershipModels.length === 1) return membershipModels[0];

  if (user.clubId && user.boardStamp?.gameModelId) {
    return String(user.boardStamp.gameModelId);
  }

  return null;
}

export function shouldShowGameModelInVault(user?: CurrentUser | null): boolean {
  const locked = resolveLockedGameModelId(user);
  return getScopedGameModelOptions(locked).length > 1;
}
