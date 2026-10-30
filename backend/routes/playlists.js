import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

const generatePlaylistId = () => {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
};

// Get All Playlists for authenticated user
router.get('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlists = (user.playlists || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      videoCount: (p.videos || []).length,
      coverThumbnail: (p.videos && p.videos.length > 0) ? p.videos[0].thumbnailUrl : '',
      videos: p.videos || [],
    }));

    return res.json({ playlists, count: playlists.length });
  } catch (err) {
    console.error('Fetch playlists error:', err);
    return res.status(500).json({ message: 'Error retrieving playlists.' });
  }
});

// Create a New Playlist
router.post('/', authRequired, async (req, res) => {
  try {
    const { title, description = '', initialVideo = null } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Playlist title is required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.playlists) {
      user.playlists = [];
    }

    const newId = generatePlaylistId();
    const videosList = [];

    if (initialVideo && (initialVideo.videoId || initialVideo._id)) {
      const vId = initialVideo.videoId || initialVideo._id;
      videosList.push({
        videoId: vId,
        title: initialVideo.title || 'Video',
        thumbnailUrl: initialVideo.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
        duration: initialVideo.duration || '0:00',
        channelName: initialVideo.channelName || 'YouTube Creator',
        channelAvatar: initialVideo.channelAvatar || '',
        subscriberCount: initialVideo.subscriberCount || '',
        likes: initialVideo.likes || '',
        views: initialVideo.views || '',
        uploadDate: initialVideo.uploadDate || '',
        description: initialVideo.description || '',
        savedAt: new Date(),
      });
    }

    const newPlaylist = {
      id: newId,
      title: title.trim(),
      description: description.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      videos: videosList,
    };

    user.playlists.unshift(newPlaylist);
    await user.save();

    return res.status(201).json({
      message: `Created playlist "${title.trim()}"`,
      playlist: {
        ...newPlaylist,
        videoCount: videosList.length,
        coverThumbnail: videosList[0]?.thumbnailUrl || '',
      },
      playlists: user.playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        videoCount: (p.videos || []).length,
        coverThumbnail: (p.videos && p.videos.length > 0) ? p.videos[0].thumbnailUrl : '',
      })),
    });
  } catch (err) {
    console.error('Create playlist error:', err);
    return res.status(500).json({ message: 'Failed to create playlist.' });
  }
});

// Get Single Playlist by ID
router.get('/:playlistId', authRequired, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlist = (user.playlists || []).find((p) => p.id === playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    return res.json({
      playlist: {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        videoCount: (playlist.videos || []).length,
        coverThumbnail: (playlist.videos && playlist.videos.length > 0) ? playlist.videos[0].thumbnailUrl : '',
        videos: playlist.videos || [],
      },
    });
  } catch (err) {
    console.error('Get playlist error:', err);
    return res.status(500).json({ message: 'Failed to get playlist.' });
  }
});

// Delete Playlist
router.delete('/:playlistId', authRequired, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = (user.playlists || []).findIndex((p) => p.id === playlistId);
    if (index === -1) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    const deletedTitle = user.playlists[index].title;
    user.playlists.splice(index, 1);
    await user.save();

    return res.json({
      message: `Deleted playlist "${deletedTitle}"`,
      playlists: (user.playlists || []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        videoCount: (p.videos || []).length,
        coverThumbnail: (p.videos && p.videos.length > 0) ? p.videos[0].thumbnailUrl : '',
      })),
    });
  } catch (err) {
    console.error('Delete playlist error:', err);
    return res.status(500).json({ message: 'Failed to delete playlist.' });
  }
});

// Add Video to Playlist
router.post('/:playlistId/videos', authRequired, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { video } = req.body;

    if (!video || (!video.videoId && !video._id)) {
      return res.status(400).json({ message: 'Valid video data is required.' });
    }

    const vId = video.videoId || video._id;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlist = (user.playlists || []).find((p) => p.id === playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    const alreadyExists = (playlist.videos || []).some((v) => v.videoId === vId);
    if (alreadyExists) {
      return res.status(400).json({
        message: `Video already in "${playlist.title}"`,
        playlist,
      });
    }

    playlist.videos.unshift({
      videoId: vId,
      title: video.title || 'Video',
      thumbnailUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
      duration: video.duration || '0:00',
      channelName: video.channelName || 'YouTube Creator',
      channelAvatar: video.channelAvatar || '',
      subscriberCount: video.subscriberCount || '',
      likes: video.likes || '',
      views: video.views || '',
      uploadDate: video.uploadDate || '',
      description: video.description || '',
      savedAt: new Date(),
    });

    playlist.updatedAt = new Date();
    await user.save();

    return res.json({
      message: `Added to "${playlist.title}"`,
      playlist,
    });
  } catch (err) {
    console.error('Add video to playlist error:', err);
    return res.status(500).json({ message: 'Failed to add video to playlist.' });
  }
});

// Remove Video from Playlist
router.delete('/:playlistId/videos/:videoId', authRequired, async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlist = (user.playlists || []).find((p) => p.id === playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    playlist.videos = (playlist.videos || []).filter((v) => v.videoId !== videoId);
    playlist.updatedAt = new Date();
    await user.save();

    return res.json({
      message: `Removed from "${playlist.title}"`,
      playlist,
    });
  } catch (err) {
    console.error('Remove video from playlist error:', err);
    return res.status(500).json({ message: 'Failed to remove video from playlist.' });
  }
});

export default router;

