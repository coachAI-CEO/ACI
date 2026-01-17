import express from "express";
import cors from "cors";

import routes from "./routes";
import modelsRoute from "./models-route";
import dbRoutes from "./db-routes";

import drillRoutes from "./routes-drill";
import sessionRoutes from "./routes-session";
import coachRoutes from "./routes-coach";
import fixerRoutes from "./routes-fixer";
import vaultRoutes from "./routes-vault";
import skillFocusRoutes from "./routes-skill-focus";
import adminRoutes from "./routes-admin";

const app = express();

app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: "10mb" }));

// Order matters!
app.use(routes);
app.use(modelsRoute);
app.use(dbRoutes);
app.use(drillRoutes);
app.use(sessionRoutes);
app.use(fixerRoutes);
app.use(coachRoutes);  // ✅ FIXER ROUTES ARE ACTUALLY MOUNTED HERE
app.use(vaultRoutes);  // Vault system routes
app.use(skillFocusRoutes); // Skill focus routes
app.use(adminRoutes); // Admin dashboard routes

export default app;
