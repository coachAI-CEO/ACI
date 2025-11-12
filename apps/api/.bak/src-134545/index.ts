import express from "express";
import dotenv from "dotenv";
import routes from "./routes";
import modelsRoute from "./models-route";
import dbRoutes from "./db-routes";
import fixRoutes from "./routes-fixer";
import drillRoutes from "./routes-drill";

dotenv.config({ path: "../../.env" });

const app = express();
app.use(express.json());

app.use(routes);
app.use(modelsRoute);
app.use(dbRoutes);
app.use(fixRoutes);
app.use(drillRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "aci-api" }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ACI API listening on :${port}`));
