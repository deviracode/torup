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
import { startReminderScheduler } from "./services/notifications.js";

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", (req, res, next) => {
  if (req.path.startsWith("/internal/")) return next();
  return limiter(req, res, next);
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
app.use("/api/businesses/:businessId", configurationRouter);
app.use("/api/businesses/:businessId/appointments", appointmentsRouter);
app.use("/api/businesses/:businessId/availability", availabilityRouter);
app.use("/api/businesses/:businessId/customers", customersRouter);
app.use("/api/businesses/:businessId/staff", staffRouter);
app.use("/api/businesses/:businessId/waitlist", waitlistRouter);
app.use("/api/businesses/:businessId/analytics", analyticsRouter);
app.use("/api/businesses/:businessId/notifications", notificationsRouter);

// Admin routes
app.use("/api/admin", adminRouter);

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
  } else {
    console.log("In-process reminder scheduler disabled (set ENABLE_INPROCESS_REMINDER_SCHEDULER=true to enable)");
  }
});

export default app;
