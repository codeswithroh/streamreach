// Locale-independent date formatting, identical on server and client (avoids hydration mismatches).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parts = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
};

/** "23 Sep" */
export const dayMonth = (iso: string) => {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
};

/** "23 Sep 2026" */
export const dayMonthYear = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "Wed" */
export const weekday = (iso: string) => {
  const { y, m, d } = parts(iso);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

/** "29 Sep, 21:00" from a local timestamp like "2026-09-29T21:00" */
export const dayMonthTime = (iso: string) => `${dayMonth(iso)}, ${iso.slice(11, 16)}`;
