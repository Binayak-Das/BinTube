import React, { useState } from 'react';
import { PlaylistIcon, PlusIcon, CheckIcon } from './Icons.jsx';

export default function SaveToPlaylistModal({
  isOpen,
  onClose,
  video,
  playlists = [],
  onCreatePlaylist,
  onToggleVideoInPlaylist,
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !video) return null;

  const vId = video.videoId || video._id;

  const handleToggle = (playlist) => {
    const isSaved = (playlist.videos || []).some((v) => v.videoId === vId);
    if (onToggleVideoInPlaylist) {
      onToggleVideoInPlaylist(playlist.id, video, isSaved);
    }
  };

  const handleCreateNew = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onCreatePlaylist) {
        await onCreatePlaylist(newTitle.trim(), '', video);
      }
      setNewTitle('');
      setShowNewForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="playlist-modal-backdrop" onClick={onClose}>
      <div className="save-playlist-card" onClick={(e) => e.stopPropagation()}>
        <div className="playlist-modal-header">
          <h3>Save video to...</h3>
          <button type="button" className="playlist-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="save-playlist-list">
          {playlists.length === 0 && !showNewForm ? (
            <p className="no-playlists-note">No playlists found. Create one below!</p>
          ) : (
            playlists.map((pl) => {
              const isChecked = (pl.videos || []).some((v) => v.videoId === vId);
              return (
                <label key={pl.id} className="save-playlist-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(pl)}
                  />
                  <span className="save-playlist-checkbox">
                    {isChecked && <CheckIcon size={12} />}
                  </span>
                  <span className="save-playlist-name">{pl.title}</span>
                </label>
              );
            })
          )}
        </div>

        <div className="save-playlist-footer">
          {!showNewForm ? (
            <button
              type="button"
              className="open-new-playlist-form-btn"
              onClick={() => setShowNewForm(true)}
            >
              <PlusIcon size={16} />
              <span>Create new playlist</span>
            </button>
          ) : (
            <form onSubmit={handleCreateNew} className="quick-create-pl-form">
              <input
                type="text"
                placeholder="Playlist name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={80}
                required
                autoFocus
              />
              <div className="quick-create-actions">
                <button
                  type="button"
                  className="cancel-btn-sm"
                  onClick={() => setShowNewForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn-sm"
                  disabled={!newTitle.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

