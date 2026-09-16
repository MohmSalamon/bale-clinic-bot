// server.js

// فقط در حالت لوکال از .env بخوان
if (!process.env.RAILWAY_ENVIRONMENT) {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// متغیرها از env (Railway Variables)
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// چک اولیه روی env
if (!TOKEN) {
  console.log("❌ TOKEN تعریف نشده است (env خالی است)");
}
if (!MONGO_URI) {
  console.log("❌ MONGO_URI تعریف نشده است (env خالی است)");
}

// اتصال به MongoDB با لاگ واضح
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.log("❌ MongoDB Connection Error:");
    console.log(err);
  });

// یک مدل ساده برای تست
const userSchema = new mongoose.Schema({
  chatId: String,
  name: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// آدرس API بله
const BALE_API = "https://tapi.bale.ai/bot" + TOKEN;

// تابع ارسال پیام به بله
async function sendMessage(chatId, text) {
  try {
    await axios.post(BALE_API + "/sendMessage", {
      chat_id: chatId,
      text: text,
    });
  } catch (err) {
    console.log("❌ Error sending message to Bale:");
    console.log(err.response?.data || err.message);
  }
}

// وبهوک اصلی بله
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    if (!update || !update.message) {
      return res.sendStatus(200);
    }

    const msg = update.message;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    console.log("📩 New message:", text, "from", chatId);

    if (!chatId || !text) {
      return res.sendStatus(200);
    }

    // دستور /start
    if (text === "/start") {
      await sendMessage(
        chatId,
        "سلام، برای ثبت نوبت دستور register را ارسال کنید."
      );
      return res.sendStatus(200);
    }

    // دستور register
    if (text.toLowerCase() === "register") {
      // فقط یک تست ساده روی دیتابیس
      const user = new User({ chatId });
      await user.save();

      await sendMessage(chatId, "ثبت اولیه انجام شد ✅");
      return res.sendStatus(200);
    }

    // سایر پیام‌ها
    await sendMessage(chatId, "دستور نامعتبر است. /start را ارسال کنید.");
    return res.sendStatus(200);
  } catch (err) {
    console.log("❌ Error in /webhook handler:");
    console.log(err);
    return res.sendStatus(500);
  }
});

// روت ساده برای تست
app.get("/", (req, res) => {
  res.send("Bale clinic bot is running.");
});

// اجرای سرور
app.listen(PORT, () => {
  console.log(`🚀 Bale bot running on port ${PORT}`);
});
