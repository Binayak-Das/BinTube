import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  YouTubeLogo,
  MenuIcon,
  SearchIcon,
  UserIcon,
  LogOutIcon,
  CloseIcon,
  ArrowLeftIcon,
} from './Icons.jsx';
import { apiUrl } from '../config/api.js';

// Fallback popular topics for resilient suggestion display
const POPULAR_FALLBACK_TOPICS = [
  'music',
  'gaming',
  'tech reviews',
  'coding tutorials',
  'news live',
  'sports highlights',
  'animation movies',
  'podcasts',
  'documentaries',
  'react tutorial',
  'javascript course',
  'python programming',
  'mrbeast',
  'lofi hip hop radio',
  'funny comedy videos',
  'trailers 2026',
  'relaxing music',
  'speedrun',
  'live stream',
  'web development'
];

// Clean JSONP query to YouTube Suggest API (No CORS limitation, instant edge CDN response)
function fetchJsonpSuggestions(url, callbackParam = 'jsonp', timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve([]);

    const callbackName = `yt_suggest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let script = document.createElement('script');
    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      script = null;
    };

    window[callbackName] = (data) => {
      cleanup();
      try {
        if (Array.isArray(data) && Array.isArray(data[1])) {
          const list = data[1]
            .map((item) => (Array.isArray(item) ? item[0] : item))
            .filter((item) => typeof item === 'string' && item.trim().length > 0);
          resolve(list);
          return;
        }
      } catch (err) {
        console.warn('Error parsing JSONP suggestion payload:', err);
      }
      resolve([]);
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, timeoutMs);

    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}${callbackParam}=${callbackName}`;
    script.async = true;
    document.head.appendChild(script);
  });
}

// Matches user input with regular weight and highlights predicted completion in bold
function renderHighlightedSuggestion(item, query) {
  const q = (query || '').trim();
  if (!q) {
    return <span className="sug-matched">{item}</span>;
  }

  const itemLower = item.toLowerCase();
  const qLower = q.toLowerCase();

  if (itemLower.startsWith(qLower)) {
    const matchedPart = item.slice(0, q.length);
    const boldRemainder = item.slice(q.length);
    return (
      <span className="sug-text-wrapper">
        <span className="sug-matched">{matchedPart}</span>
        <strong className="sug-bold">{boldRemainder}</strong>
      </span>
    );
  }

  const idx = itemLower.indexOf(qLower);
  if (idx !== -1) {
    const before = item.slice(0, idx);
    const matchedPart = item.slice(idx, idx + q.length);
    const after = item.slice(idx + q.length);
    return (
      <span className="sug-text-wrapper">
        {before && <strong className="sug-bold">{before}</strong>}
        <span className="sug-matched">{matchedPart}</span>
        {after && <strong className="sug-bold">{after}</strong>}
      </span>
    );
  }

  return <span className="sug-matched">{item}</span>;
}

