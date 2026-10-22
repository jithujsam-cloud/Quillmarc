// Who is reading, and who has gone quiet. Pure: no clock, no database.
//
// Only an investor who has read the update page counts as reading. Email opens are not used, because
// mail apps open messages by themselves. An update only counts as missed once it has had a few days.

export const QUIET_AFTER_MISSED = 2;
export const GRACE_DAYS = 3;
const DAY = 86_400_000;

export interface InvestorSend {
  updateId: string;
  /** When the update went out. */
  sentAt: string;
  /** The email was handed to the provider. */
  delivered: boolean;
  /** The investor opened the update page. */
  readAt: string | null;
}

export interface Activity {
  /** Updates sent to this investor. */
  received: number;
  /** Of those, how many they read. */
  read: number;
  lastReadAt: string | null;
  /** The newest updates in a row that they have not read, not counting ones still within the grace days. */
  missedInARow: number;
  /** Not read the last two updates they could have read. */
  quiet: boolean;
}

export function activityFor(sends: InvestorSend[], now: Date = new Date()): Activity {
  const got = sends.filter((s) => s.delivered).sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));
  const readTimes = got.map((s) => s.readAt).filter((t): t is string => Boolean(t));
  let missed = 0;
  for (const s of got) {
    if (now.getTime() - new Date(s.sentAt).getTime() < GRACE_DAYS * DAY) continue; // too soon to say
    if (s.readAt) break;
    missed += 1;
  }
  return {
    received: got.length,
    read: got.filter((s) => s.readAt).length,
    lastReadAt: readTimes.length ? readTimes.reduce((a, b) => (a > b ? a : b)) : null,
    missedInARow: missed,
    quiet: missed >= QUIET_AFTER_MISSED,
  };
}

export const quietLine = (name: string, missed: number) => `${name} has not read your last ${missed === QUIET_AFTER_MISSED ? "2" : missed} updates.`;
