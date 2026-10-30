import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get Watch Later List
router.get('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videos = user.watchLater || [];
    return res.json({
      videos,
      count: videos.length,
      watchLaterIds: videos.map((v) => v.videoId),
    });
  } catch (err) {
    console.error('Watch later fetch error:', err);
    return res.status(500).json({ message: 'Error retrieving watch later playlist.' });
  }
});

// Toggle Add / Remove Video from Watch Later
router.post('/:videoId', authRequired, async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoData = req.body.video || {};

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.watchLater.findIndex(
      (item) => item.videoId === videoId
    );

    let isSaved = false;
    if (index > -1) {
      // Remove
      user.watchLater.splice(index, 1);
      isSaved = false;
    } else {
      // Add
      user.watchLater.unshift({
        videoId: videoId,
        title: videoData.title || 'Saved Video',
        thumbnailUrl: videoData.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: videoData.duration || '0:00',
        channelName: videoData.channelName || 'YouTube Creator',
        channelAvatar: videoData.channelAvatar || '',
        subscriberCount: videoData.subscriberCount || '100K subscribers',
        likes: videoData.likes || '10K',
        views: videoData.views || '100K views',
        uploadDate: videoData.uploadDate || 'Recently',
        description: videoData.description || '',
      });
      isSaved = true;
    }

    await user.save();

    return res.json({
      isSaved,
      message: isSaved ? 'Saved to Watch Later' : 'Removed from Watch Later',
      watchLaterIds: user.watchLater.map((v) => v.videoId),
      watchLaterCount: user.watchLater.length,
    });
  } catch (err) {
    console.error('Toggle watch later error:', err);
    return res.status(500).json({ message: 'Failed to update watch later.' });
  }
});

// Remove Specific Video from Watch Later
router.delete('/:videoId', authRequired, async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.watchLater = user.watchLater.filter((item) => item.videoId !== videoId);
    await user.save();

    return res.json({
      message: 'Video removed from Watch Later',
      watchLaterIds: user.watchLater.map((v) => v.videoId),
      watchLaterCount: user.watchLater.length,
    });
  } catch (err) {
    console.error('Delete watch later video error:', err);
    return res.status(500).json({ message: 'Failed to remove video.' });
  }
});

// Clear All Watch Later
router.delete('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.watchLater = [];
    await user.save();

    return res.json({
      message: 'Watch later playlist cleared',
      watchLaterIds: [],
      watchLaterCount: 0,
    });
  } catch (err) {
    console.error('Clear watch later error:', err);
    return res.status(500).json({ message: 'Failed to clear watch later.' });
  }
});

export default router;
