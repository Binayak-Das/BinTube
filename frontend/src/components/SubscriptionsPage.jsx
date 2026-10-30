import React, { useState, useEffect } from 'react';
import VideoCard from './VideoCard.jsx';
import { SubscriptionsIcon, CheckIcon, PlayIcon } from './Icons.jsx';
import { apiUrl } from '../config/api.js';

// Popular YouTube channels to recommend if subscriptions list is light
const SUGGESTED_CHANNELS = [
  {
    channelName: 'MrBeast',
    channelAvatar: 'https://ui-avatars.com/api/?name=MrBeast&background=00bfff&color=fff&size=100',
    subscriberCount: '315M subscribers',
    description: 'I want to make the world a better place before I die.',
  },
  {
    channelName: 'Veritasium',
    channelAvatar: 'https://ui-avatars.com/api/?name=Veritasium&background=000&color=fff&size=100',
    subscriberCount: '16.2M subscribers',
    description: 'An element of truth - videos about science, education, and anything interesting.',
  },
  {
    channelName: 'Marques Brownlee',
    channelAvatar: 'https://ui-avatars.com/api/?name=MKBHD&background=e00000&color=fff&size=100',
    subscriberCount: '19.1M subscribers',
    description: 'Quality tech videos | YouTuber | Geek | Consumer Electronics.',
  },
  {
    channelName: 'Fireship',
    channelAvatar: 'https://ui-avatars.com/api/?name=Fireship&background=ff5722&color=fff&size=100',
    subscriberCount: '3.4M subscribers',
    description: 'High-intensity code tutorials and tech news to help you ship apps faster.',
  },
  {
    channelName: 'Kurzgesagt – In a Nutshell',
    channelAvatar: 'https://ui-avatars.com/api/?name=Kurzgesagt&background=7b1fa2&color=fff&size=100',
    subscriberCount: '22.8M subscribers',
    description: 'Videos explaining things with optimistic nihilism. Science and philosophy.',
  },
  {
    channelName: 'National Geographic',
    channelAvatar: 'https://ui-avatars.com/api/?name=NatGeo&background=ffeb3b&color=000&size=100',
    subscriberCount: '22.4M subscribers',
    description: 'Inspiring people to care about the planet since 1888.',
  },
];

export default function SubscriptionsPage({
  subscribedChannels = [],
  onToggleSubscribe,
  onSelectVideo,
  watchLaterIds = [],
  onToggleWatchLater,
  onDownload,
  onExplore,
}) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'manage'
  const [activeChannelFilter, setActiveChannelFilter] = useState('All');
  const [subVideos, setSubVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch videos for the subscribed channels
  useEffect(() => {
    let isMounted = true;
    const fetchSubscribedVideos = async () => {
      if (subscribedChannels.length === 0) {
        setSubVideos([]);
        return;
      }

      setLoading(true);
      try {
        const queryTerm =
          activeChannelFilter !== 'All'
            ? activeChannelFilter
            : subscribedChannels.slice(0, 3).map((c) => c.channelName).join(' ');

        const res = await fetch(apiUrl(`/api/videos?q=${encodeURIComponent(queryTerm)}&limit=18`));
        if (res.ok && isMounted) {
          const data = await res.json();
          setSubVideos(data.videos || []);
        }
      } catch (err) {
        console.error('Failed to load subscription videos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSubscribedVideos();
    return () => {
      isMounted = false;
    };
  }, [subscribedChannels, activeChannelFilter]);

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
                    <p className="manage-channel-subs">
                      {channel.subscriberCount || '1.2M subscribers'}
                    </p>
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

      {/* VIEW MODE: LATEST VIDEOS GRID */}
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
            <div className="videos-grid">
              {subVideos.map((video, idx) => (
                <VideoCard
                  key={`sub-${video.videoId || video._id}-${idx}`}
                  video={video}
                  onSelectVideo={onSelectVideo}
                  isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                  onToggleWatchLater={onToggleWatchLater}
                  onDownload={onDownload}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* EMPTY STATE: ZERO SUBSCRIPTIONS -> SUGGESTED CHANNELS */}
      {subscribedChannels.length === 0 && (
        <div className="empty-subscriptions-box">
          <div className="empty-sub-icon">
            <SubscriptionsIcon size={56} />
          </div>
          <h2 className="empty-sub-title">Don't miss new videos</h2>
          <p className="empty-sub-desc">
            Sign in or subscribe to your favorite channels to get the latest videos right here.
          </p>

          <div className="suggested-channels-wrapper">
            <h3 className="suggested-heading">Recommended Channels</h3>
            <div className="suggested-grid">
              {SUGGESTED_CHANNELS.map((ch) => {
                const subbed = isChannelSubscribed(ch.channelName);
                return (
                  <div key={ch.channelName} className="suggested-channel-card">
                    <img
                      src={ch.channelAvatar}
                      alt={ch.channelName}
                      className="suggested-avatar"
                    />
                    <h4 className="suggested-name">
                      {ch.channelName} <CheckIcon size={13} />
                    </h4>
                    <span className="suggested-subcount">{ch.subscriberCount}</span>
                    <p className="suggested-desc">{ch.description}</p>
                    <button
                      className={`subscribe-pill-btn ${subbed ? 'subbed' : ''}`}
                      onClick={() => onToggleSubscribe(ch)}
                    >
                      {subbed ? 'Subscribed' : 'Subscribe'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
