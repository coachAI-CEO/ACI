import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = app.listen(PORT, () => console.log(`ACI API listening on :${PORT}`));

// Set server timeout to 3 minutes (180s) to handle slow LLM responses
// Generation: 45s + QA: 30s = 75s, plus retries/overhead can reach ~120s
server.timeout = 180000; // 3 minutes in milliseconds
