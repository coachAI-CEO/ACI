import { sessionInClubVaultScope } from "./club-session-visibility";

export function drillDiagramVisible(opts: {
  generatedBy: string | null | undefined;
  savedToVault: boolean;
  gameModelId: string;
  userId: string;
  isAdmin: boolean;
  vaultScope: { clubId?: string | null; gameModelId?: string | null };
}): boolean {
  if (opts.isAdmin) return true;
  if (opts.generatedBy && opts.generatedBy === opts.userId) return true;
  if (!opts.savedToVault) return false;
  return sessionInClubVaultScope(
    { clubId: null, gameModelId: opts.gameModelId },
    opts.vaultScope
  );
}
