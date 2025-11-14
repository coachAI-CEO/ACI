import express from "express";
import cors from "cors";

import routes from "./routes";
import modelsRoute from "./models-route";
import dbRoutes from "./db-routes";
import drillRoutes from "./routes-drill";
import fixerRoutes from "./routes-fixer";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Order matters!
app.use(routes);
app.use(modelsRoute);
app.use(dbRoutes);
app.use(drillRoutes);
app.use(fixerRoutes);  // ✅ FIXER ROUTES ARE ACTUALLY MOUNTED HERE

export default app;
