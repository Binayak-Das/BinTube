import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, CheckIcon, MoreVerticalIcon, PlaylistIcon, ShareIcon } from './Icons.jsx';

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleShare = async (video) => {
    if (!video) return;
    const vId = video.videoId || video._id;
    if (!vId) return;
    const origin = window.location.origin || 'http://localhost:5173';
    const shareUrl = `${origin}/watch?v=${encodeURIComponent(vId)}`;
    const shareTitle = video.title || 'Check out this video';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareTitle,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.code === 20)) {
          return;
        }
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (typeof onNotify === 'function') {
          onNotify('Link copied to clipboard');
        }
        return;
      } catch (_) {}
    }

    try {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      if (typeof onNotify === 'function') {
        onNotify('Link copied to clipboard');
      }
    } catch (_) {
      if (typeof onNotify === 'function') {
        onNotify(`Link: ${shareUrl}`);
      }
    }
  };
  return (
    <div className="search-results-page">
      {videos.length === 0 && loading ? (
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

            const handleCardClick = (e) => {
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
                      <div className="search-more-menu-container">
                        <button
                          type="button"
                          className={`search-row-more-btn ${openMenuId === vId ? 'menu-active' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === vId ? null : vId);
                          }}
                          title="More options"
                        >
                          <MoreVerticalIcon size={18} />
                        </button>

                        {openMenuId === vId && (
                          <div
                            className="search-more-dropdown"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className="search-dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onToggleWatchLater(video);
                              }}
                            >
                              <ClockIcon size={18} />
                              <span>{isWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}</span>
                            </button>

                            <button
                              type="button"
                              className="search-dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                if (onOpenSaveToPlaylist) {
                                  onOpenSaveToPlaylist(video);
                                }
                              }}
                            >
                              <PlaylistIcon size={18} />
                              <span>Save to playlist</span>
                            </button>

                            <button
                              type="button"
                              className="search-dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleShare(video);
                              }}
                            >
                              <ShareIcon size={18} />
                              <span>Share</span>
                            </button>
                          </div>
                        )}
                      </div>
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
                      <span className="search-video-badge">4K</span>
                    </div>
                  </div>
                </div>
              </Link>
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
