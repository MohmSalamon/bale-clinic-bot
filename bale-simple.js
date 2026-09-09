const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// اتصال به دیتابیس
mongoose.connect("mongodb+srv://mohmsalamon5_db_user:vBpj0o5CWCIAgJuW@cluster0.xfpt6tg.mongodb.net/baleclinic");

// مدل درخواست نوبت
const RequestSchema = new mongoose.Schema({
  chatId: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Request = mongoose.model("Request", RequestSchema);

// توکن ربات بله
const TOKEN = "788261285:S4-XyqrNtJRAOR-bTDt8u0bbXu0Z2JYEC2g";
const API = `https://tapi.bale.ai/bot${TOKEN}/sendMessage`;

// دریافت پیام از بله
app.post("/webhook", async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const text = msg.text;

  // ذخیره درخواست
  await Request.create({ chatId, message: text });

  // پاسخ به کاربر
  await axios.post(API, {
    chat_id: chatId,
    text: "درخواست شما ثبت شد ✔"
  });

  res.sendStatus(200);
});

// نسخه HTML برای مشاهده درخواست‌ها
app.get("/requests-html", async (req, res) => {
  try {
    const list = await Request.find().sort({ createdAt: -1 });

    let html = `
      <!DOCTYPE html>
      <html lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>لیست درخواست‌های نوبت بله</title>
        <style>
          body { font-family: sans-serif; direction: rtl; text-align: right; padding: 20px; background: #f5f5f5; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #fff; }
          th, td { border: 1px solid #ccc; padding: 8px; font-size: 14px; }
          th { background: #eee; }
          tr:nth-child(even) { background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>لیست درخواست‌های نوبت بله</h1>
        <table>
          <tr>
            <th>چت آیدی</th>
            <th>متن پیام</th>
            <th>تاریخ ثبت</th>
          </tr>
    `;

    for (const r of list) {
      html += `
        <tr>
          <td>${r.chatId}</td>
          <td>${r.message}</td>
          <td>${r.createdAt.toLocaleString("fa-IR")}</td>
        </tr>
      `;
    }

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    res.status(500).send("خطا در دریافت لیست درخواست‌ها");
  }
});

// اجرا
app.listen(3000, () => console.log("Bale bot running..."));
