require("dotenv").config();

const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

try {
  app.listen(process.env.PORT, () => {
    console.log("Connected to the server on port", process.env.PORT);
  });
} catch (e) {
  console.log(e);
}
