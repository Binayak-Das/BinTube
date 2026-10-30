import React from 'react';
import { Link } from 'react-router-dom';
import {
  ThumbsUpIcon,
  PlayIcon,
  TrashIcon,
  ClockIcon,
  CheckIcon,
} from './Icons.jsx';

export default function LikedVideosPage({
  videos = [],
  onSelectVideo,
  onPlayPlaylist,
  onRemoveLike,
  onClearAll,
  onExplore,
  watchLaterIds = [],
  onToggleWatchLater,
}) {
  const hasVideos = videos && videos.length > 0;
  const leadVideo = hasVideos ? videos[0] : null;
  const leadVideoId = leadVideo?.videoId || leadVideo?._id;

  const handlePlayVideoAtIndex = (index) => {
    if (!videos || !videos[index]) return;
    if (onPlayPlaylist) {
      onPlayPlaylist(videos, index, 'Liked videos', 'liked');
    } else if (onSelectVideo) {
      onSelectVideo(videos[index]);
    }
  };

  const handlePlayAllClick = (e) => {
    e.preventDefault();
    if (hasVideos) {
      handlePlayVideoAtIndex(0);
    }
  };

  const handleLinkClick = (e, video, index) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    handlePlayVideoAtIndex(index);
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

            <div className="liked-playlist-details">
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
                  type="button"
                  className="liked-play-all-btn"
                  onClick={handlePlayAllClick}
                  title="Play all liked videos"
                >
                  <PlayIcon size={18} />
                  <span>Play all</span>
                </button>

                <button
                  type="button"
                  className="liked-clear-btn"
                  onClick={onClearAll}
                  title="Clear all liked videos"
                >
                  <TrashIcon size={16} />
                  <span>Clear playlist</span>
                </button>
              </div>
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
                      onClick={(e) => handleLinkClick(e, video, index)}
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
                      onClick={(e) => handleLinkClick(e, video, index)}
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
                        type="button"
                        className="liked-row-btn active-like"
                        onClick={() => onRemoveLike(vId)}
                        title="Remove from Liked videos"
                      >
                        <ThumbsUpIcon size={16} filled={true} />
                      </button>

                      {/* Watch Later */}
                      <button
                        type="button"
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
          <Link to="/" className="nav-btn primary" onClick={onExplore}>
            Explore Trending Videos
          </Link>
        </div>
      )}
    </div>
  );
}
