const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// اتصال به MongoDB Atlas
mongoose.connect("mongodb+srv://mohmsalamon5_db_user:vBpj0o5CWCIAgJuW@cluster0.xfpt6tg.mongodb.net/baleclinic?retryWrites=true&w=majority")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// مدل بیمار
const patientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  phone: String,
  therapist: String,
  day: String,
  time: String,
  chatId: String,
  createdAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model("Patient", patientSchema);

// ارسال پیام به بله
async function sendMessage(chatId, text) {
  await axios.post(
    `https://tapi.bale.ai/bot788261285:S4-XyqrNtJRAOR-bTDt8u0bbXu0Z2JYEC2g/sendMessage`,  
    { chat_id: chatId, text }
  );
}

// وضعیت کاربران برای فرم ثبت بیمار
const userState = {};
const userData = {};

// Webhook بله
app.post("/webhook", async (req, res) => {
  const message = req.body.message;
  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text;

  console.log("پیام جدید از Chat ID:", chatId);

  // شروع ثبت نوبت
  if (text === "ثبت نوبت") {
    userState[chatId] = "ASK_FIRSTNAME";
    userData[chatId] = {};
    sendMessage(chatId, "لطفاً نام خود را وارد کنید:");
    return res.sendStatus(200);
  }

  // مرحله ۱ — نام
  if (userState[chatId] === "ASK_FIRSTNAME") {
    userData[chatId].firstName = text;
    userState[chatId] = "ASK_LASTNAME";
    sendMessage(chatId, "نام خانوادگی:");
    return res.sendStatus(200);
  }

  // مرحله ۲ — نام خانوادگی
  if (userState[chatId] === "ASK_LASTNAME") {
    userData[chatId].lastName = text;
    userState[chatId] = "ASK_PHONE";
    sendMessage(chatId, "شماره موبایل:");
    return res.sendStatus(200);
  }

  // مرحله ۳ — موبایل
  if (userState[chatId] === "ASK_PHONE") {
    userData[chatId].phone = text;
    userState[chatId] = "ASK_THERAPIST";
    sendMessage(chatId, "نام درمانگر:");
    return res.sendStatus(200);
  }

  // مرحله ۴ — درمانگر
  if (userState[chatId] === "ASK_THERAPIST") {
    userData[chatId].therapist = text;
    userState[chatId] = "ASK_DAY";
    sendMessage(chatId, "روز مورد نظر:");
    return res.sendStatus(200);
  }

  // مرحله ۵ — روز
  if (userState[chatId] === "ASK_DAY") {
    userData[chatId].day = text;
    userState[chatId] = "ASK_TIME";
    sendMessage(chatId, "ساعت مورد نظر:");
    return res.sendStatus(200);
  }

  // مرحله ۶ — ساعت و ذخیره نهایی
  if (userState[chatId] === "ASK_TIME") {
    userData[chatId].time = text;

    const newPatient = new Patient({
      ...userData[chatId],
      chatId
    });

    await newPatient.save();

    sendMessage(chatId, "نوبت شما با موفقیت ثبت شد ✔");

    delete userState[chatId];
    delete userData[chatId];

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

// API ثبت بیمار از پنل
app.post("/addPatient", async (req, res) => {
  const newPatient = new Patient(req.body);
  await newPatient.save();
  res.json({ status: "ok", message: "Patient saved" });
});

// API لیست بیماران
app.get("/patients", async (req, res) => {
  const list = await Patient.find().sort({ createdAt: -1 });
  res.json({ status: "ok", count: list.length, data: list });
});

// API جستجو و فیلتر
app.get("/patients/search", async (req, res) => {
  const { phone, therapist, day, _id } = req.query;

  const filter = {};
  if (phone) filter.phone = phone;
  if (therapist) filter.therapist = therapist;
  if (day) filter.day = day;
  if (_id) filter._id = _id;

  const result = await Patient.find(filter).sort({ createdAt: -1 });
  res.json({ status: "ok", count: result.length, data: result });
});

// API حذف
app.delete("/patients/delete/:id", async (req, res) => {
  await Patient.findByIdAndDelete(req.params.id);
  res.json({ status: "ok", message: "Patient deleted" });
});

// API ویرایش
app.put("/patients/update/:id", async (req, res) => {
  await Patient.findByIdAndUpdate(req.params.id, req.body);
  res.json({ status: "ok", message: "Patient updated" });
});

// شروع سرور
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Bale bot running on port " + PORT);
});

