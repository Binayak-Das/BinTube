import React from 'react';
import { Link } from 'react-router-dom';
import {
  HomeIcon,
  ShortsIcon,
  ClockIcon,
  FlameIcon,
  PlayIcon,
  YouTubeLogo,
  MenuIcon,
  SubscriptionsIcon,
  ThumbsUpIcon,
  PlaylistIcon,
  HistoryIcon,
} from './Icons.jsx';

export default function Sidebar({
  isOpen,
  isOverlay = false,
  onClose,
  activePage,
  activeCategory,
  onNavigate,
  onSelectCategory,
  watchLaterCount = 0,
  likedCount = 0,
  subscriptionsCount = 0,
  playlistsCount = 0,
  historyCount = 0,
}) {
  const categories = [
    { name: 'Music', label: 'Music' },
    { name: 'Gaming', label: 'Gaming' },
    { name: 'Tech', label: 'Technology' },
    { name: 'Coding', label: 'Coding' },
    { name: 'News', label: 'News' },
    { name: 'Sports', label: 'Sports' },
    { name: 'Animation', label: 'Animation' },
    { name: 'Podcasts', label: 'Podcasts' },
  ];

  const handleLinkClick = (e, action) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      if (isOverlay && onClose) onClose();
      return;
    }
    if (action) action();
    if (isOverlay && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for overlay drawer mode */}
      {isOverlay && isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside
        className={`yt-sidebar ${isOpen ? 'open' : 'closed'} ${isOverlay ? 'overlay-drawer' : ''
          }`}
        style={
          isOverlay && !isOpen
            ? { visibility: 'hidden', boxShadow: 'none', pointerEvents: 'none' }
            : undefined
        }
      >
        {isOverlay && (
          <div className="drawer-header">
            <button className="nav-icon-btn" onClick={onClose} title="Close menu">
              <MenuIcon size={20} />
            </button>
            <Link
              to="/"
              onClick={(e) =>
                handleLinkClick(e, () => {
                  onSelectCategory('All');
                  onNavigate('home');
                })
              }
              title="YouTube Home"
            >
              <YouTubeLogo />
            </Link>
          </div>
        )}

        {/* Primary Navigation */}
        <div className="sidebar-section">
          <Link
            to="/"
            className={`sidebar-item ${activePage === 'home' && activeCategory === 'All' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onSelectCategory('All');
                onNavigate('home');
              })
            }
          >
            <HomeIcon size={20} />
            <span>Home</span>
          </Link>

          <Link
            to="/shorts"
            className={`sidebar-item ${activePage === 'shorts' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('shorts');
              })
            }
          >
            <ShortsIcon size={20} color={activePage === 'shorts' ? '#ff0000' : 'currentColor'} />
            <span>Shorts</span>
          </Link>

          <Link
            to="/?category=Trending"
            className={`sidebar-item ${activePage === 'home' && activeCategory === 'Trending' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onSelectCategory('Trending');
                onNavigate('home');
              })
            }
          >
            <FlameIcon size={20} />
            <span>Trending</span>
          </Link>

        </div>

        <div className="sidebar-divider" />

        {/* You Section */}
        <div className="sidebar-section">
          <h4 className="sidebar-heading">You</h4>
          <Link
            to="/subscriptions"
            className={`sidebar-item ${activePage === 'subscriptions' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('subscriptions');
              })
            }
          >
            <SubscriptionsIcon size={20} />
            <span>Subscriptions</span>
          </Link>

          <Link
            to="/history"
            className={`sidebar-item ${activePage === 'history' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('history');
              })
            }
          >
            <HistoryIcon size={20} />
            <span>History</span>
          </Link>

          <Link
            to="/liked"
            className={`sidebar-item ${activePage === 'liked' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('liked');
              })
            }
          >
            <ThumbsUpIcon size={19} filled={activePage === 'liked'} />
            <span>Liked videos</span>
          </Link>

          <Link
            to="/watch-later"
            className={`sidebar-item ${activePage === 'watch-later' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('watch-later');
              })
            }
          >
            <ClockIcon size={20} />
            <span>Watch Later</span>
          </Link>

          <Link
            to="/playlists"
            className={`sidebar-item ${activePage === 'playlists' ? 'active' : ''
              }`}
            onClick={(e) =>
              handleLinkClick(e, () => {
                onNavigate('playlists');
              })
            }
          >
            <PlaylistIcon size={20} />
            <span>Playlists</span>
          </Link>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <h4 className="sidebar-heading">Explore</h4>
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/?category=${encodeURIComponent(cat.name)}`}
              className={`sidebar-item ${activePage === 'home' && activeCategory === cat.name ? 'active' : ''
                }`}
              onClick={(e) =>
                handleLinkClick(e, () => {
                  onSelectCategory(cat.name);
                  onNavigate('home');
                })
              }
            >
              <PlayIcon size={16} />
              <span>{cat.label}</span>
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
