import express from "express";

import dotenv from "dotenv";
import cors from "cors";
// const dns = require("dns");

// dns.setServers(["8.8.8.8", "1.1.1.1"]);
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./src/config/db.js";
import { apiLimiter } from "./src/middleware/rateLimiter.js";
import { notFound, errorHandler } from "./src/middleware/errorMiddleware.js";

// Route imports
import authRoutes from "./src/routes/authRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import couponRoutes from "./src/routes/couponRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import blogRoutes from "./src/routes/blogRoutes.js";
import advertisementRoutes from "./src/routes/advertisementRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import influencerRoutes from "./src/routes/influencerRoutes.js";
import settingRoutes from "./src/routes/settingRoutes.js";
import contactRoutes from "./src/routes/contactRoutes.js";
import seoRoutes from "./src/routes/seoRoutes.js";
import {
  getSitemapXml,
  getRobotsTxt,
  getGoogleMerchantFeed,
} from "./src/controllers/seoController.js";
import { mountSeoSpa } from "./src/seo/seoServer.js";
import { reconcilePendingPayments } from "./src/services/orderLifecycle.js";
import { publicGatewayInfo } from "./src/services/phonepe.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === "production";

// ───────── Fail fast on dangerous production misconfiguration ─────────
if (isProd) {
  const missing = ["JWT_SECRET", "MONGO_URI", "CLIENT_URL"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(
      `[Startup] Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
  if (String(process.env.PHONEPE_MOCK).toLowerCase() === "true") {
    console.warn("[Startup] PHONEPE_MOCK=true is ignored in production.");
  }
}

connectDB();

const app = express();

// Behind Hostinger / Nginx / Cloudflare: needed for correct client IPs (rate limits, audit logs)
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // SPA + PhonePe redirect + Cloudinary media; set CSP at the CDN if required
  }),
);
app.use(compression());

// CORS
const toOrigins = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  ...toOrigins(process.env.CLIENT_URL),
  ...toOrigins(process.env.SITE_URL),
  ...toOrigins(process.env.EXTRA_CORS_ORIGINS),
]);
[...allowedOrigins].forEach((o) => {
  if (o.startsWith("https://") && !o.includes("://www."))
    allowedOrigins.add(o.replace("https://", "https://www."));
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin.replace(/\/+$/, "")))
        return callback(null, true);
      if (isProd) return callback(null, false);
      return callback(null, true);
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(mongoSanitize());

if (!isProd) app.use(morgan("dev"));

app.use("/api", apiLimiter);

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Jayrup Commerce API",
    version: "2.0.0",
    paymentGateway: publicGatewayInfo(),
  });
});

// Versioned API
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/blogs", blogRoutes);
app.use("/api/v1/advertisements", advertisementRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/influencers", influencerRoutes);
app.use("/api/v1/settings", settingRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/seo", seoRoutes);
app.use("/api", notFound);

// Search-engine endpoints at the root
app.get("/sitemap.xml", getSitemapXml);
app.get("/robots.txt", getRobotsTxt);
app.get("/google-merchant-feed.xml", getGoogleMerchantFeed);

// Local media fallback
app.use(
  "/uploads",
  express.static(path.join(__dirname, "public/uploads"), { maxAge: "30d" }),
);

app.get("/health", (req, res) =>
  res.status(200).json({ success: true, message: "Server is healthy" }),
);

// Optional: serve the React storefront with server-side SEO tags
if (process.env.FRONTEND_DIST_PATH) {
  mountSeoSpa(app, path.resolve(process.env.FRONTEND_DIST_PATH));
} else {
  app.get("/", (req, res) =>
    res.status(200).json({ success: true, message: "Jayrup API is running" }),
  );
  app.get("/favicon.ico", (req, res) => res.status(204).end());
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `Jayrup server running on port ${PORT} (${isProd ? "production" : "development"})`,
  );
});

// Re-check abandoned PhonePe payments every 10 minutes (webhook safety net)
const reconcileTimer = setInterval(
  () => {
    reconcilePendingPayments().catch((err) =>
      console.warn("[Reconciler]", err.message),
    );
  },
  10 * 60 * 1000,
);
reconcileTimer.unref();
