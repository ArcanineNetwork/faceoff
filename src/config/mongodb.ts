import mongoose from 'mongoose';
import { logger } from '../logger';

export const connectDB = async (opts: { db: string }) => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(MONGODB_URI, { dbName: opts.db });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', { error });
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('MongoDB disconnection error:', { error });
    throw error;
  }
};
