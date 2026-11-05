import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import availabilityRoutes from "./src/routes/availability.js";
import bookingRoutes from "./src/routes/bookings.js";
import rateRoutes from "./src/routes/rates.js";
import paymentRoutes from "./src/routes/payments.js";
import roomRoutes from "./src/routes/rooms.js";
import allotmentRoutes from "./src/routes/allotments.js";
import blackoutRoutes from "./src/routes/blackouts.js";
import promoRoutes from "./src/routes/promos.js";
import { expirePendingBookings } from "./src/services/bookingExpiry.js";
import cookieParser from "cookie-parser";
import authRoutes from "./src/routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

//Middlewares

app.use(express.json());

app.use(cookieParser());


//Routers

app.use("/api/availability", availabilityRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/rates", rateRoutes);

app.use("/api", paymentRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api/allotments", allotmentRoutes);

app.use("/api/blackouts", blackoutRoutes);

app.use("/api/promos", promoRoutes);

app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Resort API is running!",
  });
});

// Expire pending bookings every 60 seconds.
setInterval(async () => {
  try {
    await expirePendingBookings();
  } catch (error) {
    console.error("Booking expiry job failed:", error);
  }
}, 60_000);

// Run once when the server starts.
expirePendingBookings().catch((error) => {
  console.error("Initial booking expiry failed:", error);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
