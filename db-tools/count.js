const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const count = await mongoose.connection.db.collection("users").countDocuments();
    console.log("Total records:", count);
    mongoose.connection.close();
  })
  .catch(err => console.log(err));
