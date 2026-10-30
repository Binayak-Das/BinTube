import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    duration: { type: String, default: '3:45' },
    channelName: { type: String, required: true, trim: true, index: true },
    channelAvatar: { type: String, default: '' },
    subscriberCount: { type: String, default: '100K' },
    likes: { type: String, default: '12K' },
    views: { type: String, default: '50K views' },
    uploadDate: { type: String, default: 'Recently' },
    category: { type: String, default: 'All', index: true },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

videoSchema.index({ title: 'text', description: 'text', channelName: 'text' });

export default mongoose.model('Video', videoSchema);
