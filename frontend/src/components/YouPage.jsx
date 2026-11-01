import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserIcon,
  LogOutIcon,
  ClockIcon,
  SubscriptionsIcon,
  ThumbsUpIcon,
  PlaylistIcon,
  HistoryIcon,
  PlayIcon,
} from './Icons.jsx';

export default function YouPage({
  currentUser,
  onLogout,
  onOpenAuth,
  onNavigate,
  historyVideos = [],
  watchLaterCount = 0,
  likedCount = 0,
  subscriptionsCount = 0,
  playlists = [],
  onSelectVideo,
  onNotify,
}) {
  const userInitial = currentUser?.username
    ? currentUser.username.charAt(0).toUpperCase()
    : currentUser?.name
    ? currentUser.name.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : null;

  const displayName = currentUser?.name || currentUser?.username || 'User';
  const handleText = currentUser?.username
    ? `@${currentUser.username}`
    : currentUser?.email
    ? currentUser.email.split('@')[0]
    : '';

  const handleShortcutClick = (targetPage) => {
    if (['history', 'watch-later', 'liked', 'playlists'].includes(targetPage) && !currentUser) {
      if (typeof onNotify === 'function') {
        onNotify(`Please sign in to view your ${targetPage.replace('-', ' ')}`);
      }
      if (typeof onOpenAuth === 'function') {
        onOpenAuth();
      }
      return;
    }
    if (typeof onNavigate === 'function') {
      onNavigate(targetPage);
    }
  };

  return (
    <div className="you-page-container">
      {/* Profile Details Header */}
      <section className="you-profile-card">
        {currentUser ? (
          <div className="you-profile-content">
            <div className="you-avatar-box">
              <div className="you-avatar-large">
                {userInitial}
              </div>
            </div>
            <div className="you-profile-info">
              <h1 className="you-profile-name">{displayName}</h1>
              <div className="you-profile-meta">
                {handleText && <span className="you-handle">{handleText}</span>}
                {currentUser.email && (
                  <>
                    <span className="you-dot">•</span>
                    <span className="you-email">{currentUser.email}</span>
                  </>
                )}
              </div>
              <div className="you-profile-actions">
                <button
                  type="button"
                  className="you-logout-btn"
                  onClick={onLogout}
                  title="Sign out of this account"
                >
                  <LogOutIcon size={16} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="you-signed-out-card">
            <div className="you-avatar-placeholder">
              <UserIcon size={38} />
            </div>
            <div className="you-signed-out-info">
              <h2 className="you-signed-out-title">You're not signed in</h2>
              <p className="you-signed-out-desc">
                Sign in to view your history, saved playlists, liked videos, and subscriptions.
              </p>
              <button
                type="button"
                className="you-signin-btn"
                onClick={onOpenAuth}
              >
                <UserIcon size={18} />
                <span>Sign in</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Recent History Horizontal Carousel (Only if user has history) */}
      {currentUser && historyVideos.length > 0 && (
        <section className="you-shelf-section">
          <div className="you-shelf-header">
            <div className="you-shelf-title-wrap" onClick={() => onNavigate('history')}>
              <h2 className="you-shelf-title">History</h2>
              <span className="you-shelf-badge">{historyVideos.length}</span>
            </div>
            <button
              type="button"
              className="you-shelf-see-all-btn"
              onClick={() => onNavigate('history')}
            >
              View all
            </button>
          </div>
          <div className="you-shelf-carousel">
            {historyVideos.slice(0, 10).map((v, idx) => {
              const vId = v.videoId || v._id;
              return (
                <Link
                  key={`you-hist-${vId}-${idx}`}
                  to={`/watch?v=${vId}`}
                  className="you-carousel-card"
                  onClick={() => onSelectVideo && onSelectVideo(v)}
                >
                  <div className="you-card-thumb-wrap">
                    <img
                      src={v.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`}
                      alt={v.title}
                      className="you-card-thumb"
                      loading="lazy"
                    />
                    {v.duration && <span className="you-card-duration">{v.duration}</span>}
                  </div>
                  <h3 className="you-card-title" title={v.title}>
                    {v.title}
                  </h3>
                  <p className="you-card-channel">{v.channelName}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Playlists Horizontal Carousel (Only if user has playlists) */}
      {currentUser && playlists.length > 0 && (
        <section className="you-shelf-section">
          <div className="you-shelf-header">
            <div className="you-shelf-title-wrap" onClick={() => onNavigate('playlists')}>
              <h2 className="you-shelf-title">Playlists</h2>
              <span className="you-shelf-badge">{playlists.length}</span>
            </div>
            <button
              type="button"
              className="you-shelf-see-all-btn"
              onClick={() => onNavigate('playlists')}
            >
              View all
            </button>
          </div>
          <div className="you-shelf-carousel">
            {playlists.slice(0, 8).map((p, idx) => {
              const coverThumb =
                p.videos?.[0]?.thumbnailUrl ||
                `https://i.ytimg.com/vi/${p.videos?.[0]?.videoId || 'default'}/hqdefault.jpg`;
              return (
                <div
                  key={`you-pl-${p._id || idx}`}
                  className="you-carousel-card you-playlist-card"
                  onClick={() => onNavigate('playlists')}
                >
                  <div className="you-card-thumb-wrap">
                    <img
                      src={coverThumb}
                      alt={p.title}
                      className="you-card-thumb"
                      loading="lazy"
                    />
                    <div className="you-playlist-count-overlay">
                      <PlaylistIcon size={14} />
                      <span>{p.videos?.length || 0}</span>
                    </div>
                  </div>
                  <h3 className="you-card-title">{p.title}</h3>
                  <p className="you-card-channel">Playlist • {p.videos?.length || 0} videos</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Shortcuts Menu Rows */}
      <section className="you-shortcuts-section">
        <h2 className="you-shortcuts-heading">Your Library & Shortcuts</h2>
        <div className="you-shortcuts-list">
          {/* History */}
          <button
            type="button"
            className="you-shortcut-row"
            onClick={() => handleShortcutClick('history')}
          >
            <div className="you-shortcut-left">
              <div className="you-shortcut-icon-box">
                <HistoryIcon size={22} />
              </div>
              <div className="you-shortcut-text-box">
                <span className="you-shortcut-label">History</span>
                <span className="you-shortcut-sub">
                  {currentUser ? `${historyVideos.length} videos` : 'Sign in to view'}
                </span>
              </div>
            </div>
            <div className="you-shortcut-right">
              {currentUser && historyVideos.length > 0 && (
                <span className="you-count-pill">{historyVideos.length}</span>
              )}
              <span className="you-shortcut-chevron">›</span>
            </div>
          </button>

          {/* Playlists */}
          <button
            type="button"
            className="you-shortcut-row"
            onClick={() => handleShortcutClick('playlists')}
          >
            <div className="you-shortcut-left">
              <div className="you-shortcut-icon-box">
                <PlaylistIcon size={22} />
              </div>
              <div className="you-shortcut-text-box">
                <span className="you-shortcut-label">Playlists</span>
                <span className="you-shortcut-sub">
                  {currentUser ? `${playlists.length} playlists` : 'Sign in to view'}
                </span>
              </div>
            </div>
            <div className="you-shortcut-right">
              {currentUser && playlists.length > 0 && (
                <span className="you-count-pill">{playlists.length}</span>
              )}
              <span className="you-shortcut-chevron">›</span>
            </div>
          </button>

          {/* Watch Later */}
          <button
            type="button"
            className="you-shortcut-row"
            onClick={() => handleShortcutClick('watch-later')}
          >
            <div className="you-shortcut-left">
              <div className="you-shortcut-icon-box">
                <ClockIcon size={22} />
              </div>
              <div className="you-shortcut-text-box">
                <span className="you-shortcut-label">Watch Later</span>
                <span className="you-shortcut-sub">
                  {currentUser ? `${watchLaterCount} saved videos` : 'Sign in to view'}
                </span>
              </div>
            </div>
            <div className="you-shortcut-right">
              {currentUser && watchLaterCount > 0 && (
                <span className="you-count-pill">{watchLaterCount}</span>
              )}
              <span className="you-shortcut-chevron">›</span>
            </div>
          </button>

          {/* Liked Videos */}
          <button
            type="button"
            className="you-shortcut-row"
            onClick={() => handleShortcutClick('liked')}
          >
            <div className="you-shortcut-left">
              <div className="you-shortcut-icon-box">
                <ThumbsUpIcon size={22} />
              </div>
              <div className="you-shortcut-text-box">
                <span className="you-shortcut-label">Liked videos</span>
                <span className="you-shortcut-sub">
                  {currentUser ? `${likedCount} liked videos` : 'Sign in to view'}
                </span>
              </div>
            </div>
            <div className="you-shortcut-right">
              {currentUser && likedCount > 0 && (
                <span className="you-count-pill">{likedCount}</span>
              )}
              <span className="you-shortcut-chevron">›</span>
            </div>
          </button>

          {/* Subscriptions */}
          <button
            type="button"
            className="you-shortcut-row"
            onClick={() => handleShortcutClick('subscriptions')}
          >
            <div className="you-shortcut-left">
              <div className="you-shortcut-icon-box">
                <SubscriptionsIcon size={22} />
              </div>
              <div className="you-shortcut-text-box">
                <span className="you-shortcut-label">Subscriptions</span>
                <span className="you-shortcut-sub">
                  {`${subscriptionsCount} channels`}
                </span>
              </div>
            </div>
            <div className="you-shortcut-right">
              {subscriptionsCount > 0 && (
                <span className="you-count-pill">{subscriptionsCount}</span>
              )}
              <span className="you-shortcut-chevron">›</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

