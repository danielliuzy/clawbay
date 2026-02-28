require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.listen(PORT, () => {
  console.log(`ClawBay server running on http://localhost:${PORT}`);
});
