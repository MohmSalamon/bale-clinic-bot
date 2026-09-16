// server.js
console.log("🔄 Webhook route updated at 09:00");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(bodyParser.json());

// ENV
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// اتصال به دیتابیس
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// مدل تست
const userSchema = new mongoose.Schema({
  chatId: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);

// API بله
const BALE_API = "https://tapi.bale.ai/bot" + TOKEN;

// تابع ارسال پیام
async function sendMessage(chatId, text) {
  try {
    await axios.post(BALE_API + "/sendMessage", {
      chat_id: chatId,
      text: text
    });
  } catch (err) {
    console.log("❌ Error sending message:", err.response?.data || err.message);
  }
}

// مسیر اصلی وبهوک
app.post("/webhook", async (req, res) => {
  console.log("📩 Webhook received:", JSON.stringify(req.body));

  const update = req.body;

  if (!update.message) {
    return res.sendStatus(200);
  }

  const chatId = update.message.chat.id;
  const text = update.message.text?.trim();

  console.log("📩 Message:", text, "from", chatId);

  if (text === "/start") {
    await sendMessage(chatId, "سلام، برای ثبت نوبت دستور register را ارسال کنید.");
    return res.sendStatus(200);
  }

  if (text === "register") {
    const user = new User({ chatId });
    await user.save();
    await sendMessage(chatId, "ثبت اولیه انجام شد ✅");
    return res.sendStatus(200);
  }

  await sendMessage(chatId, "دستور نامعتبر است.");
  res.sendStatus(200);
});

// تست GET
app.get("/", (req, res) => {
  res.send("Bale clinic bot is running.");
});

// اجرای سرور
app.listen(PORT, () => {
  console.log(`🚀 Bale bot running on port ${PORT}`);
});
