import React from 'react';
import {
  ThumbsUpIcon,
  PlayIcon,
  TrashIcon,
  ClockIcon,
  DownloadIcon,
  CheckIcon,
} from './Icons.jsx';

export default function LikedVideosPage({
  videos = [],
  onSelectVideo,
  onRemoveLike,
  onClearAll,
  onExplore,
  watchLaterIds = [],
  onToggleWatchLater,
  onDownload,
}) {
  const hasVideos = videos && videos.length > 0;
  const leadVideo = hasVideos ? videos[0] : null;

  const handlePlayAll = () => {
    if (hasVideos) {
      onSelectVideo(videos[0]);
    }
  };

  return (
    <div className="liked-videos-page">
      {hasVideos ? (
        <div className="liked-layout">
          {/* Left Column: Playlist Card Banner */}
          <div className="liked-playlist-card">
            <div className="liked-cover-wrapper">
              <img
                src={leadVideo.thumbnailUrl}
                alt="Liked Videos Playlist"
                className="liked-cover-img"
              />
              <div className="liked-cover-overlay">
                <ThumbsUpIcon size={36} filled={true} />
              </div>
            </div>

            <div className="liked-playlist-meta">
              <h1 className="liked-playlist-title">Liked videos</h1>
              <p className="liked-owner-text">Your Liked Playlist</p>
              <div className="liked-stats-bar">
                <span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}</span>
                <span>•</span>
                <span>Updated today</span>
              </div>
            </div>

            <div className="liked-playlist-actions">
              <button
                className="liked-play-all-btn"
                onClick={handlePlayAll}
                title="Play all liked videos"
              >
                <PlayIcon size={18} />
                <span>Play all</span>
              </button>

              <button
                className="liked-clear-btn"
                onClick={onClearAll}
                title="Clear all liked videos"
              >
                <TrashIcon size={16} />
                <span>Clear playlist</span>
              </button>
            </div>
          </div>

          {/* Right Column: Ordered Video Queue List */}
          <div className="liked-videos-list-container">
            <div className="liked-list-header">
              <span className="col-index">#</span>
              <span className="col-title">Title</span>
              <span className="col-actions">Actions</span>
            </div>

            <div className="liked-items-wrapper">
              {videos.map((video, index) => {
                const vId = video.videoId || video._id;
                const isSavedToWatchLater = watchLaterIds.includes(vId);

                return (
                  <div key={`liked-${vId}-${index}`} className="liked-video-row">
                    {/* Index Number */}
                    <span className="liked-row-index">{index + 1}</span>

                    {/* Thumbnail */}
                    <div
                      className="liked-row-thumb-box"
                      onClick={() => onSelectVideo(video)}
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="liked-row-thumb"
                        loading="lazy"
                      />
                      <span className="duration-badge">{video.duration}</span>
                      <div className="thumb-hover-overlay">
                        <PlayIcon size={20} />
                      </div>
                    </div>

                    {/* Info */}
                    <div
                      className="liked-row-info"
                      onClick={() => onSelectVideo(video)}
                    >
                      <h3 className="liked-row-title" title={video.title}>
                        {video.title}
                      </h3>
                      <div className="liked-row-channel">
                        <span>{video.channelName}</span>
                        <CheckIcon size={12} />
                      </div>
                      <div className="liked-row-meta">
                        <span>{video.views}</span>
                        <span>•</span>
                        <span>{video.uploadDate}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="liked-row-actions">
                      {/* Unlike / Remove */}
                      <button
                        className="liked-row-btn active-like"
                        onClick={() => onRemoveLike(vId)}
                        title="Remove from Liked videos"
                      >
                        <ThumbsUpIcon size={16} filled={true} />
                      </button>

                      {/* Watch Later */}
                      <button
                        className={`liked-row-btn ${isSavedToWatchLater ? 'active-wl' : ''}`}
                        onClick={() => onToggleWatchLater(video)}
                        title={
                          isSavedToWatchLater
                            ? 'Remove from Watch Later'
                            : 'Save to Watch Later'
                        }
                      >
                        <ClockIcon size={16} />
                      </button>

                      {/* Download */}
                      <button
                        className="liked-row-btn"
                        onClick={() => onDownload(video)}
                        title="Download Video"
                      >
                        <DownloadIcon size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="empty-liked-container">
          <div className="empty-liked-icon-box">
            <ThumbsUpIcon size={56} filled={true} />
          </div>
          <h2 className="empty-liked-title">No liked videos yet</h2>
          <p className="empty-liked-desc">
            Tap the thumbs up icon on any video you enjoy to add it to your Liked videos playlist.
          </p>
          <button className="nav-btn primary" onClick={onExplore}>
            Explore Trending Videos
          </button>
        </div>
      )}
    </div>
  );
}
