require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// Import routers
const userRouter = require('./router/userRouter');

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

// Connect to MongoDB using Mongoose
mongoose.connect(uri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    console.error("Failed to connect to MongoDB. Please check your connection string and credentials.");
    process.exit(1);
  });

// Routes
app.get("/", (req, res) => {
  res.send("ShopGenius API Server is running!");
});

// Use routers

app.use('/users', userRouter);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing MongoDB connection...");
  await mongoose.connection.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});