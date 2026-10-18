import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import createApp from "./app.js";
import connectDatabase from "./config/database.js";
import initializeChat from "./config/chat.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectEnvPath = path.resolve(currentDirectory, "..", ".env");
const sourceEnvPath = path.resolve(currentDirectory, ".env");
dotenv.config({
  path: fs.existsSync(projectEnvPath) ? projectEnvPath : sourceEnvPath,
});

async function startServer() {
  await connectDatabase();

  const app = createApp();
  const httpServer = app.listen(Number(process.env.PORT) || 3000, () => {
    const port = httpServer.address().port;
    console.log(`API server listening on port ${port}.`);
  });
  const chatServer = initializeChat(httpServer);

  function shutDown() {
    chatServer.close(async () => {
      try {
        await mongoose.disconnect();
      } catch (shutdownError) {
        console.error(
          "Failed to close database connections cleanly.",
          shutdownError,
        );
        process.exitCode = 1;
      }
    });
  }

  process.on("SIGINT", shutDown);
  process.on("SIGTERM", shutDown);
}

startServer().catch((error) => {
  console.error("Failed to start the API server.", error);
  process.exitCode = 1;
});
