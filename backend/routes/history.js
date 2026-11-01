import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get Watch History List
router.get('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videos = user.history || [];
    return res.json({
      videos,
      count: videos.length,
    });
  } catch (err) {
    console.error('History fetch error:', err);
    return res.status(500).json({ message: 'Error retrieving watch history.' });
  }
});

// Add / Update Video in Watch History
router.post('/', authRequired, async (req, res) => {
  try {
    const videoData = req.body.video || req.body || {};
    const videoId = videoData.videoId || videoData._id;

    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.history) {
      user.history = [];
    }

    // Remove existing entry if already watched previously
    user.history = user.history.filter((item) => item.videoId !== videoId);

    // Insert at front with fresh watchedAt timestamp
    user.history.unshift({
      videoId: videoId,
      title: videoData.title || 'Watched Video',
      thumbnailUrl: videoData.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: videoData.duration || '0:00',
      channelName: videoData.channelName || 'YouTube Creator',
      channelAvatar: videoData.channelAvatar || '',
      subscriberCount: videoData.subscriberCount || '100K subscribers',
      likes: videoData.likes || '10K',
      views: videoData.views || '100K views',
      uploadDate: videoData.uploadDate || 'Recently',
      description: videoData.description || '',
      watchedAt: new Date(),
    });

    // Cap history length at 250 items to keep document lightweight
    if (user.history.length > 250) {
      user.history = user.history.slice(0, 250);
    }

    await user.save();

    return res.json({
      message: 'Recorded in history',
      count: user.history.length,
    });
  } catch (err) {
    console.error('Add history error:', err);
    return res.status(500).json({ message: 'Failed to record watch history.' });
  }
});

// Remove Specific Video from History
router.delete('/:videoId', authRequired, async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.history = (user.history || []).filter((item) => item.videoId !== videoId);
    await user.save();

    return res.json({
      message: 'Video removed from history',
      count: user.history.length,
    });
  } catch (err) {
    console.error('Delete history video error:', err);
    return res.status(500).json({ message: 'Failed to remove video from history.' });
  }
});

// Clear All Watch History
router.delete('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.history = [];
    await user.save();

    return res.json({
      message: 'Watch history cleared',
      count: 0,
    });
  } catch (err) {
    console.error('Clear history error:', err);
    return res.status(500).json({ message: 'Failed to clear watch history.' });
  }
});

export default router;

