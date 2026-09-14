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
  step: { type: Number, default: 0 },
  phone: String,
  date: String,
  createdAt: { type: Date, default: Date.now }
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
    const text = message.text?.trim();

    console.log("Message Received:", text);

    // Load user
    let user = await User.findOne({ chatId });

    // Create user if not exists
    if (!user) {
      user = new User({
        chatId,
        firstName: message.chat.first_name || "",
        username: message.chat.username || "",
        step: 0
      });
      await user.save();
    }

    // Commands
    if (text === "/start") {
      user.step = 0;
      await user.save();
      await sendMessage(chatId, "سلام، ربات کلینیک فعال است ✓\nبرای ثبت نوبت، دستور register را ارسال کنید.");
      return res.sendStatus(200);
    }

    if (text.toLowerCase() === "register") {
      user.step = 1;
      await user.save();
      await sendMessage(chatId, "لطفاً شماره موبایل خود را وارد کنید:");
      return res.sendStatus(200);
    }

    // Steps
    if (user.step === 1) {
      user.phone = text;
      user.step = 2;
      await user.save();
      await sendMessage(chatId, "شماره ثبت شد ✓\nلطفاً تاریخ مورد نظر را وارد کنید (مثال: 1403/07/15)");
      return res.sendStatus(200);
    }

    if (user.step === 2) {
      user.date = text;
      user.step = 0;
      await user.save();
      await sendMessage(chatId, `نوبت شما ثبت شد ✓\n📞 شماره: ${user.phone}\n📅 تاریخ: ${user.date}`);
      return res.sendStatus(200);
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
