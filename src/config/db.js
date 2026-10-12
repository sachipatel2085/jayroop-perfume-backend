import mongoose from "mongoose";

export const connectDB = async () => {
  // DNS for mongodb+srv:// is handled in src/config/env.js (imported first by server.js)
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    process.exit(1);
  }
};
