import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    // max: 1 — Vercel serverless functions can spin up as a fresh container per
    // invocation. A pool that defaults to 10 connections per instance exhausts
    // Supabase's connection cap in minutes under any burst of traffic (this bit us
    // during testing: identical failures across unrelated Server Actions, the only
    // thing they share being this pool). One connection per instance is what a
    // stateless serverless function actually needs.
    pool = new Pool({ connectionString, max: 1 });
  }
  return pool;
}
