import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlaylistIcon,
  PlayIcon,
  TrashIcon,
  PlusIcon,
  ClockIcon,
  ArrowLeftIcon,
  CheckIcon,
} from './Icons.jsx';

export default function PlaylistsPage({
  playlists = [],
  onCreatePlaylist,
  onDeletePlaylist,
  onRemoveVideoFromPlaylist,
  onSelectVideo,
  onPlayPlaylist,
  onExplore,
  watchLaterIds = [],
  onToggleWatchLater,
}) {
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If a playlist is selected to view details
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) || null;

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreatePlaylist(newTitle.trim(), newDesc.trim());
      setNewTitle('');
      setNewDesc('');
      setIsCreateModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlayAll = (playlist) => {
    if (!playlist || !playlist.videos || playlist.videos.length === 0) return;
    if (onPlayPlaylist) {
      onPlayPlaylist(playlist.videos, 0, playlist.title, playlist.id);
    } else if (onSelectVideo) {
      onSelectVideo(playlist.videos[0]);
    }
  };

  const handlePlayVideoAtIndex = (playlist, index) => {
    if (!playlist || !playlist.videos || !playlist.videos[index]) return;
    if (onPlayPlaylist) {
      onPlayPlaylist(playlist.videos, index, playlist.title, playlist.id);
    } else if (onSelectVideo) {
      onSelectVideo(playlist.videos[index]);
    }
  };

  return (
    <div className="playlists-page-container">
      {/* Detail View of a Single Playlist */}
      {activePlaylist ? (
        <div className="playlist-detail-view">
          <div className="playlist-detail-nav">
            <button
              type="button"
              className="back-to-playlists-btn"
              onClick={() => setActivePlaylistId(null)}
            >
              <ArrowLeftIcon size={18} />
              <span>All playlists</span>
            </button>
          </div>

          <div className="liked-layout">
            {/* Left Banner */}
            <div className="liked-playlist-card">
              <div className="liked-cover-wrapper">
                {activePlaylist.videos && activePlaylist.videos.length > 0 ? (
                  <img
                    src={activePlaylist.videos[0].thumbnailUrl}
                    alt={activePlaylist.title}
                    className="liked-cover-img"
                  />
                ) : (
                  <div className="empty-playlist-cover">
                    <PlaylistIcon size={48} />
                  </div>
                )}
              </div>

              <div className="liked-playlist-details">
                <div className="liked-playlist-meta">
                  <h1 className="liked-playlist-title">{activePlaylist.title}</h1>
                  <p className="liked-owner-text">
                    {activePlaylist.description || 'Personal playlist'}
                  </p>
                  <div className="liked-stats-bar">
                    <span>
                      {(activePlaylist.videos || []).length}{' '}
                      {(activePlaylist.videos || []).length === 1 ? 'video' : 'videos'}
                    </span>
                    <span>•</span>
                    <span>Updated recently</span>
                  </div>
                </div>

                <div className="liked-playlist-actions">
                  <button
                    type="button"
                    className="liked-play-all-btn"
                    onClick={() => handlePlayAll(activePlaylist)}
                    disabled={!activePlaylist.videos || activePlaylist.videos.length === 0}
                    title="Play all videos in playlist"
                  >
                    <PlayIcon size={18} />
                    <span>Play all</span>
                  </button>

                  <button
                    type="button"
                    className="liked-clear-btn"
                    onClick={() => {
                      if (window.confirm(`Delete playlist "${activePlaylist.title}"?`)) {
                        onDeletePlaylist(activePlaylist.id);
                        setActivePlaylistId(null);
                      }
                    }}
                    title="Delete playlist"
                  >
                    <TrashIcon size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Ordered Videos List */}
            <div className="liked-videos-list-container">
              {activePlaylist.videos && activePlaylist.videos.length > 0 ? (
                <>
                  <div className="liked-list-header">
                    <span className="col-index">#</span>
                    <span className="col-title">Title</span>
                    <span className="col-actions">Actions</span>
                  </div>

                  <div className="liked-items-wrapper">
                    {activePlaylist.videos.map((video, idx) => {
                      const vId = video.videoId || video._id;
                      const isSaved = watchLaterIds.includes(vId);

                      return (
                        <div key={`pl-vid-${vId}-${idx}`} className="liked-video-row">
                          <span className="liked-row-index">{idx + 1}</span>

                          <div
                            className="liked-row-thumb-box"
                            onClick={() => handlePlayVideoAtIndex(activePlaylist, idx)}
                          >
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="liked-row-thumb"
                              loading="lazy"
                            />
                            <span className="duration-badge">{video.duration}</span>
                          </div>

                          <div
                            className="liked-row-info"
                            onClick={() => handlePlayVideoAtIndex(activePlaylist, idx)}
                          >
                            <h4 className="liked-row-title" title={video.title}>
                              {video.title}
                            </h4>
                            <p className="liked-row-channel">{video.channelName}</p>
                            <p className="liked-row-meta">
                              {video.views} • {video.uploadDate}
                            </p>
                          </div>

                          <div className="liked-row-actions">
                            <button
                              type="button"
                              className={`liked-row-btn ${isSaved ? 'active-wl' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleWatchLater(video);
                              }}
                              title={isSaved ? 'Remove from Watch Later' : 'Save to Watch Later'}
                            >
                              <ClockIcon size={16} />
                            </button>

                            <button
                              type="button"
                              className="liked-row-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveVideoFromPlaylist(activePlaylist.id, vId);
                              }}
                              title="Remove from playlist"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="empty-playlist-videos">
                  <PlaylistIcon size={44} />
                  <h3>This playlist is empty</h3>
                  <p>Save videos from the watch page or search results into this playlist.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Grid of All Playlists */
        <div className="playlists-overview">
          <div className="playlists-header">
            <div>
              <h1 className="playlists-title">Playlists</h1>
              <p className="playlists-subtitle">
                {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
              </p>
            </div>
            <button
              type="button"
              className="create-playlist-btn"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <PlusIcon size={18} />
              <span>New playlist</span>
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className="empty-playlists-container">
              <div className="empty-playlists-icon">
                <PlaylistIcon size={56} />
              </div>
              <h2 className="empty-playlists-heading">No playlists yet</h2>
              <p className="empty-playlists-text">
                Create a playlist to organize your favorite videos, songs, or tutorials.
              </p>
              <button
                type="button"
                className="create-playlist-btn large"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <PlusIcon size={18} />
                <span>Create playlist</span>
              </button>
            </div>
          ) : (
            <div className="playlists-grid">
              {playlists.map((pl) => {
                const count = pl.videoCount || (pl.videos || []).length;
                const cover = pl.coverThumbnail || (pl.videos && pl.videos[0]?.thumbnailUrl);

                return (
                  <div key={pl.id} className="playlist-card">
                    <div
                      className="playlist-card-thumb-wrapper"
                      onClick={() => setActivePlaylistId(pl.id)}
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={pl.title}
                          className="playlist-card-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="playlist-card-placeholder">
                          <PlaylistIcon size={38} />
                        </div>
                      )}
                      <div className="playlist-count-overlay">
                        <PlaylistIcon size={15} />
                        <span>{count} {count === 1 ? 'video' : 'videos'}</span>
                      </div>
                      {count > 0 && (
                        <div
                          className="playlist-play-hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAll(pl);
                          }}
                          title="Play all"
                        >
                          <PlayIcon size={24} />
                          <span>PLAY ALL</span>
                        </div>
                      )}
                    </div>

                    <div className="playlist-card-info">
                      <div className="playlist-card-title-row">
                        <h3
                          className="playlist-card-title"
                          onClick={() => setActivePlaylistId(pl.id)}
                          title={pl.title}
                        >
                          {pl.title}
                        </h3>
                        <button
                          type="button"
                          className="playlist-delete-icon-btn"
                          onClick={() => {
                            if (window.confirm(`Delete playlist "${pl.title}"?`)) {
                              onDeletePlaylist(pl.id);
                            }
                          }}
                          title="Delete playlist"
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                      <p className="playlist-card-desc">
                        {pl.description || 'Personal playlist'}
                      </p>
                      <button
                        type="button"
                        className="view-playlist-btn"
                        onClick={() => setActivePlaylistId(pl.id)}
                      >
                        View full playlist
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {isCreateModalOpen && (
        <div className="playlist-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="playlist-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="playlist-modal-header">
              <h3>Create new playlist</h3>
              <button
                type="button"
                className="playlist-modal-close"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="playlist-modal-form">
              <div className="playlist-input-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="Enter playlist title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                />
              </div>

              <div className="playlist-input-group">
                <label>Description (optional)</label>
                <textarea
                  placeholder="Tell viewers about this playlist..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="playlist-modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-create-btn"
                  disabled={!newTitle.trim() || submitting}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

