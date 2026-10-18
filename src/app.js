import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middleware/errorHandler.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDirectory = path.resolve(currentDirectory, "../client/dist");

function createApp() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required.");
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(clientDistDirectory));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use("/api/auth", authRoutes);
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Route not found." });
  });
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDistDirectory, "index.html"), (error) => {
      if (error && !response.headersSent) {
        response.status(404).json({ error: "Frontend build not found. Run npm run build." });
      }
    });
  });
  app.use(errorHandler);

  return app;
}

export default createApp;
