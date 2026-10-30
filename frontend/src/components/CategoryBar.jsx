import React from 'react';

const CATEGORIES = [
  'All',
  'Trending',
  'Recent',
  'Music',
  'Gaming',
  'Tech',
  'Coding',
  'News',
  'Sports',
  'Animation',
  'Podcasts',
  'Documentaries',
];

export default function CategoryBar({ activeCategory, onSelectCategory }) {
  return (
    <div className="category-bar-wrapper">
      <div className="category-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
