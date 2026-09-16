// ✔ dotenv باید اولین خط باشد
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const jalaali = require("jalaali-js");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✔ برای دریافت فرم admin.html

// ✔ ENV — حالا مقدارها درست خوانده می‌شوند
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
  name: String,
  family: String,
  doctor: String,
  phone: String,
  date: String,
  time: String,
  step: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

// Validate Jalali Date
function isValidJalali(date) {
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("/").map(Number);
  const g = jalaali.toGregorian(y, m, d);
  return g.gy > 0;
}

// Send Message
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (err) {
    console.log("Send Error:", err.response?.data || err);
  }
}

/* ---------------------------------------------------
   ✔ بخش جدید: ثبت نوبت از طریق admin.html
--------------------------------------------------- */
app.post("/add", async (req, res) => {
  try {
    const { name, family, doctor, phone, date, time } = req.body;

    // ✔ پیدا کردن یا ساختن کاربر
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        name,
        family,
        doctor,
        phone,
        date,
        time,
        step: 0
      });
    } else {
      user.name = name;
      user.family = family;
      user.doctor = doctor;
      user.date = date;
      user.time = time;
      await user.save();
    }

    return res.send(`
      <script>
        alert("نوبت با موفقیت ثبت شد ✓");
        window.location.href = "/dashboard";
      </script>
    `);

  } catch (err) {
    console.log("Admin Add Error:", err);
    return res.send(`
      <script>
        alert("خطا در ثبت نوبت ❌");
        window.location.href = "/dashboard";
      </script>
    `);
  }
});

/* ---------------------------------------------------
   ✔ Webhook ربات بله (بدون تغییر)
--------------------------------------------------- */
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;

    // ✔ اصلاح کامل دریافت متن
    const text = (message.text || message.body || "").trim().toLowerCase();

    console.log("Message Received:", text);

    let user = await User.findOne({ chatId });
    if (!user) user = await User.create({ chatId });

    // Commands
    if (text === "/start") {
      user.step = 0;
      await user.save();
      await sendMessage(chatId, "سلام، برای ثبت نوبت دستور register را ارسال کنید.");
      return res.sendStatus(200);
    }

    if (text === "register") {
      user.step = 1;
      await user.save();
      await sendMessage(chatId, "نام خود را وارد کنید:");
      return res.sendStatus(200);
    }

    // Step 1 → Name
    if (user.step === 1) {
      user.name = text;
      user.step = 2;
      await user.save();
      await sendMessage(chatId, "نام‌خانوادگی خود را وارد کنید:");
      return res.sendStatus(200);
    }

    // Step 2 → Family
    if (user.step === 2) {
      user.family = text;
      user.step = 3;
      await user.save();
      await sendMessage(chatId, "نام درمانگر را وارد کنید:");
      return res.sendStatus(200);
    }

    // Step 3 → Doctor
    if (user.step === 3) {
      user.doctor = text;
      user.step = 4;
      await user.save();
      await sendMessage(chatId, "شماره موبایل را وارد کنید:");
      return res.sendStatus(200);
    }

    // Step 4 → Phone
    if (user.step === 4) {
      user.phone = text;
      user.step = 5;
      await user.save();
      await sendMessage(chatId, "لطفاً تاریخ شمسی را وارد کنید (مثال: 1403/07/15)");
      return res.sendStatus(200);
    }

    // Step 5 → Jalali Date
    if (user.step === 5) {
      if (!isValidJalali(text)) {
        await sendMessage(chatId, "❌ تاریخ اشتباه است.\nفرمت صحیح: 1403/07/15");
        return res.sendStatus(200);
      }

      user.date = text;
      user.step = 6;
      await user.save();

      await sendMessage(
        chatId,
        "لطفاً ساعت مورد نظر را انتخاب کنید:\n" +
        "ساعت‌های صبح:\n" +
        "1) 09:00\n" +
        "2) 10:00\n" +
        "3) 11:00\n" +
        "4) 12:00\n" +
        "5) 13:00\n\n" +
        "ساعت‌های عصر:\n" +
        "6) 16:00\n" +
        "7) 17:00\n" +
        "8) 18:00\n" +
        "9) 19:00"
      );
      return res.sendStatus(200);
    }

    // Step 6 → Time
    if (user.step === 6) {
      const times = {
        "1": "09:00",
        "2": "10:00",
        "3": "11:00",
        "4": "12:00",
        "5": "13:00",
        "6": "16:00",
        "7": "17:00",
        "8": "18:00",
        "9": "19:00"
      };

      if (!times[text]) {
        await sendMessage(chatId, "❌ گزینه اشتباه است.\nفقط عدد 1 تا 9 را وارد کنید.");
        return res.sendStatus(200);
      }

      user.time = times[text];
      user.step = 0;
      await user.save();

      await sendMessage(
        chatId,
        `نوبت شما ثبت شد ✓
👤 نام: ${user.name} ${user.family}
🧑‍⚕️ درمانگر: ${user.doctor}
📞 شماره: ${user.phone}
📅 تاریخ: ${user.date}
⏰ ساعت: ${user.time}
🆔 چت‌آیدی: ${user.chatId}`
      );

      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Webhook Error:", err);
    res.sendStatus(200);
  }
});

/* ---------------------------------------------------
   ✔ Dashboard
--------------------------------------------------- */
app.get("/dashboard", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });

  let html = `
  <html>
  <head>
    <title>Dashboard</title>
    <style>
      body { font-family: sans-serif; direction: rtl; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #444; padding: 8px; text-align: center; }
      th { background: #eee; }
    </style>
  </head>
  <body>
    <h2>داشبورد نوبت‌ها</h2>
    <table>
      <tr>
        <th>نام</th>
        <th>نام‌خانوادگی</th>
        <th>درمانگر</th>
        <th>شماره</th>
        <th>تاریخ</th>
        <th>ساعت</th>
        <th>ChatID</th>
      </tr>
  `;

  users.forEach(u => {
    html += `
      <tr>
        <td>${u.name}</td>
        <td>${u.family}</td>
        <td>${u.doctor}</td>
        <td>${u.phone}</td>
        <td>${u.date}</td>
        <td>${u.time}</td>
        <td>${u.chatId}</td>
      </tr>
    `;
  });

  html += `
    </table>
  </body>
  </html>
  `;

  res.send(html);
});

// Start
app.listen(PORT, () => {
  console.log(`Bale bot running on port ${PORT} ✓`);
});
