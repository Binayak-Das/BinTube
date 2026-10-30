import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get Liked Videos List for authenticated user
router.get('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videos = user.likedVideos || [];
    return res.json({
      videos,
      count: videos.length,
      likedVideoIds: videos.map((v) => v.videoId),
    });
  } catch (err) {
    console.error('Liked videos fetch error:', err);
    return res.status(500).json({ message: 'Error retrieving liked videos.' });
  }
});

// Toggle Like / Unlike Video
router.post('/:videoId', authRequired, async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoData = req.body.video || {};

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.likedVideos) {
      user.likedVideos = [];
    }

    const index = user.likedVideos.findIndex((item) => item.videoId === videoId);

    let isLiked = false;
    if (index > -1) {
      // Remove from liked
      user.likedVideos.splice(index, 1);
      isLiked = false;
    } else {
      // Add to liked
      user.likedVideos.unshift({
        videoId: videoId,
        title: videoData.title || 'Liked Video',
        thumbnailUrl: videoData.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: videoData.duration || '0:00',
        channelName: videoData.channelName || 'YouTube Creator',
        channelAvatar: videoData.channelAvatar || '',
        subscriberCount: videoData.subscriberCount || '',
        likes: videoData.likes || '',
        views: videoData.views || '',
        uploadDate: videoData.uploadDate || '',
        description: videoData.description || '',
        savedAt: new Date(),
      });
      isLiked = true;
    }

    await user.save();

    return res.json({
      isLiked,
      message: isLiked ? 'Added to Liked videos' : 'Removed from Liked videos',
      likedVideoIds: user.likedVideos.map((v) => v.videoId),
      count: user.likedVideos.length,
      videos: user.likedVideos,
    });
  } catch (err) {
    console.error('Toggle like video error:', err);
    return res.status(500).json({ message: 'Failed to update liked videos.' });
  }
});

// Remove Specific Video from Liked Videos
router.delete('/:videoId', authRequired, async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.likedVideos = (user.likedVideos || []).filter((item) => item.videoId !== videoId);
    await user.save();

    return res.json({
      message: 'Video removed from Liked videos',
      likedVideoIds: user.likedVideos.map((v) => v.videoId),
      count: user.likedVideos.length,
      videos: user.likedVideos,
    });
  } catch (err) {
    console.error('Delete liked video error:', err);
    return res.status(500).json({ message: 'Failed to remove liked video.' });
  }
});

// Clear All Liked Videos
router.delete('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.likedVideos = [];
    await user.save();

    return res.json({
      message: 'All liked videos cleared',
      likedVideoIds: [],
      count: 0,
      videos: [],
    });
  } catch (err) {
    console.error('Clear liked videos error:', err);
    return res.status(500).json({ message: 'Failed to clear liked videos.' });
  }
});

export default router;

