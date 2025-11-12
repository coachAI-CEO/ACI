import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function dbHealth() {
  const ext = await pool.query("select extname from pg_extension where extname='vector'");
  const tables = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1");
  return { pgvector: ext.rowCount === 1, tables: tables.rows.map((t:any) => t.table_name) };
}
