import React from 'react';
import { ClockIcon, DownloadIcon, CheckIcon } from './Icons.jsx';

export default function SearchResultsPage({
  searchQuery,
  videos = [],
  loading,
  hasMore,
  onSelectVideo,
  watchLaterIds = [],
  onToggleWatchLater,
  onDownload,
  sentinelRef,
}) {
  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <h2 className="search-query-title">
          Search results for: <span className="highlighted-query">"{searchQuery}"</span>
        </h2>
        <span className="results-count-badge">{videos.length} videos found</span>
      </div>

      {videos.length === 0 && loading ? (
        <div className="search-skeleton-list">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="search-video-skeleton">
              <div className="skeleton-thumb shimmer" />
              <div className="skeleton-details">
                <div className="skeleton-line title-line shimmer" />
                <div className="skeleton-line title-line-sub shimmer" />
                <div className="skeleton-line meta-line shimmer" />
                <div className="skeleton-channel-row">
                  <div className="skeleton-avatar shimmer" />
                  <div className="skeleton-line channel-line shimmer" />
                </div>
                <div className="skeleton-line desc-line shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 && !loading ? (
        <div className="empty-state">
          <h3 className="empty-state-title">No search results found</h3>
          <p className="empty-state-desc">
            Try different keywords or check your spelling.
          </p>
        </div>
      ) : (
        <div className="search-results-list">
          {videos.map((video, index) => {
            const vId = video.videoId || video._id;
            const isWatchLater = watchLaterIds.includes(vId);

            return (
              <article
                key={`search-${vId}-${index}`}
                className="search-video-row"
                onClick={() => onSelectVideo(video)}
              >
                {/* Left: Thumbnail */}
                <div className="search-thumb-box">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="search-thumb-img"
                    loading="lazy"
                  />
                  <span className="duration-badge">{video.duration}</span>

                  <div
                    className="card-quick-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
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

                {/* Right: Info */}
                <div className="search-row-info">
                  <h3 className="search-row-title" title={video.title}>
                    {video.title}
                  </h3>

                  <div className="search-row-meta">
                    <span>{video.views}</span> • <span>{video.uploadDate}</span>
                  </div>

                  <div className="search-row-channel">
                    <img
                      src={
                        video.channelAvatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          video.channelName
                        )}&background=cc0000&color=fff&size=60`
                      }
                      alt={video.channelName}
                      className="search-channel-avatar"
                    />
                    <span className="search-channel-name">{video.channelName}</span>
                    <CheckIcon size={13} className="verified-icon" />
                  </div>

                  <p className="search-row-desc">
                    {video.description || 'Watch on YouTube Clone with zero ad interruptions.'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="scroll-sentinel">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Loading more search results...</span>
          </div>
        )}
        {!hasMore && videos.length > 0 && (
          <span className="end-catalog-msg">No more search results.</span>
        )}
      </div>
    </div>
  );
}
