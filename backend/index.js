import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from './models/User.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import watchLaterRoutes from './routes/watchLater.js';
import likedVideosRoutes from './routes/likedVideos.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import playlistsRoutes from './routes/playlists.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bintube';

// Middleware
app.use(cors());
app.use(express.json());

// Reusable / cached DB connection for serverless & local
let dbPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!dbPromise) {
    dbPromise = mongoose.connect(MONGO_URI).then(async () => {
      console.log('✅ DATABASE CONNECTED');
      await ensureDemoUser();
    });
  }
  await dbPromise;
}

// Auto-connect to DB before handling requests (skip for health check and suggestions)
app.use(async (req, res, next) => {
  if (req.path === '/api/health' || req.path.includes('/suggestions')) {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed', error: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/watch-later', watchLaterRoutes);
app.use('/api/liked-videos', likedVideosRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/playlists', playlistsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'YouTube Clone API Backend',
    engine: 'Realtime YouTube Data Service',
    timestamp: new Date().toISOString(),
  });
});

async function ensureDemoUser() {
  try {
    let demoUser = await User.findOne({ email: 'demo@bintube.com' });
    if (!demoUser) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.create({
        username: 'demouser',
        email: 'demo@bintube.com',
        password: hashedPassword,
        watchLater: [],
        likedVideos: [],
        subscribedChannels: [],
        playlists: [],
      });
      console.log('Demo account ready: demo@bintube.com / password123');
    } else {
      let needsSave = false;
      if (!demoUser.likedVideos) { demoUser.likedVideos = []; needsSave = true; }
      if (!demoUser.subscribedChannels) { demoUser.subscribedChannels = []; needsSave = true; }
      if (!demoUser.playlists) { demoUser.playlists = []; needsSave = true; }
      if (needsSave) await demoUser.save();
    }
  } catch (err) {
    console.error('Demo user check error:', err);
  }
}

// Start standalone HTTP server locally (when not running in Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER IS LIVE ON PORT ${PORT}`);
  });
  connectDB().catch((err) => {
    console.error('MongoDB initial connection error:', err.message);
  });
}

export default app;
