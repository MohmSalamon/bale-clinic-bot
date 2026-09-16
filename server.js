// server.js

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(bodyParser.json());

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.log("❌ TOKEN is missing in env");
}
if (!MONGO_URI) {
  console.log("❌ MONGO_URI is missing in env");
}

// ===== MongoDB =====
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

// ===== Models =====
const patientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  chatId: String,
  createdAt: { type: Date, default: Date.now }
});

const doctorSchema = new mongoose.Schema({
  name: String,
  shifts: [String] // مثال: ["شنبه-صبح", "شنبه-عصر"]
});

const appointmentSchema = new mongoose.Schema({
  patientId: String,
  doctor: String,
  date: String, // 1403/07/01
  time: String, // 09:00
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model("Patient", patientSchema);
const Doctor = mongoose.model("Doctor", doctorSchema);
const Appointment = mongoose.model("Appointment", appointmentSchema);

// ===== Bale API =====
const BALE_API = "https://tapi.bale.ai/bot" + TOKEN;

async function sendMessage(chatId, text) {
  try {
    await axios.post(BALE_API + "/sendMessage", {
      chat_id: chatId,
      text: text
    });
  } catch (err) {
    console.log(
      "❌ Error sending message:",
      err.response?.data || err.message
    );
  }
}

// ===== رزرو نوبت: منطق =====
async function hasConflict(doctor, date, time) {
  const conflict = await Appointment.findOne({ doctor, date, time });
  return conflict ? true : false;
}

async function bookAppointment(patientId, doctor, date, time) {
  if (await hasConflict(doctor, date, time)) {
    return { ok: false, msg: "این زمان قبلاً رزرو شده است ❌" };
  }

  const appt = new Appointment({ patientId, doctor, date, time });
  await appt.save();

  return { ok: true, msg: "نوبت با موفقیت ثبت شد ✅" };
}

// ===== State Machine برای رزرو =====
const state = {};
const userDate = {};
const userTime = {};
const userDoctor = {};

// ===== Webhook =====
app.post("/webhook", async (req, res) => {
  console.log("📩 Webhook received:", JSON.stringify(req.body));

  const update = req.body;

  if (!update.message) {
    return res.sendStatus(200);
  }

  const chatId = update.message.chat.id;
  const text = (update.message.text || "").trim();

  console.log("📩 Message:", text, "from", chatId);

  // ===== /start =====
  if (text === "/start") {
    await sendMessage(
      chatId,
      "سلام 👋\nبرای ثبت اطلاعات، دستور register را ارسال کنید."
    );
    return res.sendStatus(200);
  }

  // ===== register =====
  if (text === "register") {
    let p = await Patient.findOne({ chatId });
    if (!p) {
      p = new Patient({ chatId });
      await p.save();
    }
    await sendMessage(
      chatId,
      "ثبت اولیه انجام شد ✅\nبرای رزرو نوبت، دستور reserve را ارسال کنید."
    );
    return res.sendStatus(200);
  }

  // ===== شروع رزرو =====
  if (text === "reserve") {
    state[chatId] = "awaiting_date";
    await sendMessage(
      chatId,
      "لطفاً تاریخ را ارسال کنید (مثال: 1403/07/01)"
    );
    return res.sendStatus(200);
  }

  // ===== دریافت تاریخ =====
  if (state[chatId] === "awaiting_date") {
    userDate[chatId] = text;
    state[chatId] = "awaiting_time";
    await sendMessage(chatId, "لطفاً ساعت را ارسال کنید (مثال: 09:00)");
    return res.sendStatus(200);
  }

  // ===== دریافت ساعت =====
  if (state[chatId] === "awaiting_time") {
    userTime[chatId] = text;
    state[chatId] = "awaiting_doctor";
    await sendMessage(
      chatId,
      "لطفاً پزشک را انتخاب کنید:\n1) دکتر الف\n2) دکتر ب"
    );
    return res.sendStatus(200);
  }

  // ===== انتخاب پزشک =====
  if (state[chatId] === "awaiting_doctor") {
    let doctor = "";
    if (text === "1") doctor = "دکتر الف";
    else if (text === "2") doctor = "دکتر ب";
    else {
      await sendMessage(chatId, "گزینه نامعتبر است. لطفاً 1 یا 2 را ارسال کنید.");
      return res.sendStatus(200);
    }

    userDoctor[chatId] = doctor;

    const patient = await Patient.findOne({ chatId });
    if (!patient) {
      await sendMessage(
        chatId,
        "ابتدا باید ثبت اولیه انجام دهید. دستور register را ارسال کنید."
      );
      state[chatId] = null;
      return res.sendStatus(200);
    }

    const result = await bookAppointment(
      patient._id,
      userDoctor[chatId],
      userDate[chatId],
      userTime[chatId]
    );

    await sendMessage(chatId, result.msg);
    state[chatId] = null;
    return res.sendStatus(200);
  }

  // ===== سایر دستورات =====
  await sendMessage(chatId, "دستور نامعتبر است.");
  res.sendStatus(200);
});

// ===== API برای پنل مدیریت =====
// ===== API دریافت اطلاعات بیمار =====
app.get("/api/patient/:id", async (req, res) => {
  try {
    const p = await Patient.findById(req.params.id);
    if (!p) return res.json({ ok: false, msg: "بیمار یافت نشد ❌" });
    res.json(p);
  } catch (err) {
    res.json({ ok: false, msg: "خطا در دریافت اطلاعات بیمار" });
  }
});

app.get("/api/appointments", async (req, res) => {
  const list = await Appointment.find().sort({ date: 1, time: 1 });
  res.json(list);
});

app.post("/api/appointments", async (req, res) => {
  const { patientId, doctor, date, time } = req.body;
  const result = await bookAppointment(patientId, doctor, date, time);
  res.json(result);
});

// ===== تست GET =====
app.get("/", (req, res) => {
  res.send("Bale clinic bot is running.");
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Bale bot running on port ${PORT}`);
});
