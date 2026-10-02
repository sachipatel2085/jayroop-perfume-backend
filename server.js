import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
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

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/local
    },
    credentials: true,
  }),
);

// Express body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize MongoDB operators (prevent NoSQL injection)
app.use(mongoSanitize());

// Logger in development
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Global API rate limiter
app.use("/api", apiLimiter);

// Health Check Endpoint
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Jayroop (JR) Luxury Fragrance & Cosmetics API",
    version: "1.0.0",
  });
});

// Mount Versioned Routes (/api/v1/...)
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
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Jayroop Perfume API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `[Jayroop Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  );
});
