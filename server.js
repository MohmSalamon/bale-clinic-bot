const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// ENV
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// Bale API
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// MongoDB Connect
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected ✓"))
  .catch((err) => console.log("MongoDB Error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
  chatId: String,
  firstName: String,
  username: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

// Send Message Function
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
    console.log("Reply Sent ✓");
  } catch (err) {
    console.log("Send Error:", err.response?.data || err);
  }
}

// Webhook Route
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text;

    console.log("Message Received:", text);

    // Save user
    await User.findOneAndUpdate(
      { chatId },
      {
        chatId,
        firstName: message.chat.first_name || "",
        username: message.chat.username || ""
      },
      { upsert: true }
    );

    // Commands
    if (text === "/start") {
      await sendMessage(chatId, "سلام، ربات کلینیک فعال است ✓");
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Webhook Error:", err);
    res.sendStatus(200);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Bale bot running on port ${PORT} ✓`);
});
