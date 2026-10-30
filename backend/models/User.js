import mongoose from 'mongoose';

export const videoItemSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    duration: { type: String, default: '0:00' },
    channelName: { type: String, default: '' },
    channelAvatar: { type: String, default: '' },
    subscriberCount: { type: String, default: '100K' },
    likes: { type: String, default: '10K' },
    views: { type: String, default: '100K views' },
    uploadDate: { type: String, default: '' },
    description: { type: String, default: '' },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const subscribedChannelSchema = new mongoose.Schema(
  {
    channelName: { type: String, required: true },
    channelAvatar: { type: String, default: '' },
    subscriberCount: { type: String, default: '100K subscribers' },
    subscribedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const playlistSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    videos: [videoItemSchema],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    watchLater: [videoItemSchema],
    likedVideos: [videoItemSchema],
    subscribedChannels: [subscribedChannelSchema],
    playlists: [playlistSchema],
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
