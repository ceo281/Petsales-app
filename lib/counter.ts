import { promises as fs } from "fs";
import path from "path";

/**
 * Running total of completed scam checks.
 *
 * On Replit the count lives in Replit Database (REPLIT_DB_URL is provided
 * automatically). Locally it falls back to a JSON file in .data/.
 * Read-then-write is not atomic, so two checks finishing in the same instant
 * can occasionally count as one. That is acceptable for a public counter.
 * The count starts at zero and only ever reflects real checks.
 */
const KEY = "scam_checks_total";
const FILE = path.join(process.cwd(), ".data", "counter.json");

async function readDb(): Promise<number> {
  const url = process.env.REPLIT_DB_URL;
  if (url) {
    const res = await fetch(`${url}/${KEY}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (res.status === 404) return 0;
    const n = Number(await res.text());
    return Number.isFinite(n) ? n : 0;
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")).total ?? 0;
  } catch {
    return 0;
  }
}

async function writeDb(total: number) {
  const url = process.env.REPLIT_DB_URL;
  if (url) {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `${encodeURIComponent(KEY)}=${encodeURIComponent(String(total))}`,
      signal: AbortSignal.timeout(3000),
    });
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ total }));
}

export async function getCheckCount(): Promise<number | null> {
  try {
    return await readDb();
  } catch {
    return null; // counter unavailable: the page hides it rather than showing a wrong number
  }
}

export async function recordCheck(): Promise<number | null> {
  try {
    const next = (await readDb()) + 1;
    await writeDb(next);
    return next;
  } catch {
    return null;
  }
}
