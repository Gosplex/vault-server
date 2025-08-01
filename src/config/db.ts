import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ DB Error', err);
    process.exit(1);
  }
};

export default connectDB;
