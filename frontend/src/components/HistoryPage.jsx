import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HistoryIcon,
  PlayIcon,
  TrashIcon,
  ClockIcon,
  CheckIcon,
  SearchIcon,
  CloseIcon,
  UserIcon,
} from './Icons.jsx';
import VideoActionMenu from './VideoActionMenu.jsx';

function formatWatchedTime(dateStr) {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGroupLabel(dateStr) {
  if (!dateStr) return 'Today';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Today';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffTime = today - itemDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This week';
  if (diffDays <= 30) return 'This month';
  return 'Earlier';
}

export default function HistoryPage({
  videos = [],
  currentUser = null,
  onRequireAuth,
  onSelectVideo,
  onPlayPlaylist,
  onRemoveHistory,
  onClearAll,
  onExplore,
  watchLaterIds = [],
  onToggleWatchLater,
  onOpenSaveToPlaylist,
  onNotify,
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isPaused, setIsPaused] = useState(() => localStorage.getItem('yt_history_paused') === 'true');

  const handleTogglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    localStorage.setItem('yt_history_paused', next ? 'true' : 'false');
  };

  const filteredVideos = useMemo(() => {
    if (!searchFilter.trim()) return videos;
    const q = searchFilter.toLowerCase().trim();
    return videos.filter(
      (v) =>
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.channelName && v.channelName.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }, [videos, searchFilter]);

  // Group videos chronologically
  const groupedVideos = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    filteredVideos.forEach((video) => {
      const groupName = getGroupLabel(video.watchedAt);
      if (!currentGroup || currentGroup.name !== groupName) {
        currentGroup = { name: groupName, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(video);
    });

    return groups;
  }, [filteredVideos]);

  const hasVideos = videos && videos.length > 0;

  const handlePlayVideoAtIndex = (index) => {
    if (!filteredVideos || !filteredVideos[index]) return;
    if (onPlayPlaylist) {
      onPlayPlaylist(filteredVideos, index, 'Watch history', 'history');
    } else if (onSelectVideo) {
      onSelectVideo(filteredVideos[index]);
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
    <div className="history-page">
      {!currentUser ? (
        /* Signed-Out Restricted View (View history only if logged in) */
        <div className="history-empty-state history-signed-out-state">
          <div className="history-empty-icon-wrap">
            <HistoryIcon size={72} className="history-empty-icon" />
          </div>
          <h2 className="history-empty-title">Keep track of what you watch</h2>
          <p className="history-empty-subtitle">
            Watch history isn&rsquo;t viewable when signed out. Sign in to view your watch history and pick up where you left off.
          </p>
          <button
            type="button"
            className="history-signin-btn"
            onClick={onRequireAuth}
            title="Sign in to view watch history"
          >
            <UserIcon size={18} />
            <span>Sign in</span>
          </button>
        </div>
      ) : hasVideos ? (
        <div className="history-layout">
          {/* Main: History Video Feed */}
          <div className="history-main-column">
            <h1 className="history-page-heading">Watch history</h1>

            {filteredVideos.length === 0 ? (
              <div className="history-empty-filter">
                <p>No results found for &ldquo;{searchFilter}&rdquo;</p>
                <button
                  type="button"
                  className="history-clear-filter-btn"
                  onClick={() => setSearchFilter('')}
                >
                  Clear search
                </button>
              </div>
            ) : (
              groupedVideos.map((group) => (
                <div key={group.name} className="history-group-section">
                  <h3 className="history-group-title">{group.name}</h3>

                  <div className="history-items-list">
                    {group.items.map((video, idx) => {
                      const vId = video.videoId || video._id;
                      const isWatchLater = watchLaterIds.includes(vId);
                      const isAiVideo =
                        video.isAi ||
                        video.hasAiMark ||
                        /\b(ai|artificial intelligence|generative ai|sora|chatgpt)\b/i.test(
                          `${video.title || ''} ${video.description || ''}`
                        );

                      return (
                        <div key={`${vId}-${video.watchedAt || idx}`} className="history-video-row">
                          {/* Thumbnail */}
                          <Link
                            to={`/watch?v=${encodeURIComponent(vId)}`}
                            state={{ video }}
                            className="history-thumb-link"
                            onClick={(e) => handleLinkClick(e, video, idx)}
                          >
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="history-thumb-img"
                              loading="lazy"
                            />
                            <span className="duration-badge">{video.duration}</span>
                          </Link>

                          {/* Info */}
                          <div className="history-row-details">
                            <div className="history-title-row">
                              <Link
                                to={`/watch?v=${encodeURIComponent(vId)}`}
                                state={{ video }}
                                className="history-row-title"
                                onClick={(e) => handleLinkClick(e, video, idx)}
                                title={video.title}
                              >
                                {video.title}
                              </Link>

                              <div className="history-title-actions">
                                <button
                                  type="button"
                                  className="history-remove-btn"
                                  onClick={() => onRemoveHistory && onRemoveHistory(vId)}
                                  title="Remove from watch history"
                                >
                                  <CloseIcon size={18} />
                                </button>

                                <VideoActionMenu
                                  video={video}
                                  isWatchLater={isWatchLater}
                                  onToggleWatchLater={onToggleWatchLater}
                                  onOpenSaveToPlaylist={onOpenSaveToPlaylist}
                                  onNotify={onNotify}
                                  extraAction={{
                                    label: 'Remove from watch history',
                                    icon: <CloseIcon size={18} />,
                                    onClick: () => onRemoveHistory && onRemoveHistory(vId),
                                    danger: true,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="history-channel-meta">
                              <span className="history-channel-name">{video.channelName}</span>
                              <CheckIcon size={12} className="verified-icon" />
                              <span className="history-meta-dot">•</span>
                              <span className="history-views">{video.views}</span>
                              <span className="history-meta-dot">•</span>
                              <span className="history-watched-time">
                                Watched {formatWatchedTime(video.watchedAt)}
                              </span>
                            </div>

                            {video.description && (
                              <p className="history-row-description">
                                {video.description}
                              </p>
                            )}

                            <div className="history-row-actions">
                              {isAiVideo && (
                                <span className="history-ai-badge">AI</span>
                              )}
                              <button
                                type="button"
                                className={`history-action-btn ${isWatchLater ? 'active' : ''}`}
                                onClick={() => onToggleWatchLater && onToggleWatchLater(video)}
                                title={isWatchLater ? 'Remove from Watch Later' : 'Watch Later'}
                              >
                                <ClockIcon size={15} />
                                <span>{isWatchLater ? 'Added to Watch Later' : 'Watch Later'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: History Controls Sidebar */}
          <div className="history-sidebar-column">
            {/* Search History Box */}
            <div className="history-search-box">
              <SearchIcon size={18} className="history-search-icon" />
              <input
                type="text"
                placeholder="Search watch history"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="history-search-input"
              />
              {searchFilter && (
                <button
                  type="button"
                  className="history-search-clear"
                  onClick={() => setSearchFilter('')}
                >
                  <CloseIcon size={16} />
                </button>
              )}
            </div>

            <div className="history-sidebar-actions">
              <button
                type="button"
                className="history-control-item"
                onClick={onClearAll}
                title="Clear all watch history"
              >
                <TrashIcon size={18} />
                <span>Clear all watch history</span>
              </button>

              <button
                type="button"
                className={`history-control-item ${isPaused ? 'paused' : ''}`}
                onClick={handleTogglePause}
                title={isPaused ? 'Resume watch history' : 'Pause watch history'}
              >
                <HistoryIcon size={18} />
                <span>{isPaused ? 'Resume watch history' : 'Pause watch history'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State for Signed-in user */
        <div className="history-empty-state">
          <div className="history-empty-icon-wrap">
            <HistoryIcon size={72} className="history-empty-icon" />
          </div>
          <h2 className="history-empty-title">Your watch history is empty</h2>
          <p className="history-empty-subtitle">
            Videos you watch will appear here to help you pick up where you left off.
          </p>
          <button
            type="button"
            className="history-explore-btn"
            onClick={onExplore}
          >
            Explore videos
          </button>
        </div>
      )}
    </div>
  );
}

