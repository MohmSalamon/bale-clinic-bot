const axios = require("axios");
const User = require("../models/User");
const Request = require("../models/Request");

// ساخت آدرس API با استفاده از TOKEN از Railway Variables
const API = `https://tapi.bale.ai/bot${process.env.TOKEN}`;

// تابع ارسال پیام به بله
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
    console.log("Reply Sent ✓");
  } catch (err) {
    console.log("Send Error:", err.response?.data || err);
  }
}

// تابع پردازش پیام‌های دریافتی
exports.handleMessage = async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;

    console.log("Message Received:", text);

    // ذخیره یا بروزرسانی کاربر
    await User.findOneAndUpdate(
      { chatId },
      {
        chatId,
        firstName: msg.chat.first_name || "",
        username: msg.chat.username || ""
      },
      { upsert: true }
    );

    // ذخیره پیام در دیتابیس
    await Request.create({ chatId, message: text });

    // پاسخ به دستورات
    if (text === "/start") {
      await sendMessage(chatId, "سلام محمد عزیز 🌹 ربات کلینیک فعال است ✓");
    } else if (text === "/help") {
      await sendMessage(chatId, "📌 راهنما:\n/start → شروع\n/help → راهنما\nثبت نوبت → رزرو وقت");
    } else if (text.includes("ثبت نوبت")) {
      await sendMessage(chatId, "✅ درخواست نوبت شما ثبت شد. لطفاً تاریخ و ساعت را وارد کنید.");
    } else {
      await sendMessage(chatId, "پیام شما دریافت شد: " + text);
    }
  } catch (err) {
    console.log("Controller Error:", err);
  }
};
