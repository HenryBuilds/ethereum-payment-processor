import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { env } from "./env";
import logger from "./logger";

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Health endpoint is public
  if (req.path === "/health") {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ error: "Missing API key. Provide X-API-Key header." });
    return;
  }

  if (apiKey !== env.API_KEY) {
    logger.warn("Invalid API key attempt", { ip: req.ip });
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
};

export const demoGuard = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.DEMO_MODE) {
    next();
    return;
  }

  if (req.method === "GET") {
    next();
    return;
  }

  res.status(403).json({
    error: "This action is disabled in demo mode. Clone the repository to run your own instance: https://github.com/HenryBuilds/ethereum-payment-processor",
  });
};

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  handler: (req, res, next, options) => {
    logger.warn("Rate limit exceeded", { ip: req.ip });
    res.status(429).json(options.message);
  },
});
