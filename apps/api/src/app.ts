import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/error-handler";

// Routes
import businessesRouter from "./routes/businesses";
import servicesRouter from "./routes/services";
import configurationRouter from "./routes/configuration";
import appointmentsRouter from "./routes/appointments";
import availabilityRouter from "./routes/availability";
import customersRouter from "./routes/customers";
import staffRouter from "./routes/staff";
import waitlistRouter from "./routes/waitlist";
import analyticsRouter from "./routes/analytics";
import adminRouter from "./routes/admin";
import notificationsRouter from "./routes/notifications";
import billingRouter from "./routes/billing";
import webhooksRouter from "./routes/webhooks";
import internalRouter from "./routes/internal";
import googleCalendarRouter from "./routes/google-calendar";
import categoriesRouter from "./routes/categories";
import whatsappCredentialsRouter from "./routes/whatsapp-credentials";
import { startReminderScheduler } from "./services/notifications";
import { startGCalSyncScheduler } from "./services/google-calendar";

export type AppOptions = {
  mountInternal?: boolean;
  startSchedulers?: boolean;
};

export function createApp(options: AppOptions = {}): Express {
  const { mountInternal = false, startSchedulers = false } = options;
  const app: Express = express();

  // Global middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN === "*"
      ? true
      : process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",")
        : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
    credentials: true,
  }));
  app.use(express.json());

  // Unauthenticated (public) routes: strict IP-based limit
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 200 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Authenticated dashboard routes: generous per-token limit
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 2000 : 10000,
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) return auth.slice(7, 50);
      return req.ip ?? "unknown";
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", (req, res, next) => {
    if (req.path.startsWith("/internal/")) return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return authLimiter(req, res, next);
    return publicLimiter(req, res, next);
  });

  // Internal routes (scheduler-driven, secret-protected) — only in worker mode
  if (mountInternal) {
    app.use("/api/internal", internalRouter);
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Business routes (public + auth)
  app.use("/api/businesses", businessesRouter);

  // Business-scoped routes
  app.use("/api/businesses/:businessId/services", servicesRouter);
  app.use("/api/businesses/:businessId/categories", categoriesRouter);
  app.use("/api/businesses/:businessId", configurationRouter);
  app.use("/api/businesses/:businessId/appointments", appointmentsRouter);
  app.use("/api/businesses/:businessId/availability", availabilityRouter);
  app.use("/api/businesses/:businessId/customers", customersRouter);
  app.use("/api/businesses/:businessId/staff", staffRouter);
  app.use("/api/businesses/:businessId/waitlist", waitlistRouter);
  app.use("/api/businesses/:businessId/analytics", analyticsRouter);
  app.use("/api/businesses/:businessId/notifications", notificationsRouter);
  app.use("/api/businesses/:businessId/google-calendar", googleCalendarRouter);
  app.use("/api/businesses/:businessId/whatsapp", whatsappCredentialsRouter);

  // Admin routes
  app.use("/api/admin", adminRouter);

  // Billing routes
  app.use("/api/billing", billingRouter);

  // Webhook routes
  app.use("/api/webhooks", webhooksRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  if (startSchedulers) {
    startReminderScheduler();
    startGCalSyncScheduler();
  }

  return app;
}
