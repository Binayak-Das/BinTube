import React from 'react';
import { ShortsIcon, ClockIcon, DownloadIcon } from './Icons.jsx';

export default function ShortsCard({
  video,
  onSelectVideo,
  isWatchLater,
  onToggleWatchLater,
  onDownload,
}) {
  return (
    <div className="shorts-card" onClick={() => onSelectVideo(video)}>
      <div className="shorts-thumb-box">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="shorts-img"
          loading="lazy"
        />
        <div className="shorts-badge">
          <ShortsIcon size={16} />
          <span>Shorts</span>
        </div>

        {/* Quick action buttons */}
        <div className="shorts-quick-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className={`quick-action-btn ${isWatchLater ? 'active' : ''}`}
            onClick={() => onToggleWatchLater(video)}
            title={isWatchLater ? 'Remove from Watch Later' : 'Watch Later'}
          >
            <ClockIcon size={14} />
          </button>
          <button
            className="quick-action-btn"
            onClick={() => onDownload(video)}
            title="Download Short"
          >
            <DownloadIcon size={14} />
          </button>
        </div>

        {/* Bottom Title & Views */}
        <div className="shorts-info">
          <h4 className="shorts-title" title={video.title}>
            {video.title}
          </h4>
          <span className="shorts-views">{video.views}</span>
        </div>
      </div>
    </div>
  );
}
