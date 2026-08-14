export type ClubMembershipLike = {
  role: string;
};

export type DocHubUserLike = {
  adminRole?: string | null;
  clubMemberships?: ClubMembershipLike[] | null;
};

const DOC_HUB_ROLES = new Set(["DOC", "SECTION_DIRECTOR"]);

/** Client-side gate — mirror of API canAccessDocHub. Soft; API still enforces. */
export function canAccessDocHub(user: DocHubUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.adminRole === "SUPER_ADMIN") return true;
  return (user.clubMemberships ?? []).some((m) => DOC_HUB_ROLES.has(m.role));
}

export function readStoredUser(): DocHubUserLike | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw) as DocHubUserLike;
  } catch {
    return null;
  }
}
