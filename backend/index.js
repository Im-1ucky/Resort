import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import availabilityRoutes from "./src/routes/availability.js";
import bookingRoutes from "./src/routes/bookings.js";
import rateRoutes from "./src/routes/rates.js";
import paymentRoutes from "./src/routes/payments.js";
import roomRoutes from "./src/routes/rooms.js";
import allotmentRoutes from "./src/routes/allotments.js";

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


//Routers

app.use("/api/availability", availabilityRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/rates", rateRoutes);

app.use("/api", paymentRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api/allotments", allotmentRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Resort API is running!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
