const mongoose = require("mongoose");

const RequestSchema = new mongoose.Schema({
  chatId: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Request", RequestSchema);
