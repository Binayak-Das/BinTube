import React from 'react';
import { ClockIcon, DownloadIcon, CheckIcon } from './Icons.jsx';

export default function VideoCard({
  video,
  onSelectVideo,
  isWatchLater,
  onToggleWatchLater,
  onDownload,
}) {
  return (
    <article className="video-card" onClick={() => onSelectVideo(video)}>
      {/* Thumbnail */}
      <div className="thumbnail-box">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="thumbnail-img"
          loading="lazy"
        />
        <span className="duration-badge">{video.duration}</span>

        {/* Hover quick action overlays */}
        <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className={`quick-action-btn ${isWatchLater ? 'active' : ''}`}
            onClick={() => onToggleWatchLater(video)}
            title={isWatchLater ? 'Remove from Watch Later' : 'Watch Later'}
          >
            <ClockIcon size={16} />
          </button>
          <button
            className="quick-action-btn"
            onClick={() => onDownload(video)}
            title="Download Video"
          >
            <DownloadIcon size={16} />
          </button>
        </div>
      </div>

      {/* Meta Information */}
      <div className="card-meta">
        <img
          src={video.channelAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
          alt={video.channelName}
          className="channel-avatar"
          loading="lazy"
        />
        <div className="card-info">
          <h3 className="card-title" title={video.title}>
            {video.title}
          </h3>
          <div className="card-channel">
            <span>{video.channelName}</span>
            <CheckIcon size={12} className="verified-icon" />
          </div>
          <div className="card-stats">
            <span>{video.views}</span> • <span>{video.uploadDate}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
