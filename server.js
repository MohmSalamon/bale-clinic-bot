const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const app = express();

app.use(express.json());

// توکن ربات بله
const API = "https://tapi.bale.ai/bot788261285:S4-XyqrNtJRAOR-bTDt8u0bbXu0Z2JYEC2g";

// اتصال به دیتابیس
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo error", err));

// مدل Patient
const PatientSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  source: { type: String, default: "bale" },
  createdAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model("Patient", PatientSchema);

// ذخیره Chat ID در دیتابیس
async function saveChatId(chatId) {
  let patient = await Patient.findOne({ chatId });

  if (!patient) {
    patient = new Patient({ chatId, source: "bale" });
    await patient.save();
    console.log("Chat ID ذخیره شد:", chatId);
  } else {
    console.log("Chat ID قبلاً ثبت شده بود:", chatId);
  }
}

// Webhook ربات بله
app.post("/webhook", async (req, res) => {
  const update = req.body;

  if (!update.message) return res.sendStatus(200);

  const chatId = update.message.chat.id;
  const text = update.message.text || "";

  console.log("پیام جدید از Chat ID:", chatId, "متن:", text);

  await saveChatId(chatId);

  await axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text: `Chat ID شما ثبت شد: ${chatId}`
  });

  res.sendStatus(200);
});

// اجرای سرور
app.listen(3000, () => console.log("Bale bot running on port 3000"));
