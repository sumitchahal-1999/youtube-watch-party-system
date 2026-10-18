import mongoose from "mongoose";

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");
}

export default connectDatabase;
