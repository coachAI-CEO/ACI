import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env from the nearest app-specific .env first, then repo-root fallback.
const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

const seen = new Set<string>();
for (const envPath of candidateEnvFiles) {
  if (seen.has(envPath)) continue;
  seen.add(envPath);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath });
}
