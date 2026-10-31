import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { fetchVideoComments } from '../services/youtube.js';

const router = express.Router();

// GET /api/videos/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const videoId = req.params.id;
    const { continuation, sortBy = 'top' } = req.query;

    // If continuation token is provided, only fetch next page of YouTube comments
    if (continuation) {
      const ytData = await fetchVideoComments(videoId, { continuation, sortBy });
      return res.json({
        comments: ytData.comments || [],
        nextContinuationToken: ytData.nextContinuationToken || null,
        hasMore: Boolean(ytData.hasMore),
      });
    }

    // 1. Fetch user comments from MongoDB for this video
    const localComments = await Comment.find({ videoId })
      .sort({ createdAt: -1 })
      .lean();

    const formattedLocal = localComments.map((c) => ({
      id: c._id.toString(),
      author: c.authorName || 'User',
      avatar: c.authorAvatar || '',
      text: c.text,
      time: 'Just now',
      likes: String(c.likes || 0),
      isUserComment: true,
      userId: c.userId?.toString(),
      createdAt: c.createdAt,
    }));

    // 2. Fetch external YouTube comments with sort preference
    const ytData = await fetchVideoComments(videoId, { sortBy });

    // Merge: local user comments on top, then YouTube comments
    const allComments = [...formattedLocal, ...(ytData.comments || [])];
    const totalCount =
      ytData.totalCount && ytData.totalCount !== '0'
        ? ytData.totalCount
        : `${allComments.length} Comments`;

    res.json({
      totalCount,
      comments: allComments,
      nextContinuationToken: ytData.nextContinuationToken || null,
      hasMore: Boolean(ytData.hasMore),
    });
  } catch (err) {
    console.error('Error in GET /api/videos/:id/comments:', err);
    res.status(500).json({ message: 'Failed to fetch comments', error: err.message });
  }
});

// POST /api/videos/:id/comments
router.post('/:id/comments', authRequired, async (req, res) => {
  try {
    const videoId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text cannot be empty' });
    }

    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newComment = new Comment({
      videoId,
      userId: req.userId,
      authorName: user.name || 'User',
      authorAvatar: user.avatar || '',
      text: text.trim(),
    });

    await newComment.save();

    res.status(201).json({
      id: newComment._id.toString(),
      author: newComment.authorName,
      avatar: newComment.authorAvatar,
      text: newComment.text,
      time: 'Just now',
      likes: '0',
      isUserComment: true,
      userId: req.userId,
      createdAt: newComment.createdAt,
    });
  } catch (err) {
    console.error('Error in POST /api/videos/:id/comments:', err);
    res.status(500).json({ message: 'Failed to post comment', error: err.message });
  }
});

// DELETE /api/videos/:id/comments/:commentId
router.delete('/:id/comments/:commentId', authRequired, async (req, res) => {
  try {
    const { id: videoId, commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Verify ownership
    if (comment.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await Comment.findByIdAndDelete(commentId);

    res.json({ message: 'Comment deleted successfully', id: commentId });
  } catch (err) {
    console.error('Error in DELETE /api/videos/:id/comments/:commentId:', err);
    res.status(500).json({ message: 'Failed to delete comment', error: err.message });
  }
});

export default router;

