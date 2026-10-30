import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get Subscribed Channels
router.get('/', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const channels = user.subscribedChannels || [];
    return res.json({
      subscribedChannels: channels,
      count: channels.length,
    });
  } catch (err) {
    console.error('Subscriptions fetch error:', err);
    return res.status(500).json({ message: 'Error retrieving subscriptions.' });
  }
});

// Toggle Subscribe / Unsubscribe Channel
router.post('/', authRequired, async (req, res) => {
  try {
    const rawChannel = req.body.channel || req.body || {};
    const channelName = rawChannel.channelName || req.body.channelName;
    const channelAvatar = rawChannel.channelAvatar || req.body.channelAvatar || '';
    const subscriberCount = rawChannel.subscriberCount || req.body.subscriberCount || '';

    if (!channelName || !channelName.trim()) {
      return res.status(400).json({ message: 'channelName is required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.subscribedChannels) {
      user.subscribedChannels = [];
    }

    const trimmedName = channelName.trim();
    const index = user.subscribedChannels.findIndex(
      (c) => c.channelName.toLowerCase() === trimmedName.toLowerCase()
    );

    let isSubscribed = false;
    if (index > -1) {
      // Unsubscribe
      user.subscribedChannels.splice(index, 1);
      isSubscribed = false;
    } else {
      // Subscribe
      user.subscribedChannels.unshift({
        channelName: trimmedName,
        channelAvatar:
          channelAvatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            trimmedName
          )}&background=cc0000&color=fff&size=100`,
        subscriberCount: subscriberCount || '100K subscribers',
        subscribedAt: new Date(),
      });
      isSubscribed = true;
    }

    await user.save();

    return res.json({
      isSubscribed,
      message: isSubscribed
        ? `Subscribed to ${trimmedName}`
        : `Unsubscribed from ${trimmedName}`,
      subscribedChannels: user.subscribedChannels,
      count: user.subscribedChannels.length,
    });
  } catch (err) {
    console.error('Toggle subscription error:', err);
    return res.status(500).json({ message: 'Failed to update subscriptions.' });
  }
});

export default router;
