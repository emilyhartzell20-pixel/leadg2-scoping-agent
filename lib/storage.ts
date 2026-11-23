import "server-only";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import type { Proposal, ProposalListItem, ScopingSession } from "./types";
import { allTotals } from "./pricing";
import { formatK } from "./types";

/**
 * Persistence layer.
 * - Production (Vercel): Upstash Redis via KV_REST_API_URL / KV_REST_API_TOKEN
 *   (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
 * - Otherwise: JSON files under DATA_DIR (a Render persistent disk) or ./.data locally
 */

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const INDEX_KEY = "proposals:index";

export const storageMode = redis ? "redis" : "file";

/* ---------------- file fallback ---------------- */
// On Render, point DATA_DIR at the persistent disk mount (e.g. /var/data) so proposals survive deploys.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");

async function fileGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${key.replace(/[:/]/g, "_")}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
async function fileSet(key: string, value: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${key.replace(/[:/]/g, "_")}.json`), JSON.stringify(value, null, 2));
}

async function kvGet<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  return fileGet<T>(key);
}
async function kvSet(key: string, value: unknown, ttl?: number) {
  if (redis) {
    if (ttl) await redis.set(key, value, { ex: ttl });
    else await redis.set(key, value);
    return;
  }
  await fileSet(key, value);
}

/* ---------------- sessions ---------------- */
export const getSession = (id: string) => kvGet<ScopingSession>(`session:${id}`);
export const saveSession = (s: ScopingSession) => kvSet(`session:${s.id}`, s, SESSION_TTL);

/* ---------------- proposals ---------------- */
export const getProposal = (id: string) => kvGet<Proposal>(`proposal:${id}`);

export async function saveProposal(p: Proposal) {
  await kvSet(`proposal:${p.id}`, p);
  const item: ProposalListItem = {
    id: p.id,
    createdAt: p.createdAt,
    clientName: p.clientName,
    engagementType: p.content.engagement_type,
    totalLabel: (() => {
      const t = allTotals(p.scope).map((x) => x.total);
      const lo = Math.min(...t), hi = Math.max(...t);
      return lo === hi ? formatK(lo) : `${formatK(lo)}–${formatK(hi)}`;
    })(),
  };
  if (redis) {
    await redis.zadd(INDEX_KEY, { score: Date.parse(p.createdAt), member: JSON.stringify(item) });
  } else {
    const list = (await fileGet<ProposalListItem[]>(INDEX_KEY)) ?? [];
    await fileSet(INDEX_KEY, [item, ...list.filter((i) => i.id !== p.id)]);
  }
}

export async function listProposals(limit = 100): Promise<ProposalListItem[]> {
  if (redis) {
    const rows = await redis.zrange<(string | ProposalListItem)[]>(INDEX_KEY, 0, limit - 1, { rev: true });
    // Upstash auto-deserializes JSON members; handle both shapes.
    return rows.map((r) => (typeof r === "string" ? (JSON.parse(r) as ProposalListItem) : r));
  }
  const list = (await fileGet<ProposalListItem[]>(INDEX_KEY)) ?? [];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
