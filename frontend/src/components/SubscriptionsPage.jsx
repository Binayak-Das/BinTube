import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoCard from './VideoCard.jsx';
import { SubscriptionsIcon, CheckIcon, UserIcon } from './Icons.jsx';
import { apiUrl } from '../config/api.js';

export default function SubscriptionsPage({
  subscribedChannels = [],
  currentUser = null,
  onRequireAuth,
  onToggleSubscribe,
  onSelectVideo,
  watchLaterIds = [],
  onToggleWatchLater,
  onExplore,
  onOpenSaveToPlaylist,
  onNotify,
}) {
  if (!currentUser) {
    return (
      <div className="history-empty-state history-signed-out-state">
        <div className="history-empty-icon-wrap">
          <SubscriptionsIcon size={72} className="history-empty-icon" />
        </div>
        <h2 className="history-empty-title">Don't miss new videos</h2>
        <p className="history-empty-subtitle">
          Sign in to see updates from your favorite YouTube channels and access your subscriptions.
        </p>
        <button
          type="button"
          className="history-signin-btn"
          onClick={onRequireAuth}
          title="Sign in to view subscriptions"
        >
          <UserIcon size={18} />
          <span>Sign in</span>
        </button>
      </div>
    );
  }
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'manage'
  const [activeChannelFilter, setActiveChannelFilter] = useState('All');
  const [subVideos, setSubVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  // Helper to fetch and interleave videos across all subscribed creators
  const fetchMixedCreatorVideos = async (channels, pageNum) => {
    if (!channels || channels.length === 0) return [];

    // Query across up to 6 creators per round
    const targetChannels = channels.slice(0, 6);
    const fetchPromises = targetChannels.map(async (ch) => {
      try {
        const res = await fetch(
          apiUrl(`/api/videos?q=${encodeURIComponent(ch.channelName)}&page=${pageNum}&limit=6`)
        );
        if (res.ok) {
          const data = await res.json();
          return data.videos || [];
        }
      } catch (err) {
        console.warn(`Error fetching videos for channel ${ch.channelName}:`, err);
      }
      return [];
    });

    const results = await Promise.all(fetchPromises);

    // Interleave/mix content across all creators
    const mixed = [];
    const maxLen = Math.max(...results.map((r) => r.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (let c = 0; c < results.length; c++) {
        if (results[c][i]) {
          mixed.push(results[c][i]);
        }
      }
    }
    return mixed;
  };

  // Reset & load page 1 whenever subscribedChannels or activeChannelFilter changes
  useEffect(() => {
    let isMounted = true;
    setPage(1);
    setHasMore(true);

    if (subscribedChannels.length === 0) {
      setSubVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const loadInitialFeed = async () => {
      try {
        let initialList = [];
        if (activeChannelFilter === 'All') {
          // Mix content of all subscribed creators
          initialList = await fetchMixedCreatorVideos(subscribedChannels, 1);
        } else {
          // Single creator feed
          const res = await fetch(
            apiUrl(`/api/videos?q=${encodeURIComponent(activeChannelFilter)}&page=1&limit=18`)
          );
          if (res.ok) {
            const data = await res.json();
            initialList = data.videos || [];
          }
        }

        if (isMounted) {
          // Deduplicate
          const seen = new Set();
          const unique = initialList.filter((v) => {
            const id = v.videoId || v._id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setSubVideos(unique);
          setHasMore(unique.length >= 6);
        }
      } catch (err) {
        console.error('Failed to load initial subscription videos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialFeed();
    return () => {
      isMounted = false;
    };
  }, [subscribedChannels, activeChannelFilter]);

  // Load more content on page scroll
  const loadMoreVideos = useCallback(async () => {
    if (loading || loadingMore || !hasMore || subscribedChannels.length === 0) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      let incoming = [];
      if (activeChannelFilter === 'All') {
        // Fetch next page mixed across all creators
        incoming = await fetchMixedCreatorVideos(subscribedChannels, nextPage);
      } else {
        const res = await fetch(
          apiUrl(`/api/videos?q=${encodeURIComponent(activeChannelFilter)}&page=${nextPage}&limit=12`)
        );
        if (res.ok) {
          const data = await res.json();
          incoming = data.videos || [];
        }
      }

      setSubVideos((prev) => {
        const seen = new Set(prev.map((v) => v.videoId || v._id));
        const filtered = incoming.filter((v) => {
          const id = v.videoId || v._id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        if (filtered.length === 0) {
          setHasMore(false);
          return prev;
        }

        setPage(nextPage);
        return [...prev, ...filtered];
      });
    } catch (err) {
      console.warn('Error loading more subscription videos:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, subscribedChannels, activeChannelFilter, page]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreVideos();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreVideos]);

  const isChannelSubscribed = (name) => {
    return subscribedChannels.some((c) => c.channelName.toLowerCase() === name.toLowerCase());
  };

  return (
    <div className="subscriptions-page">
      {/* Page Header */}
      <div className="sub-header">
        <div className="sub-title-group">
          <SubscriptionsIcon size={26} />
          <div>
            <h1 className="sub-heading">Subscriptions</h1>
            <p className="sub-count-label">
              {subscribedChannels.length}{' '}
              {subscribedChannels.length === 1 ? 'channel' : 'channels'} subscribed
            </p>
          </div>
        </div>

        {subscribedChannels.length > 0 && (
          <div className="sub-view-toggle">
            <button
              className={`sub-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Latest Videos
            </button>
            <button
              className={`sub-toggle-btn ${viewMode === 'manage' ? 'active' : ''}`}
              onClick={() => setViewMode('manage')}
            >
              Manage Channels
            </button>
          </div>
        )}
      </div>

      {/* Subscribed Channels Avatar Bar */}
      {subscribedChannels.length > 0 && (
        <div className="sub-channels-carousel">
          <button
            className={`sub-channel-pill ${activeChannelFilter === 'All' ? 'active' : ''}`}
            onClick={() => setActiveChannelFilter('All')}
          >
            All Channels
          </button>
          {subscribedChannels.map((channel) => (
            <button
              key={channel.channelName}
              className={`sub-channel-item ${
                activeChannelFilter === channel.channelName ? 'active' : ''
              }`}
              onClick={() => setActiveChannelFilter(channel.channelName)}
              title={channel.channelName}
            >
              <img
                src={
                  channel.channelAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    channel.channelName
                  )}&background=cc0000&color=fff&size=100`
                }
                alt={channel.channelName}
                className="sub-avatar-img"
              />
              <span className="sub-channel-name">{channel.channelName}</span>
            </button>
          ))}
        </div>
      )}

      {/* VIEW MODE: MANAGE CHANNELS */}
      {viewMode === 'manage' && subscribedChannels.length > 0 && (
        <div className="manage-channels-container">
          <h2 className="manage-section-heading">Manage Your Subscriptions</h2>
          <div className="manage-channels-list">
            {subscribedChannels.map((channel) => (
              <div key={channel.channelName} className="manage-channel-card">
                <div className="manage-channel-left">
                  <img
                    src={
                      channel.channelAvatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        channel.channelName
                      )}&background=cc0000&color=fff&size=100`
                    }
                    alt={channel.channelName}
                    className="manage-avatar-img"
                  />
                  <div className="manage-channel-info">
                    <h3 className="manage-channel-title">
                      {channel.channelName} <CheckIcon size={14} />
                    </h3>
                    {channel.subscriberCount && (
                      <p className="manage-channel-subs">
                        {channel.subscriberCount}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  className="subscribed-badge-btn"
                  onClick={() => onToggleSubscribe(channel)}
                  title={`Unsubscribe from ${channel.channelName}`}
                >
                  Subscribed
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE: LATEST VIDEOS GRID WITH INFINITE SCROLL */}
      {viewMode === 'grid' && subscribedChannels.length > 0 && (
        <div className="sub-videos-section">
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Loading subscription feed...</span>
            </div>
          ) : subVideos.length === 0 ? (
            <div className="empty-sub-state">
              <p>No recent uploads from {activeChannelFilter === 'All' ? 'these channels' : activeChannelFilter}.</p>
            </div>
          ) : (
            <>
              <div className="videos-grid">
                {subVideos.map((video, idx) => (
                  <VideoCard
                    key={`sub-${video.videoId || video._id}-${idx}`}
                    video={video}
                    onSelectVideo={onSelectVideo}
                    isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                    onToggleWatchLater={onToggleWatchLater}
                    onOpenSaveToPlaylist={onOpenSaveToPlaylist}
                    onNotify={onNotify}
                  />
                ))}
              </div>

              {/* Infinite Scroll Sentinel */}
              <div ref={sentinelRef} className="scroll-sentinel">
                {loadingMore && (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Loading more from subscriptions...</span>
                  </div>
                )}
                {!hasMore && subVideos.length > 0 && (
                  <span className="end-catalog-msg">You're all caught up with your subscriptions.</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* EMPTY STATE: ZERO SUBSCRIPTIONS */}
      {subscribedChannels.length === 0 && (
        <div className="empty-subscriptions-box">
          <div className="empty-sub-icon">
            <SubscriptionsIcon size={56} />
          </div>
          <h2 className="empty-sub-title">Don't miss new videos</h2>
          <p className="empty-sub-desc">
            Subscribe to your favorite channels to get their latest videos right here.
          </p>
          {onExplore && (
            <button
              type="button"
              className="empty-state-action-btn"
              onClick={onExplore}
            >
              Explore videos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
