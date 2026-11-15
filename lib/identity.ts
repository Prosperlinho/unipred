/**
 * Bank account names come back from banks in many orders and spellings
 * ("ADEBAYO JOHN OLUWASEUN" vs "John Adebayo"). Two names match when they share
 * at least two real name parts (titles and initials ignored).
 */
const IGNORED = new Set(["MR", "MRS", "MS", "MISS", "DR", "PROF", "CHIEF", "ENGR", "PASTOR", "ALHAJI", "ALHAJA", "MALLAM"]);

export function nameTokens(name: string): string[] {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !IGNORED.has(t));
}

export function namesMatch(profileName: string, accountName: string): boolean {
  const mine = new Set(nameTokens(profileName));
  const theirs = new Set(nameTokens(accountName));
  if (mine.size < 2 || theirs.size < 1) return false;
  let common = 0;
  for (const t of mine) if (theirs.has(t)) common++;
  return common >= 2;
}

/** Full name required at sign-up: at least first and last name. */
export function isValidFullName(name: string): boolean {
  return nameTokens(name).length >= 2 && name.trim().length <= 80;
}
