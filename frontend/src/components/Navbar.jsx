import React, { useState } from 'react';
import { YouTubeLogo, MenuIcon, SearchIcon, UserIcon, LogOutIcon, CloseIcon, ArrowLeftIcon } from './Icons.jsx';

export default function Navbar({
  searchQuery,
  onSearch,
  activePage,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  watchLaterCount,
  onToggleSidebar,
}) {
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      setIsMobileSearchOpen(false);
    }
  };

  const handleClear = () => {
    setSearchInput('');
    onSearch('');
  };

  if (isMobileSearchOpen) {
    return (
      <header className="navbar mobile-search-active">
        <button
          className="nav-icon-btn mobile-search-back-btn"
          onClick={() => setIsMobileSearchOpen(false)}
          title="Back"
        >
          <ArrowLeftIcon size={20} />
        </button>
        <form className="nav-search-bar mobile-search-bar" onSubmit={handleSubmit}>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search YouTube"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            {searchInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClear}
                title="Clear"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
          <button type="submit" className="search-submit-btn" title="Search">
            <SearchIcon size={18} />
          </button>
        </form>
      </header>
    );
  }

  return (
    <header className="navbar">
      {/* Left: Menu & Logo */}
      <div className="nav-left">
        <button
          className="nav-icon-btn menu-btn"
          onClick={onToggleSidebar}
          title="Guide"
        >
          <MenuIcon size={20} />
        </button>

        <div
          onClick={() => {
            setSearchInput('');
            onNavigate('home');
          }}
          title="YouTube Home"
        >
          <YouTubeLogo />
        </div>
      </div>

      {/* Center: Search Bar (Desktop) */}
      <div className="nav-search-container">
        <form className="nav-search-bar" onSubmit={handleSubmit}>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClear}
                title="Clear"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
          <button type="submit" className="search-submit-btn" title="Search">
            <SearchIcon size={18} />
          </button>
        </form>
      </div>

      {/* Right: Actions & User */}
      <div className="nav-actions">
        {/* Mobile Search Button trigger */}
        <button
          className="nav-icon-btn mobile-search-trigger-btn"
          onClick={() => setIsMobileSearchOpen(true)}
          title="Search"
        >
          <SearchIcon size={20} />
        </button>

        {user ? (
          <div className="user-profile-pill" title={`Signed in as ${user.username}`}>
            <div className="user-avatar-small">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="user-name-label">{user.username}</span>
            <button
              onClick={onLogout}
              className="nav-signout-btn"
              title="Sign Out"
            >
              <LogOutIcon size={16} />
            </button>
          </div>
        ) : (
          <button
            className="yt-signin-btn"
            onClick={onOpenAuth}
            title="Sign in to YouTube"
          >
            <UserIcon size={18} />
            <span className="signin-text">Sign in</span>
          </button>
        )}
      </div>
    </header>
  );
}
