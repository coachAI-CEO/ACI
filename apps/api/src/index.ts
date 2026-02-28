import './config/load-env';
import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = process.env.HOST ?? "127.0.0.1";

console.log("Starting server...");

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`ACI API listening on ${HOST}:${PORT}`);
  console.log("Server is running, event loop active");
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(`[EMAIL] Delivery mode: ${smtpConfigured ? 'SMTP' : 'CONSOLE_ONLY (SMTP not configured)'}`);
  
  // Test database connection
  import("./prisma").then(({ prisma }) => {
    prisma.$connect()
      .then(() => console.log("Database connected"))
      .catch((err) => {
        console.error("Database connection error:", err);
        // Don't exit on DB error, just log it
      });
  }).catch((err) => {
    console.error("Error importing prisma:", err);
  });
  
  // Test that server is actually listening
  console.log("Server address:", server.address());
});

// Allow long-running generation requests to complete without socket timeout drops.
// Progressive series can exceed 3 minutes because each session includes generation + QA.
server.timeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Debug: Log when server closes
server.on('close', () => {
  console.log('Server closed');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Keep the process alive - prevent event loop from draining
const keepAlive = setInterval(() => {
  // This keeps the event loop active
}, 1000);

// Prevent process from exiting
process.on('beforeExit', (code) => {
  console.log('Process beforeExit with code:', code);
});

// Clean up on exit
process.on('exit', () => {
  console.log('Process exiting, clearing interval');
  clearInterval(keepAlive);
});

// Keep process alive and handle signals
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  server.close(() => process.exit(0));
});

process.on('exit', (code) => {
  console.log(`Process exit with code: ${code}`);
});
