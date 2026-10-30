import React from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, CheckIcon } from './Icons.jsx';

export default function VideoCard({
  video,
  onSelectVideo,
  isWatchLater,
  onToggleWatchLater,
}) {
  const vId = video.videoId || video._id;

  const handleClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    if (onSelectVideo) {
      onSelectVideo(video);
    }
  };

  return (
    <Link
      to={`/watch?v=${encodeURIComponent(vId)}`}
      state={{ video }}
      className="video-card"
      onClick={handleClick}
    >
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
        <div
          className="card-quick-actions"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            className={`quick-action-btn ${isWatchLater ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWatchLater(video);
            }}
            title={isWatchLater ? 'Remove from Watch Later' : 'Watch Later'}
          >
            <ClockIcon size={16} />
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
    </Link>
  );
}
