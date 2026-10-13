export type ClubTeamFormat = "7v7" | "9v9" | "11v11";
export type ClubTeamGender = "Girls" | "Boys";

export type ClubTeamCatalogEntry = {
  name: string;
  ageGroup: string;
  format: ClubTeamFormat;
  gender: ClubTeamGender;
};

const GIRLS: ClubTeamCatalogEntry[] = [
  { gender: "Girls", format: "11v11", name: "07/08 Girls NPL", ageGroup: "U18" },
  { gender: "Girls", format: "11v11", name: "07/08 Girls White", ageGroup: "U18" },
  { gender: "Girls", format: "11v11", name: "09 Girls Navy", ageGroup: "U18" },
  { gender: "Girls", format: "11v11", name: "2010 Girls NPL", ageGroup: "U17" },
  { gender: "Girls", format: "11v11", name: "2010 Girls White", ageGroup: "U17" },
  { gender: "Girls", format: "11v11", name: "2010 Girls Grey", ageGroup: "U17" },
  { gender: "Girls", format: "11v11", name: "2011 Girls ECRL", ageGroup: "U16" },
  { gender: "Girls", format: "11v11", name: "2011 Girls White", ageGroup: "U16" },
  { gender: "Girls", format: "11v11", name: "2012 Girls NPL", ageGroup: "U15" },
  { gender: "Girls", format: "11v11", name: "2012 Girls White", ageGroup: "U15" },
  { gender: "Girls", format: "11v11", name: "2012 Girls Grey", ageGroup: "U15" },
  { gender: "Girls", format: "11v11", name: "2013 Girls NPL", ageGroup: "U14" },
  { gender: "Girls", format: "11v11", name: "2013 Girls White", ageGroup: "U14" },
  { gender: "Girls", format: "11v11", name: "2013 Girls Grey", ageGroup: "U14" },
  { gender: "Girls", format: "9v9", name: "2014 Girls Pre-NPL", ageGroup: "U13" },
  { gender: "Girls", format: "9v9", name: "2014 Girls White", ageGroup: "U13" },
  { gender: "Girls", format: "9v9", name: "2014 Girls Grey", ageGroup: "U13" },
  { gender: "Girls", format: "9v9", name: "2015 Girls Navy", ageGroup: "U12" },
  { gender: "Girls", format: "9v9", name: "2015 Girls White", ageGroup: "U12" },
  { gender: "Girls", format: "9v9", name: "2015 Girls Grey", ageGroup: "U12" },
  { gender: "Girls", format: "7v7", name: "2016 Girls Navy", ageGroup: "U11" },
  { gender: "Girls", format: "7v7", name: "2016 Girls White", ageGroup: "U11" },
  { gender: "Girls", format: "7v7", name: "2016 Girls Grey", ageGroup: "U11" },
  { gender: "Girls", format: "7v7", name: "2017 Girls Navy", ageGroup: "U10" },
  { gender: "Girls", format: "7v7", name: "2017 Girls White", ageGroup: "U10" },
  { gender: "Girls", format: "7v7", name: "2017 Girls Grey", ageGroup: "U10" },
  { gender: "Girls", format: "7v7", name: "2018 Girls Navy", ageGroup: "U9" },
  { gender: "Girls", format: "7v7", name: "2018 Girls White", ageGroup: "U9" },
  { gender: "Girls", format: "7v7", name: "2019 Girls Navy", ageGroup: "U8" },
];

/** Boys column from the same Rocklin FC competitive coaches table. */
const BOYS: ClubTeamCatalogEntry[] = [
  { gender: "Boys", format: "11v11", name: "07/08 Boys Navy", ageGroup: "U18" },
  { gender: "Boys", format: "11v11", name: "09 Boys Navy", ageGroup: "U18" },
  { gender: "Boys", format: "11v11", name: "2010 Boys Navy", ageGroup: "U17" },
  { gender: "Boys", format: "11v11", name: "2011 Boys Navy", ageGroup: "U16" },
  { gender: "Boys", format: "11v11", name: "2012 Boys Navy", ageGroup: "U15" },
  { gender: "Boys", format: "11v11", name: "2012 Boys White", ageGroup: "U15" },
  { gender: "Boys", format: "11v11", name: "2012 Boys Grey", ageGroup: "U15" },
  { gender: "Boys", format: "11v11", name: "2013 Boys NPL", ageGroup: "U14" },
  { gender: "Boys", format: "11v11", name: "2013 Boys White", ageGroup: "U14" },
  { gender: "Boys", format: "11v11", name: "2013 Boys Grey", ageGroup: "U14" },
  { gender: "Boys", format: "9v9", name: "2014 Boys Navy", ageGroup: "U13" },
  { gender: "Boys", format: "9v9", name: "2014 Boys White", ageGroup: "U13" },
  { gender: "Boys", format: "9v9", name: "2014 Boys Grey", ageGroup: "U13" },
  { gender: "Boys", format: "9v9", name: "2015 Boys Navy", ageGroup: "U12" },
  { gender: "Boys", format: "9v9", name: "2015 Boys White", ageGroup: "U12" },
  { gender: "Boys", format: "9v9", name: "2015 Boys Grey", ageGroup: "U12" },
  { gender: "Boys", format: "7v7", name: "2016 Boys Navy", ageGroup: "U11" },
  { gender: "Boys", format: "7v7", name: "2016 Boys White", ageGroup: "U11" },
  { gender: "Boys", format: "7v7", name: "2016 Boys Grey", ageGroup: "U11" },
  { gender: "Boys", format: "7v7", name: "2017 Boys Navy", ageGroup: "U10" },
  { gender: "Boys", format: "7v7", name: "2017 Boys White", ageGroup: "U10" },
  { gender: "Boys", format: "7v7", name: "2017 Boys Grey", ageGroup: "U10" },
  { gender: "Boys", format: "7v7", name: "2018 Boys Navy", ageGroup: "U9" },
  { gender: "Boys", format: "7v7", name: "2018 Boys White", ageGroup: "U9" },
  { gender: "Boys", format: "7v7", name: "2019 Boys Navy", ageGroup: "U8" },
];

export const ROCKLIN_FC_TEAMS: ClubTeamCatalogEntry[] = [...GIRLS, ...BOYS];

export function catalogNotes(entry: Pick<ClubTeamCatalogEntry, "gender" | "format">): string {
  return `${entry.gender} ${entry.format}`;
}

export function isRocklinClub(club: { name: string; code?: string | null }): boolean {
  const hay = `${club.name} ${club.code || ""}`.toLowerCase();
  return hay.includes("rocklin");
}

export function catalogForClub(club: { name: string; code?: string | null }): ClubTeamCatalogEntry[] {
  if (isRocklinClub(club)) return ROCKLIN_FC_TEAMS;
  return [];
}
