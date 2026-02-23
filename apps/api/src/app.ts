import express from "express";
import cors from "cors";

import routes from "./routes";
import modelsRoute from "./models-route";
import dbRoutes from "./db-routes";

import authRoutes from "./routes-auth";
import drillRoutes from "./routes-drill";
import sessionRoutes from "./routes-session";
import coachRoutes from "./routes-coach";
import fixerRoutes from "./routes-fixer";
import vaultRoutes from "./routes-vault";
import skillFocusRoutes from "./routes-skill-focus";
import adminRoutes from "./routes-admin";
import favoritesRoutes from "./routes-favorites";
import playerPlanRoutes from "./routes-player-plan";
import calendarRoutes from "./routes-calendar";
import organizationRoutes from "./routes-organization";
import billingRoutes from "./routes-billing";
import videoAnalysisRoutes from "./routes-video-analysis";

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : null;

// Request logging middleware
app.use((req, res, next) => {
  // Log favorites requests specifically to debug routing issues
  if (req.path.includes('favorites')) {
    console.log(`[REQUEST] ${req.method} ${req.path} - FAVORITES REQUEST`, {
      query: req.query,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

app.use(cors({
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      if (req.originalUrl?.startsWith("/billing/stripe/webhook")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);

// Order matters!
app.use(routes);
app.use(modelsRoute);
app.use(dbRoutes);
app.use(authRoutes); // Authentication routes (register, login, etc.)
app.use(drillRoutes);
app.use(sessionRoutes);
app.use(fixerRoutes);
app.use(coachRoutes);  // ✅ FIXER ROUTES ARE ACTUALLY MOUNTED HERE
app.use(vaultRoutes);  // Vault system routes
app.use(skillFocusRoutes); // Skill focus routes
app.use(calendarRoutes); // Calendar routes (BEFORE admin routes to avoid conflicts)
app.use(favoritesRoutes); // Favorites routes (BEFORE admin routes to avoid conflicts)
app.use(billingRoutes); // Stripe checkout, portal, and webhook routes
app.use(adminRoutes); // Admin dashboard routes
app.use(playerPlanRoutes); // Player plan routes
app.use(organizationRoutes); // Organization management routes (CLUB accounts)
app.use(videoAnalysisRoutes); // Video analysis routes

export default app;