export default function Navbar({
  searchQuery,
  onSearch,
  _activePage,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  _watchLaterCount,
  onToggleSidebar,
}) {
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  const [typedQuery, setTypedQuery] = useState(searchQuery || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  const desktopContainerRef = useRef(null);
  const mobileContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map());
  const userTypedQueryRef = useRef(searchQuery || '');

  // Keep input in sync with external search query
  useEffect(() => {
    setSearchInput(searchQuery || '');
    setTypedQuery(searchQuery || '');
    userTypedQueryRef.current = searchQuery || '';
  }, [searchQuery]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Close dropdown on click or touch outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inDesktop =
        desktopContainerRef.current && desktopContainerRef.current.contains(e.target);
      const inMobile =
        mobileContainerRef.current && mobileContainerRef.current.contains(e.target);

      if (!inDesktop && !inMobile) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Resilient multi-tier suggestion fetcher
  const fetchSuggestions = useCallback(async (query) => {
    const clean = (query || '').trim();
    if (!clean) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    // Return cached immediately if present
    if (cacheRef.current.has(clean)) {
      const cached = cacheRef.current.get(clean);
      setSuggestions(cached);
      setIsDropdownOpen(cached.length > 0);
      return;
    }

    const currentReqId = ++requestIdRef.current;

    const commit = (list) => {
      if (currentReqId !== requestIdRef.current) return false;
      if (!userTypedQueryRef.current.trim()) return false;
      if (Array.isArray(list) && list.length > 0) {
        const unique = Array.from(new Set(list));
        cacheRef.current.set(clean, unique);
        setSuggestions(unique);
        setIsDropdownOpen(true);
        return true;
      }
      return false;
    };

    // Tier 1: YouTube Suggest API via JSONP (0 CORS, direct from YouTube, ultra fast)
    try {
      const ytList = await fetchJsonpSuggestions(
        `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=en&q=${encodeURIComponent(clean)}`,
        'jsonp',
        2000
      );
      if (commit(ytList)) return;
    } catch {
      // Continue to next tier
    }

    // Tier 2: Firefox YouTube format via JSONP
    try {
      const ffList = await fetchJsonpSuggestions(
        `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(clean)}`,
        'callback',
        1800
      );
      if (commit(ffList)) return;
    } catch {
      // Continue to next tier
    }

    // Tier 3: Local / Proxied Backend API
    try {
      const res = await fetch(
        apiUrl(`/api/videos/suggestions?q=${encodeURIComponent(clean)}`),
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          if (commit(data.suggestions)) return;
        }
      }
    } catch {
      // Continue to next tier
    }

    // Tier 4: Backend meta suggestions
    try {
      const resMeta = await fetch(
        apiUrl(`/api/videos/meta/suggestions?q=${encodeURIComponent(clean)}`),
        { headers: { Accept: 'application/json' } }
      );
      if (resMeta.ok) {
        const data = await resMeta.json();
        if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          if (commit(data.suggestions)) return;
        }
      }
    } catch {
      // Continue to next tier
    }

    // Tier 5: Fallback popular topics matching search text
    if (currentReqId === requestIdRef.current && userTypedQueryRef.current.trim()) {
      const lower = clean.toLowerCase();
      const topicMatches = POPULAR_FALLBACK_TOPICS.filter((t) =>
        t.toLowerCase().includes(lower)
      );
      if (topicMatches.length > 0) {
        commit(topicMatches);
        return;
      }

      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, []);

  // Responsive 150ms debounce handler
  const handleInputChange = (value) => {
    setSearchInput(value);
    setTypedQuery(value);
    userTypedQueryRef.current = value;
    setSelectedIndex(-1);
    setIsFocused(true);

    const clean = value.trim();
    if (!clean) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(clean);
    }, 150);
  };

  const executeSearch = (term) => {
    const finalTerm = (term !== undefined ? term : searchInput).trim();
    if (finalTerm) {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      setIsMobileSearchOpen(false);
      setSearchInput(finalTerm);
      setTypedQuery(finalTerm);
      userTypedQueryRef.current = finalTerm;
      onSearch(finalTerm);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      executeSearch(suggestions[selectedIndex]);
    } else {
      executeSearch();
    }
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < suggestions.length - 1 ? prev + 1 : 0;
        setSearchInput(suggestions[next]);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        if (prev <= 0) {
          setSearchInput(typedQuery);
          return -1;
        }
        const next = prev - 1;
        setSearchInput(suggestions[next]);
        return next;
      });
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      setSearchInput(typedQuery);
    }
  };

  const handleClear = () => {
    setSearchInput('');
    setTypedQuery('');
    userTypedQueryRef.current = '';
    setSuggestions([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestIdRef.current++;
    onSearch('');
  };

  return (
    <>
      {isMobileSearchOpen ? (
        <header className="navbar mobile-search-active">
          <button
            className="nav-icon-btn mobile-search-back-btn"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setIsDropdownOpen(false);
              setIsFocused(false);
            }}
            title="Back"
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div className="mobile-search-wrapper" ref={mobileContainerRef}>
            <form className="nav-search-bar mobile-search-bar" onSubmit={handleSubmit}>
              <div className={`search-input-box ${isFocused ? 'focused' : ''}`}>
                <div className="search-input-inner-icon">
                  <SearchIcon size={18} />
                </div>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search YouTube"
                  value={searchInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    setIsFocused(true);
                    if (searchInput.trim()) {
                      if (suggestions.length > 0) setIsDropdownOpen(true);
                      else fetchSuggestions(searchInput);
                    }
                  }}
                  onClick={() => {
                    setIsFocused(true);
                    if (searchInput.trim() && suggestions.length > 0) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                {searchInput && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={handleClear}
                    title="Clear"
                  >
                    <CloseIcon size={18} />
                  </button>
                )}

                {/* Mobile Suggestions Dropdown */}
                {isDropdownOpen && suggestions.length > 0 && (
                  <div className="search-suggestions-dropdown">
                    <div className="suggestions-list">
                      {suggestions.map((item, idx) => (
                        <div
                          key={`mob-sug-${idx}`}
                          className={`suggestion-item ${selectedIndex === idx ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            executeSearch(item);
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <div className="suggestion-icon">
                            <SearchIcon size={18} />
                          </div>
                          <div className="suggestion-text">
                            {renderHighlightedSuggestion(item, typedQuery || searchInput)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="suggestion-footer">
                      <span className="report-predictions-text">Report search predictions</span>
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="search-submit-btn" title="Search">
                <SearchIcon size={19} />
              </button>
            </form>
          </div>
        </header>
      ) : (
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

            <Link
              to="/"
              className="nav-logo-link"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                setSearchInput('');
                onNavigate('home');
              }}
              title="YouTube Home"
            >
              <YouTubeLogo />
            </Link>
          </div>

          {/* Center: Search Bar with YouTube Autocomplete & Predictions */}
          <div className="nav-search-container" ref={desktopContainerRef}>
            <form className="nav-search-bar" onSubmit={handleSubmit}>
              <div className={`search-input-box ${isFocused ? 'focused' : ''}`}>
                <div className="search-input-inner-icon">
                  <SearchIcon size={18} />
                </div>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search"
                  value={searchInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    setIsFocused(true);
                    if (searchInput.trim()) {
                      if (suggestions.length > 0) setIsDropdownOpen(true);
                      else fetchSuggestions(searchInput);
                    }
                  }}
                  onClick={() => {
                    setIsFocused(true);
                    if (searchInput.trim() && suggestions.length > 0) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={handleClear}
                    title="Clear"
                  >
                    <CloseIcon size={18} />
                  </button>
                )}

                {/* Suggestions Dropdown: Matches exact YouTube UI */}
                {isDropdownOpen && suggestions.length > 0 && (
                  <div className="search-suggestions-dropdown">
                    <div className="suggestions-list">
                      {suggestions.map((item, idx) => (
                        <div
                          key={`sug-${idx}`}
                          className={`suggestion-item ${selectedIndex === idx ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            executeSearch(item);
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <div className="suggestion-icon">
                            <SearchIcon size={18} />
                          </div>
                          <div className="suggestion-text">
                            {renderHighlightedSuggestion(item, typedQuery || searchInput)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="suggestion-footer">
                      <span className="report-predictions-text">Report search predictions</span>
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="search-submit-btn" title="Search">
                <SearchIcon size={19} />
              </button>
            </form>
          </div>

          {/* Right: Actions & User */}
          <div className="nav-actions">
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
      )}
    </>
  );
}
