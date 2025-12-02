// require("dotenv").config();
// const express = require("express");
// const { MongoClient } = require("mongodb");
// const cors = require("cors");

// const app = express();
// const port = 3000;

// app.use(express.json());
// app.use(cors());

// const client = new MongoClient(process.env.MONGODB_URI);

// app.get("/", (req, res) => {
//   res.send("Hello monu!");
// });

// async function run() {
//   try {
//     // Connect to MongoDB
//     await client.connect();
//     console.log("Connected to MongoDB");

//     // Define collection AFTER connection
//     const userCollection = client.db("shop-top").collection("users");

//     // Routes
//     app.post("/user", async (req, res) => {
//       const user = req.body;
//       const result = await userCollection.insertOne(user);
//       res.send(result);
//     });

//   } catch (error) {
//     console.log("MongoDB Error:", error);
//   }
// }

// run().catch(console.dir);

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });
