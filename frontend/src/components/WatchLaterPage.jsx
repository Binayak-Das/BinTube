import React from 'react';
import { Link } from 'react-router-dom';
import { PlayIcon, TrashIcon, ClockIcon } from './Icons.jsx';

export default function WatchLaterPage({
  videos = [],
  onSelectVideo,
  onPlayPlaylist,
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
        <Link to="/" className="nav-btn primary" onClick={onExplore}>
          Explore Videos
        </Link>
      </div>
    );
  }

  const firstVideo = videos[0];
  const firstVideoId = firstVideo?.videoId || firstVideo?._id;

  const handlePlayVideoAtIndex = (index) => {
    if (!videos || !videos[index]) return;
    if (onPlayPlaylist) {
      onPlayPlaylist(videos, index, 'Watch Later', 'watch-later');
    } else if (onSelectVideo) {
      onSelectVideo(videos[index]);
    }
  };

  const handlePlayAllClick = (e) => {
    e.preventDefault();
    handlePlayVideoAtIndex(0);
  };

  const handleLinkClick = (e, video, index) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    handlePlayVideoAtIndex(index);
  };

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
        <div className="watch-later-details">
          <h2 className="watch-later-header-title">Watch Later</h2>
          <p className="watch-later-count-text">
            {videos.length} {videos.length === 1 ? 'video' : 'videos'} • Private playlist
          </p>

          <div className="watch-later-actions">
            <button
              type="button"
              className="watch-later-play-all"
              onClick={handlePlayAllClick}
              title="Play all videos"
            >
              <PlayIcon size={16} />
              <span>Play All</span>
            </button>
            <button
              type="button"
              className="watch-later-clear-btn"
              onClick={onClearAll}
              title="Clear Watch Later playlist"
            >
              <TrashIcon size={16} />
            </button>
          </div>
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
                onClick={(e) => handleLinkClick(e, video, index)}
              >
                <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
                <span className="duration-badge">{video.duration}</span>
              </div>

              <div
                className="watch-later-item-info"
                onClick={(e) => handleLinkClick(e, video, index)}
              >
                <h3 className="watch-later-item-title">{video.title}</h3>
                <p className="watch-later-item-channel">
                  {video.channelName} • {video.views}
                </p>
              </div>

              <button
                type="button"
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
