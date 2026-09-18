const mongoose = require("mongoose");
require("dotenv").config();

const id = process.argv[2];

if (!mongoose.isValidObjectId(id)) {
  console.log("❌ شناسه معتبر نیست");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await mongoose.connection.db.collection("users").updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { doctor: "دکتر جدید" } }
    );

    console.log("✔ Updated:", id);

    const updated = await mongoose.connection.db.collection("users").findOne({
      _id: new mongoose.Types.ObjectId(id)
    });

    console.log("📌 رکورد جدید:");
    console.log(updated);

    mongoose.connection.close();
  })
  .catch(err => console.log(err));
