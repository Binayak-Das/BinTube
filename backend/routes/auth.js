import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bintube_secure_jwt_secret_key_2026';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

const formatUserResponse = (user) => {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    watchLaterIds: (user.watchLater || []).map((item) => item.videoId || item.toString()),
    watchLaterCount: (user.watchLater || []).length,
    likedVideoIds: (user.likedVideos || []).map((item) => item.videoId || item.toString()),
    likedCount: (user.likedVideos || []).length,
    subscribedChannels: user.subscribedChannels || [],
    subscriptionsCount: (user.subscribedChannels || []).length,
    playlists: (user.playlists || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      videoCount: (p.videos || []).length,
      coverThumbnail: (p.videos && p.videos.length > 0) ? p.videos[0].thumbnailUrl : '',
    })),
    playlistsCount: (user.playlists || []).length,
  };
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.trim() }],
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      return res.status(400).json({ message: 'This username is already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      watchLater: [],
      likedVideos: [],
      subscribedChannels: [],
      playlists: [],
    });

    const token = generateToken(newUser._id);

    return res.status(201).json({
      token,
      user: formatUserResponse(newUser),
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Please enter your username/email and password.' });
    }

    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase().trim() },
        { username: loginId.trim() },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. Please check and try again.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials. Please check and try again.' });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

// Get Current User info
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

export default router;
