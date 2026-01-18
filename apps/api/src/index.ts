import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`ACI API listening on 0.0.0.0:${PORT}`);
  console.log("Server is running, event loop active");
  
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

// Set server timeout to 3 minutes (180s) to handle slow LLM responses
server.timeout = 180000;

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
