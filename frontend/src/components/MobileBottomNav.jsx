import React from 'react';
import { HomeIcon, ShortsIcon, SubscriptionsIcon, UserIcon } from './Icons.jsx';

export default function MobileBottomNav({
  activePage,
  onNavigate,
  currentUser = null,
  onRequireAuth,
}) {
  const userInitial = currentUser?.username
    ? currentUser.username.charAt(0).toUpperCase()
    : currentUser?.name
    ? currentUser.name.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      {/* Home */}
      <button
        type="button"
        className={`mobile-nav-item ${activePage === 'home' ? 'active' : ''}`}
        onClick={() => onNavigate('home')}
      >
        <HomeIcon size={22} />
        <span>Home</span>
      </button>

      {/* Shorts */}
      <button
        type="button"
        className={`mobile-nav-item ${activePage === 'shorts' ? 'active' : ''}`}
        onClick={() => onNavigate('shorts')}
      >
        <ShortsIcon size={22} color={activePage === 'shorts' ? '#ff0000' : 'currentColor'} />
        <span>Shorts</span>
      </button>

      {/* Subscriptions */}
      <button
        type="button"
        className={`mobile-nav-item ${activePage === 'subscriptions' ? 'active' : ''}`}
        onClick={() => onNavigate('subscriptions')}
      >
        <SubscriptionsIcon size={22} />
        <span>Subscriptions</span>
      </button>

      {/* You (Profile / History / Library) */}
      <button
        type="button"
        className={`mobile-nav-item ${
          ['history', 'liked', 'playlists', 'watch-later'].includes(activePage) ? 'active' : ''
        }`}
        onClick={() => {
          if (currentUser) {
            onNavigate('history');
          } else if (onRequireAuth) {
            onRequireAuth();
          } else {
            onNavigate('history');
          }
        }}
      >
        {userInitial ? (
          <div className="mobile-user-avatar-badge">{userInitial}</div>
        ) : (
          <UserIcon size={22} />
        )}
        <span>You</span>
      </button>
    </nav>
  );
}

