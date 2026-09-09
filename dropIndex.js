const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://mohmsalamon5_db_user:vBpj0o5CWCIAgJuW@cluster0.xfpt6tg.mongodb.net/baleclinic");

    console.log("Connected to MongoDB");

    const result = await mongoose.connection.db.collection("patients").dropIndex("chatId_1");
    console.log("Index removed:", result);

    await mongoose.connection.close();
    console.log("Connection closed");
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
