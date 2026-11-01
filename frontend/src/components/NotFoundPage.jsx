import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon, HomeIcon, YouTubeLogo } from './Icons.jsx';

export default function NotFoundPage({ onNavigateHome, onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        {/* YouTube Broken TV Graphic */}
        <div className="not-found-graphic">
          <svg
            width="160"
            height="140"
            viewBox="0 0 160 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="not-found-svg"
          >
            {/* TV Antenna */}
            <line x1="80" y1="36" x2="48" y2="12" stroke="#606060" strokeWidth="3" strokeLinecap="round" />
            <line x1="80" y1="36" x2="112" y2="12" stroke="#606060" strokeWidth="3" strokeLinecap="round" />
            <circle cx="48" cy="12" r="4" fill="#cc0000" />
            <circle cx="112" cy="12" r="4" fill="#cc0000" />

            {/* TV Body */}
            <rect x="20" y="36" width="120" height="84" rx="14" fill="#212121" stroke="#333333" strokeWidth="2" />
            <rect x="28" y="44" width="86" height="68" rx="8" fill="#121212" />

            {/* Screen static lines */}
            <path d="M36 58H106" stroke="#2a2a2a" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M36 78H106" stroke="#2a2a2a" strokeWidth="2" strokeDasharray="6 3" />
            <path d="M36 98H106" stroke="#2a2a2a" strokeWidth="2" strokeDasharray="3 5" />

            {/* 404 on Screen */}
            <text
              x="71"
              y="85"
              fill="#666666"
              fontSize="24"
              fontWeight="800"
              textAnchor="middle"
              fontFamily="monospace"
              letterSpacing="2"
            >
              404
            </text>

            {/* TV Controls */}
            <circle cx="125" cy="56" r="5" fill="#383838" />
            <circle cx="125" cy="72" r="5" fill="#383838" />
            <rect x="122" y="86" width="6" height="18" rx="3" fill="#2e2e2e" />

            {/* TV Stand Feet */}
            <polygon points="40,120 32,130 46,130" fill="#383838" />
            <polygon points="120,120 114,130 128,130" fill="#383838" />
          </svg>
        </div>

        <h1 className="not-found-title">This page isn&rsquo;t available. Sorry about that.</h1>
        <p className="not-found-desc">
          The link you followed may be broken, or the page may have been removed. Try searching for something else.
        </p>

        {/* Quick Search on 404 */}
        <form onSubmit={handleSubmit} className="not-found-search-form">
          <input
            type="text"
            className="not-found-search-input"
            placeholder="Search YouTube"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="not-found-search-btn" title="Search">
            <SearchIcon size={18} />
          </button>
        </form>

        {/* Action Buttons */}
        <div className="not-found-actions">
          <button
            type="button"
            className="not-found-home-btn"
            onClick={onNavigateHome}
          >
            <HomeIcon size={18} />
            <span>Go to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}

