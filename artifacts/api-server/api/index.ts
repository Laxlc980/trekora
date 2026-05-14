/**
 * Vercel serverless entry point.
 * 
 * This file is self-contained — it does NOT import from ../src
 * because @vercel/node only compiles this single file.
 * All dependencies are resolved from node_modules.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({ credentials: true, origin: process.env["ALLOWED_ORIGIN"] ?? "*" }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Placeholder — full routes require the esbuild bundle approach
app.use((_req, res) => {
  res.status(503).json({
    error: "API server is not fully configured for serverless deployment yet.",
    hint: "Set up environment variables and redeploy.",
  });
});

export default app;
