import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/error-handler.js";

// Routes
import businessesRouter from "./routes/businesses.js";
import servicesRouter from "./routes/services.js";
import configurationRouter from "./routes/configuration.js";
import appointmentsRouter from "./routes/appointments.js";
import availabilityRouter from "./routes/availability.js";
import customersRouter from "./routes/customers.js";
import staffRouter from "./routes/staff.js";
import waitlistRouter from "./routes/waitlist.js";
import analyticsRouter from "./routes/analytics.js";
import adminRouter from "./routes/admin.js";
import notificationsRouter from "./routes/notifications.js";
import billingRouter from "./routes/billing.js";
import webhooksRouter from "./routes/webhooks.js";
import internalRouter from "./routes/internal.js";
import googleCalendarRouter from "./routes/google-calendar.js";
import categoriesRouter from "./routes/categories.js";
import plansRouter from "./routes/plans.js";
import { startReminderScheduler } from "./services/notifications.js";
import { startGCalSyncScheduler } from "./services/google-calendar.js";

const app: Express = express();
const port = process.env.PORT || 3001;

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
    // Key by Bearer token so each logged-in user gets their own bucket
    if (auth?.startsWith("Bearer ")) return auth.slice(7, 50);
    return req.ip ?? "unknown";
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", (req, res, next) => {
  if (req.path.startsWith("/internal/")) return next();
  // Authenticated requests get the generous bucket
  if (req.headers.authorization?.startsWith("Bearer ")) return authLimiter(req, res, next);
  return publicLimiter(req, res, next);
});

// Internal routes (scheduler-driven, secret-protected) — mounted before resource routers
app.use("/api/internal", internalRouter);

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

// Admin routes
app.use("/api/admin", adminRouter);

// Public plans
app.use("/api/plans", plansRouter);

// Billing routes
app.use("/api/billing", billingRouter);

// Webhook routes
app.use("/api/webhooks", webhooksRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  if (process.env.ENABLE_INPROCESS_REMINDER_SCHEDULER === "true") {
    startReminderScheduler();
    startGCalSyncScheduler();
  } else {
    console.log("In-process schedulers disabled (set ENABLE_INPROCESS_REMINDER_SCHEDULER=true to enable)");
  }
});

export default app;
