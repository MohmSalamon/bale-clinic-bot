// ✔ dotenv باید اولین خط باشد
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ENV
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// Bale API
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Load doctors list from JSON file
const doctors = JSON.parse(fs.readFileSync("doctors.json", "utf8")).doctors;

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
   ✔ Webhook ربات بله
--------------------------------------------------- */
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;
    const callback = req.body.callback_query;

    /* ---------------------------------------------------
       ✔ دریافت دکمه‌های تقویم آبشاری + درمانگر
    --------------------------------------------------- */
    if (callback) {
      const data = callback.data;
      const chatId = callback.message.chat.id;

      let user = await User.findOne({ chatId });

      /* ✔ انتخاب درمانگر */
      if (data.startsWith("doctor_")) {
        const doctorName = data.replace("doctor_", "");
        user.doctor = doctorName;
        user.step = 4;
        await user.save();

        await sendMessage(chatId, "شماره موبایل را وارد کنید:");
        return res.sendStatus(200);
      }

      /* ✔ انتخاب سال */
      if (data.startsWith("year_")) {
        const year = data.replace("year_", "");
        user.date = year;
        user.step = 51;
        await user.save();

        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "ماه را انتخاب کنید:",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "01", callback_data: "month_01" },
                { text: "02", callback_data: "month_02" },
                { text: "03", callback_data: "month_03" },
                { text: "04", callback_data: "month_04" },
                { text: "05", callback_data: "month_05" },
                { text: "06", callback_data: "month_06" }
              ],
              [
                { text: "07", callback_data: "month_07" },
                { text: "08", callback_data: "month_08" },
                { text: "09", callback_data: "month_09" },
                { text: "10", callback_data: "month_10" },
                { text: "11", callback_data: "month_11" },
                { text: "12", callback_data: "month_12" }
              ]
            ]
          }
        });

        return res.sendStatus(200);
      }

      /* ✔ انتخاب ماه */
      if (data.startsWith("month_")) {
        const month = data.replace("month_", "");
        user.date = `${user.date}/${month}`;
        user.step = 52;
        await user.save();

        const days = [];
        for (let i = 1; i <= 31; i++) {
          days.push({
            text: i.toString().padStart(2, "0"),
            callback_data: `day_${i.toString().padStart(2, "0")}`
          });
        }

        // ✔ تقویم ۷ ستونه
        const rows = [];
        while (days.length) rows.push(days.splice(0, 7));

        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "روز را انتخاب کنید:",
          reply_markup: { inline_keyboard: rows }
        });

        return res.sendStatus(200);
      }

      /* ✔ انتخاب روز */
      if (data.startsWith("day_")) {
        const day = data.replace("day_", "");
        user.date = `${user.date}/${day}`;
        user.step = 6;
        await user.save();

        // ✔ ساعت‌ها خوانا (۲ ردیف صبح + ۱ ردیف عصر)
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "ساعت را انتخاب کنید:",
          reply_markup: {
            inline_keyboard: [
              // صبح
              [
                { text: "09:00", callback_data: "time_09:00" },
                { text: "10:00", callback_data: "time_10:00" },
                { text: "11:00", callback_data: "time_11:00" }
              ],
              [
                { text: "12:00", callback_data: "time_12:00" },
                { text: "13:00", callback_data: "time_13:00" }
              ],

              // عصر
              [
                { text: "16:00", callback_data: "time_16:00" },
                { text: "17:00", callback_data: "time_17:00" },
                { text: "18:00", callback_data: "time_18:00" },
                { text: "19:00", callback_data: "time_19:00" }
              ]
            ]
          }
        });

        return res.sendStatus(200);
      }

      /* ✔ انتخاب ساعت */
      if (data.startsWith("time_")) {
        const selectedTime = data.replace("time_", "");

        user.time = selectedTime;
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

      return res.sendStatus(200);
    }

    /* ---------------------------------------------------
       ✔ پیام‌های معمولی
    --------------------------------------------------- */
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = (message.text || "").trim().toLowerCase();

    let user = await User.findOne({ chatId });
    if (!user) user = await User.create({ chatId });

    // ✔ انواع start
    if (["/start", "start", "شروع"].includes(text)) {
      user.step = 0;
      await user.save();
      await sendMessage(chatId, "سلام، برای ثبت نوبت دستور register را ارسال کنید.");
      return res.sendStatus(200);
    }

    // ✔ انواع register
    if (["register", "reg", "ثبت", "ثبت‌نام"].includes(text)) {
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

      // ✔ نمایش درمانگران از فایل JSON
      let keyboard = doctors.map(d => [{ text: d, callback_data: `doctor_${d}` }]);

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "درمانگر را انتخاب کنید:",
        reply_markup: { inline_keyboard: keyboard }
      });

      return res.sendStatus(200);
    }

    // Step 4 → Phone
    if (user.step === 4) {
      user.phone = text;
      user.step = 5;
      await user.save();

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "سال را انتخاب کنید:",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "1405", callback_data: "year_1405" },
              { text: "1406", callback_data: "year_1406" },
              { text: "1407", callback_data: "year_1407" }
            ]
          ]
        }
      });

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

  let rows = "";

  users.forEach(u => {
    rows += `
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

  const html = fs.readFileSync("admin.html", "utf8").replace("{{DATA}}", rows);

  res.send(html);
});
  

// Start
app.listen(PORT, () => {
  console.log(`Bale bot running on port ${PORT} ✓`);
});
