import React from 'react';
import { PlayIcon, TrashIcon, ClockIcon } from './Icons.jsx';

export default function WatchLaterPage({
  videos = [],
  onSelectVideo,
  onRemoveVideo,
  onClearAll,
  onExplore,
}) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ marginBottom: '16px', color: '#717171' }}>
          <ClockIcon size={56} />
        </div>
        <h2 className="empty-state-title">Your Watch Later playlist is empty</h2>
        <p className="empty-state-desc">
          Save interesting videos to watch later at your convenience without ads.
        </p>
        <button className="nav-btn primary" onClick={onExplore}>
          Explore Videos
        </button>
      </div>
    );
  }

  const firstVideo = videos[0];

  return (
    <div className="watch-later-layout">
      {/* Left Sidebar Overview */}
      <aside className="watch-later-sidebar">
        <div className="watch-later-cover">
          {firstVideo?.thumbnailUrl ? (
            <img src={firstVideo.thumbnailUrl} alt="Watch Later Cover" />
          ) : (
            <ClockIcon size={48} />
          )}
        </div>
        <h2 className="watch-later-header-title">Watch Later</h2>
        <p className="watch-later-count-text">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'} • Private playlist
        </p>

        <div className="watch-later-actions">
          <button
            className="watch-later-play-all"
            onClick={() => onSelectVideo(firstVideo)}
          >
            <PlayIcon size={16} />
            <span>Play All</span>
          </button>
          <button
            className="watch-later-clear-btn"
            onClick={onClearAll}
            title="Clear Watch Later playlist"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </aside>

      {/* Right List of Videos */}
      <main className="watch-later-list">
        {videos.map((video, index) => {
          const vId = video.videoId || video._id;
          return (
            <div key={`wl-${vId}-${index}`} className="watch-later-item">
              <span className="watch-later-index">{index + 1}</span>

              <div
                className="watch-later-thumb"
                onClick={() => onSelectVideo(video)}
              >
                <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
                <span className="duration-badge">{video.duration}</span>
              </div>

              <div
                className="watch-later-item-info"
                onClick={() => onSelectVideo(video)}
              >
                <h3 className="watch-later-item-title">{video.title}</h3>
                <p className="watch-later-item-channel">
                  {video.channelName} • {video.views}
                </p>
              </div>

              <button
                className="watch-later-remove-btn"
                onClick={() => onRemoveVideo(vId)}
                title="Remove from Watch Later"
              >
                <TrashIcon size={18} />
              </button>
            </div>
          );
        })}
      </main>
    </div>
  );
}
