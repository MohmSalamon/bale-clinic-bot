const express = require("express");
const router = express.Router();
const { handleMessage } = require("../controllers/baleController");

router.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (message) await handleMessage(message);
    res.sendStatus(200);
  } catch (err) {
    console.log("Webhook Error:", err);
    res.sendStatus(200);
  }
});

module.exports = router;
