import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, ClockIcon } from './Icons.jsx';
import VideoActionMenu from './VideoActionMenu.jsx';

export default function SearchResultsPage({
  searchQuery,
  videos = [],
  loading,
  hasMore,
  onSelectVideo,
  watchLaterIds = [],
  onToggleWatchLater,
  onOpenSaveToPlaylist,
  onNotify,
  sentinelRef,
}) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [hasResolved, setHasResolved] = useState(false);

  React.useEffect(() => {
    setHasResolved(false);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!loading && videos.length > 0) {
      setHasResolved(true);
    } else if (!loading && videos.length === 0) {
      // Buffer before deciding genuinely empty to handle background tab switch delays
      const t = setTimeout(() => {
        setHasResolved(true);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [loading, videos.length]);

  const showSkeletons = loading || !hasResolved || (videos.length === 0 && Boolean(searchQuery));

  return (
    <div className="search-results-page">
      {videos.length === 0 && showSkeletons ? (
        <div className="search-skeleton-list">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="search-video-skeleton">
              <div className="skeleton-thumb shimmer" />
              <div className="skeleton-details">
                <div className="skeleton-avatar mobile-skeleton-avatar shimmer" />
                <div className="skeleton-details-text">
                  <div className="skeleton-line title-line shimmer" />
                  <div className="skeleton-line title-line-sub shimmer" />
                  <div className="skeleton-line meta-line shimmer" />
                  <div className="skeleton-channel-row desktop-skeleton-channel">
                    <div className="skeleton-avatar shimmer" />
                    <div className="skeleton-line channel-line shimmer" />
                  </div>
                  <div className="skeleton-line desc-line shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 && !loading && hasResolved ? (
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

            const handleCardClick = (e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                return;
              }
              e.preventDefault();
              if (onSelectVideo) {
                onSelectVideo(video);
              }
            };

            const isAiVideo =
              video.isAi ||
              video.hasAiMark ||
              /\b(ai|artificial intelligence|generative ai|sora|chatgpt|midjourney|deepfake)\b/i.test(
                `${video.title || ''} ${video.description || ''}`
              );

            return (
              <Link
                key={`search-${vId}-${index}`}
                to={`/watch?v=${encodeURIComponent(vId)}`}
                state={{ video }}
                className="search-video-row"
                onClick={handleCardClick}
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
                  {isAiVideo && <span className="thumb-ai-badge">AI</span>}

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

                {/* Info Container */}
                <div className="search-row-info">
                  {/* Mobile Channel Avatar (displayed only on mobile phones) */}
                  <img
                    src={
                      video.channelAvatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        video.channelName
                      )}&background=cc0000&color=fff&size=80`
                    }
                    alt={video.channelName}
                    className="search-mobile-avatar"
                  />

                  <div className="search-row-main-content">
                    <div className="search-row-title-bar">
                      <h3 className="search-row-title" title={video.title}>
                        {video.title}
                      </h3>
                      <VideoActionMenu
                        video={video}
                        isWatchLater={isWatchLater}
                        onToggleWatchLater={onToggleWatchLater}
                        onOpenSaveToPlaylist={onOpenSaveToPlaylist}
                        onNotify={onNotify}
                      />
                    </div>

                    {/* Desktop Meta (views • date) */}
                    <div className="search-row-meta desktop-only-meta">
                      <span>{video.views}</span> • <span>{video.uploadDate}</span>
                    </div>

                    {/* Desktop Channel Row */}
                    <div className="search-row-channel desktop-only-channel">
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

                    {/* Mobile Combined Meta (Channel • Views • Time) */}
                    <div className="search-row-mobile-meta">
                      <span className="search-mobile-channel-name">{video.channelName}</span>
                      <span className="search-meta-dot">•</span>
                      <span>{video.views}</span>
                      <span className="search-meta-dot">•</span>
                      <span>{video.uploadDate}</span>
                    </div>

                    {video.description && (
                      <p className="search-row-desc">
                        {video.description}
                      </p>
                    )}

                    <div className="search-row-badges">
                      {isAiVideo && <span className="search-video-badge ai-badge">AI</span>}
                      <span className="search-video-badge">4K</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel: Render skeletons on load more instead of text spinners */}
      <div ref={sentinelRef} className="scroll-sentinel">
        {loading && (
          <div className="search-skeleton-list" style={{ marginTop: '16px' }}>
            {[1, 2, 3].map((i) => (
              <div key={`more-search-skel-${i}`} className="search-video-skeleton">
                <div className="skeleton-thumb shimmer" />
                <div className="skeleton-details">
                  <div className="skeleton-details-text">
                    <div className="skeleton-line title-line shimmer" />
                    <div className="skeleton-line meta-line shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!hasMore && videos.length > 0 && (
          <span className="end-catalog-msg">No more search results.</span>
        )}
      </div>
    </div>
  );
}
