import express from "express";
import cors from "cors";

import routes from "./routes";
import modelsRoute from "./models-route";
import dbRoutes from "./db-routes";
import drillRoutes from "./routes-drill";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Mount all API routes
app.use(routes);
app.use(modelsRoute);
app.use(dbRoutes);
app.use(drillRoutes);

export default app;
