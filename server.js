const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// اتصال به دیتابیس
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✓"))
  .catch(err => console.log("DB Error:", err));

// مدل دیتابیس
const UserSchema = new mongoose.Schema({
  name: String,
  family: String,
  doctor: String,
  phone: String,
  date: String,
  time: String,
  chatId: String
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

// مسیر داشبورد
app.get("/dashboard", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();

    let rows = "";
    users.forEach(u => {
      rows += `
        <tr data-id="${u._id}">
          <td>${u.name}</td>
          <td>${u.family}</td>
          <td>${u.doctor}</td>
          <td>${u.phone}</td>
          <td>${u.date}</td>
          <td>${u.time}</td>
          <td>
            <button class="btn btn-edit" onclick="editRow('${u._id}')">ویرایش</button>
            <button class="btn btn-delete" onclick="deleteRow('${u._id}')">حذف</button>
          </td>
        </tr>
      `;
    });

    const html = fs.readFileSync("public/admin.html", "utf8")
      .replace("{{DATA}}", rows);

    res.send(html);

  } catch (err) {
    console.log("Dashboard Error:", err);
    res.send("خطا در دریافت داده‌ها");
  }
});

// API حذف رکورد
app.delete("/delete/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err });
  }
});

// API ویرایش رکورد
app.put("/edit/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err });
  }
});

// تست دیتابیس
app.get("/test-db", async (req, res) => {
  try {
    const users = await User.find().limit(5);
    res.json(users);
  } catch (err) {
    res.send("خطا در اتصال به دیتابیس");
  }
});

// شروع سرور
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✓`);
});
