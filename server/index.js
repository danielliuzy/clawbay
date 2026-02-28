require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const cors = require("cors");
const listingsRouter = require("./routes/listings");

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/listings", listingsRouter);

app.listen(PORT, () => {
  console.log(`ClawBay server running on http://localhost:${PORT}`);
});
