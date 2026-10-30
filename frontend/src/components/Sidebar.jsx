import React from 'react';
import {
  HomeIcon,
  ClockIcon,
  FlameIcon,
  PlayIcon,
  YouTubeLogo,
  MenuIcon,
  SubscriptionsIcon,
  ThumbsUpIcon,
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

  const handleItemClick = (action) => {
    action();
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
        className={`yt-sidebar ${isOpen ? 'open' : 'closed'} ${
          isOverlay ? 'overlay-drawer' : ''
        }`}
      >
        {isOverlay && (
          <div className="drawer-header">
            <button className="nav-icon-btn" onClick={onClose} title="Close menu">
              <MenuIcon size={20} />
            </button>
            <YouTubeLogo />
          </div>
        )}

        {/* Primary Navigation */}
        <div className="sidebar-section">
          <button
            className={`sidebar-item ${
              activePage === 'home' && activeCategory === 'All' ? 'active' : ''
            }`}
            onClick={() =>
              handleItemClick(() => {
                onSelectCategory('All');
                onNavigate('home');
              })
            }
          >
            <HomeIcon size={20} />
            <span>Home</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === 'home' && activeCategory === 'Trending' ? 'active' : ''
            }`}
            onClick={() =>
              handleItemClick(() => {
                onSelectCategory('Trending');
                onNavigate('home');
              })
            }
          >
            <FlameIcon size={20} />
            <span>Trending</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === 'subscriptions' ? 'active' : ''
            }`}
            onClick={() =>
              handleItemClick(() => {
                onNavigate('subscriptions');
              })
            }
          >
            <SubscriptionsIcon size={20} />
            <span>Subscriptions</span>
            {subscriptionsCount > 0 && (
              <span className="sidebar-badge-neutral">{subscriptionsCount}</span>
            )}
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* You Section */}
        <div className="sidebar-section">
          <h4 className="sidebar-heading">You</h4>
          <button
            className={`sidebar-item ${
              activePage === 'liked' ? 'active' : ''
            }`}
            onClick={() =>
              handleItemClick(() => {
                onNavigate('liked');
              })
            }
          >
            <ThumbsUpIcon size={19} filled={activePage === 'liked'} />
            <span>Liked videos</span>
            {likedCount > 0 && (
              <span className="sidebar-badge">{likedCount}</span>
            )}
          </button>

          <button
            className={`sidebar-item ${
              activePage === 'watch-later' ? 'active' : ''
            }`}
            onClick={() =>
              handleItemClick(() => {
                onNavigate('watch-later');
              })
            }
          >
            <ClockIcon size={20} />
            <span>Watch Later</span>
            {watchLaterCount > 0 && (
              <span className="sidebar-badge">{watchLaterCount}</span>
            )}
          </button>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <h4 className="sidebar-heading">Explore</h4>
          {categories.map((cat) => (
            <button
              key={cat.name}
              className={`sidebar-item ${
                activePage === 'home' && activeCategory === cat.name ? 'active' : ''
              }`}
              onClick={() =>
                handleItemClick(() => {
                  onSelectCategory(cat.name);
                  onNavigate('home');
                })
              }
            >
              <PlayIcon size={16} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
