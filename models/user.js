const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  chatId: String,
  firstName: String,
  username: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
