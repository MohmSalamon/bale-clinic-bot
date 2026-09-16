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

if (!TOKEN) console.log("❌ TOKEN is missing in env");
if (!MONGO_URI) console.log("❌ MONGO_URI is missing in env");

// ===== MongoDB =====
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

// ===== Models =====
const patientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  phone: String,
  chatId: String,
  createdAt: { type: Date, default: Date.now }
});

const doctorSchema = new mongoose.Schema({
  name: String,
  shifts: [String]
});

const appointmentSchema = new mongoose.Schema({
  patientId: String,
  doctor: String,
  date: String,
  time: String,
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
    console.log("❌ Error sending message:", err.response?.data || err.message);
  }
}

// ===== رزرو نوبت: منطق =====
async function hasConflict(doctor, date, time) {
  const conflict = await Appointment.findOne({ doctor, date, time });
  return !!conflict;
}

async function bookAppointment(patientId, doctor, date, time) {
  if (await hasConflict(doctor, date, time)) {
    return { ok: false, msg: "این زمان قبلاً رزرو شده است ❌" };
  }
  const appt = new Appointment({ patientId, doctor, date, time });
  await appt.save();
  return { ok: true, msg: "نوبت با موفقیت ثبت شد ✅" };
}

// ===== State Machine =====
const state = {};
const userFirstName = {};
const userLastName = {};
const userDate = {};
const userTime = {};
const userDoctor = {};

// ===== Webhook =====
app.post("/webhook", async (req, res) => {
  const update = req.body;
  if (!update.message) return res.sendStatus(200);

  const chatId = update.message.chat.id;
  const text = (update.message.text || "").trim();

  // ===== /start =====
  if (text === "/start") {
    state[chatId] = "awaiting_first_name";
    await sendMessage(chatId, "سلام 👋\nلطفاً *نام* خود را وارد کنید:");
    return res.sendStatus(200);
  }

  if (state[chatId] === "awaiting_first_name") {
    userFirstName[chatId] = text;
    state[chatId] = "awaiting_last_name";
    await sendMessage(chatId, "عالی! حالا *نام‌خانوادگی* را وارد کنید:");
    return res.sendStatus(200);
  }

  if (state[chatId] === "awaiting_last_name") {
    userLastName[chatId] = text;
    let p = await Patient.findOne({ chatId });
    if (!p) {
      p = new Patient({ firstName: userFirstName[chatId], lastName: userLastName[chatId], chatId });
      await p.save();
    } else {
      p.firstName = userFirstName[chatId];
      p.lastName = userLastName[chatId];
      await p.save();
    }
    state[chatId] = null;
    await sendMessage(chatId, `ثبت اطلاعات انجام شد ✅\n${p.firstName} ${p.lastName}\nبرای رزرو نوبت، دستور reserve را ارسال کنید.`);
    return res.sendStatus(200);
  }

  if (text === "reserve") {
    const p = await Patient.findOne({ chatId });
    if (!p || !p.firstName || !p.lastName) {
      await sendMessage(chatId, "ابتدا باید اطلاعات خود را ثبت کنید.\nدستور /start را ارسال کنید.");
      return res.sendStatus(200);
    }
    state[chatId] = "awaiting_date";
    await sendMessage(chatId, "لطفاً تاریخ نوبت را به‌صورت شمسی ارسال کنید (مثال: 1403/07/01):");
    return res.sendStatus(200);
  }

  if (state[chatId] === "awaiting_date") {
    userDate[chatId] = text;
    state[chatId] = "awaiting_time";
    await sendMessage(chatId, "لطفاً ساعت نوبت را ارسال کنید (مثال: 09:00):");
    return res.sendStatus(200);
  }

  if (state[chatId] === "awaiting_time") {
    userTime[chatId] = text;
    state[chatId] = "awaiting_doctor";
    await sendMessage(chatId, "لطفاً پزشک را انتخاب کنید:\n1) دکتر الف\n2) دکتر ب");
    return res.sendStatus(200);
  }

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
      await sendMessage(chatId, "ابتدا باید ثبت اطلاعات انجام دهید. دستور /start را ارسال کنید.");
      state[chatId] = null;
      return res.sendStatus(200);
    }

    const result = await bookAppointment(patient._id, userDoctor[chatId], userDate[chatId], userTime[chatId]);
    await sendMessage(chatId, `${result.msg}\nبیمار: ${patient.firstName} ${patient.lastName}\nپزشک: ${userDoctor[chatId]}\nتاریخ: ${userDate[chatId]}\nساعت: ${userTime[chatId]}`);
    state[chatId] = null;
    return res.sendStatus(200);
  }

  await sendMessage(chatId, "دستور نامعتبر است.\nاز /start یا reserve استفاده کنید.");
  res.sendStatus(200);
});

// ===== API برای پنل مدیریت =====
app.get("/api/appointments", async (req, res) => {
  const list = await Appointment.find().sort({ date: 1, time: 1 });
  res.json(list);
});

app.post("/api/appointments", async (req, res) => {
  const { patientName, date, time, doctor } = req.body;
  const [firstName, lastName] = (patientName || "").split(" ");
  const patient = await Patient.findOne({ firstName, lastName });
  if (!patient) return res.json({ ok: false, msg: "بیمار یافت نشد ❌" });
  const result = await bookAppointment(patient._id, doctor, date, time);
  res.json(result);
});

// ===== مسیر جدید: دریافت اطلاعات بیمار =====
app.get("/api/patient/:id", async (req, res) => {
  try {
    const p = await Patient.findById(req.params.id);
    if (!p) return res.json({ ok: false, msg: "بیمار یافت نشد ❌" });
    res.json(p);
  } catch (err) {
    res.json({ ok: false, msg: "خطا در دریافت اطلاعات بیمار" });
  }
});

// ===== تست GET =====
app.get("/", (req, res) => {
  res.send("Bale clinic bot is running.");
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Bale bot running on port ${PORT}`);
});
