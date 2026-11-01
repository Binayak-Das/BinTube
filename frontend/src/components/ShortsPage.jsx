import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThumbsUpIcon,
  ShareIcon,
  CommentIcon,
  CloseIcon,
} from './Icons.jsx';
import CommentsSection from './CommentsSection.jsx';
import { apiUrl } from '../config/api.js';

export default function ShortsPage({
  initialShort = null,
  onNotify,
  likedVideoIds = [],
  onToggleLike,
  subscribedChannels = [],
  onToggleSubscribe,
  currentUser = null,
  onRequireAuth,
}) {
  const [shorts, setShorts] = useState(() => (initialShort ? [initialShort] : []));
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(
    () => localStorage.getItem('shorts_autoadvance') === 'true'
  );

  const viewportRef = useRef(null);
  const reelRefs = useRef([]);
  const videoRefs = useRef({});
  const audioRefs = useRef({});
  const isFetchingRef = useRef(false);

  // Fetch Shorts from API with unlimited infinite page support
  const fetchShorts = useCallback(async (pageNum = 1) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (pageNum === 1 && shorts.length === 0) setLoading(true);
      const res = await fetch(apiUrl(`/api/videos/shorts?page=${pageNum}&limit=12`));
      if (res.ok) {
        const data = await res.json();
        const incoming = data.videos || [];
        setShorts((prev) => {
          if (pageNum === 1) {
            if (initialShort) {
              const initId = initialShort.videoId || initialShort._id;
              const filtered = incoming.filter((v) => (v.videoId || v._id) !== initId);
              return [initialShort, ...filtered];
            }
            return incoming;
          }
          const existingIds = new Set(prev.map((v) => v.videoId || v._id));
          const uniqueIncoming = incoming.filter((v) => !existingIds.has(v.videoId || v._id));
          return [...prev, ...uniqueIncoming];
        });
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Error fetching shorts reel:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [initialShort]);

  useEffect(() => {
    fetchShorts(1);
  }, [fetchShorts]);

  // Infinite scroll: fetch next batch when user gets close to the end (ensures UNLIMITED shorts)
  useEffect(() => {
    if (shorts.length > 0 && activeIdx >= shorts.length - 4 && !isFetchingRef.current) {
      fetchShorts(page + 1);
    }
  }, [activeIdx, shorts.length, page, fetchShorts]);

  // IntersectionObserver to detect which reel is centered/visible
  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = entry.target.getAttribute('data-index');
            if (indexStr !== null) {
              const index = parseInt(indexStr, 10);
              setActiveIdx(index);
              setIsPlaying(true);
            }
          }
        });
      },
      {
        root: root,
        threshold: 0.6,
      }
    );

    reelRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [shorts]);

  // Synchronize active reel video and audio playback
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idxStr, vidEl]) => {
      if (!vidEl) return;
      const idx = parseInt(idxStr, 10);
      const audEl = audioRefs.current[idx];

      if (idx === activeIdx) {
        if (audEl) {
          audEl.muted = isMuted;
          audEl.volume = isMuted ? 0 : 1;
        }
        vidEl.muted = true; // Video element remains muted so browser never blocks autoplay
        if (isPlaying) {
          vidEl.play().catch(() => {});
          if (audEl) {
            audEl.currentTime = vidEl.currentTime;
            audEl.play().catch(() => {});
          }
        } else {
          vidEl.pause();
          if (audEl) audEl.pause();
        }
      } else {
        vidEl.pause();
        vidEl.currentTime = 0;
        if (audEl) {
          audEl.pause();
          audEl.currentTime = 0;
        }
      }
    });
  }, [activeIdx, isPlaying, isMuted]);

  // Document gesture listener to ensure unmuted audio plays on first user tap/key/touch
  useEffect(() => {
    const unlockShortAudioOnGesture = () => {
      const audEl = audioRefs.current[activeIdx];
      if (audEl && isPlaying && !isMuted && audEl.paused) {
        audEl.muted = false;
        audEl.volume = 1;
        audEl.play().catch(() => {});
      }
      const vidEl = videoRefs.current[activeIdx];
      if (vidEl && isPlaying && vidEl.paused) {
        vidEl.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlockShortAudioOnGesture, { passive: true });
    window.addEventListener('touchstart', unlockShortAudioOnGesture, { passive: true });
    window.addEventListener('click', unlockShortAudioOnGesture, { passive: true });
    window.addEventListener('keydown', unlockShortAudioOnGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockShortAudioOnGesture);
      window.removeEventListener('touchstart', unlockShortAudioOnGesture);
      window.removeEventListener('click', unlockShortAudioOnGesture);
      window.removeEventListener('keydown', unlockShortAudioOnGesture);
    };
  }, [activeIdx, isPlaying, isMuted]);

  // Seamless Background Play Engine for Shorts:
  // When switching tabs or minimizing, audio continues and video resyncs on foreground return
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      const vidEl = videoRefs.current[activeIdx];
      const audEl = audioRefs.current[activeIdx];
      if (!vidEl || !audEl) return;

      if (isHidden) {
        if (isPlaying) {
          audEl.currentTime = vidEl.currentTime;
          audEl.muted = isMuted;
          audEl.volume = isMuted ? 0 : 1;
          if (audEl.paused) {
            audEl.play().catch(() => {});
          }
        }
      } else {
        if (isPlaying) {
          const syncTime = !audEl.paused ? audEl.currentTime : vidEl.currentTime;
          vidEl.currentTime = syncTime;
          if (vidEl.paused) {
            vidEl.play().catch(() => {});
          }
          if (audEl.paused && !isMuted) {
            audEl.play().catch(() => {});
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeIdx, isPlaying, isMuted]);

  // Scroll to previous / next reel
  const scrollToReel = useCallback((index) => {
    if (index >= 0 && index < shorts.length) {
      reelRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [shorts.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
        e.preventDefault();
        scrollToReel(activeIdx + 1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyK') {
        e.preventDefault();
        scrollToReel(activeIdx - 1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted((m) => !m);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx, scrollToReel]);

  // Native share handler
  const handleShare = async (shortItem) => {
    if (!shortItem) return;
    const sId = shortItem.videoId || shortItem._id;
    const origin = window.location.origin || 'http://localhost:5173';
    const shareUrl = `${origin}/watch?v=${encodeURIComponent(sId)}`;
    const shareTitle = shortItem.title || 'Check out this Short';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareTitle,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.code === 20)) return;
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (typeof onNotify === 'function') onNotify('Short link copied to clipboard');
        return;
      } catch (_) {}
    }

    if (typeof onNotify === 'function') onNotify(`Link: ${shareUrl}`);
  };

  if (loading && shorts.length === 0) {
    return (
      <div className="shorts-page-loading">
        <div className="spinner"></div>
        <span>Loading Reels...</span>
      </div>
    );
  }

  const activeShort = shorts[activeIdx] || shorts[0] || null;

  return (
    <div className="shorts-reel-page-container">
      {/* Full Viewport Vertical Reel Feed */}
      <div className="shorts-reel-viewport" ref={viewportRef}>
        {shorts.map((short, idx) => {
          const sId = short.videoId || short._id;
          const isActive = idx === activeIdx;
          const isNearActive = Math.abs(idx - activeIdx) <= 1;
          const isLiked = Boolean(sId && likedVideoIds.includes(sId));
          const isSubscribed = Boolean(
            short &&
              subscribedChannels.some(
                (c) => (c.channelName || '').toLowerCase() === (short.channelName || '').toLowerCase()
              )
          );

          // Format clean likes count (displaying actual like count, strictly NEVER the word "views")
          const rawLikes = short.likes ? String(short.likes) : '';
          const rawViews = short.views ? String(short.views) : '';
          const displayLikes = rawLikes
            ? rawLikes.replace(/\s*views?/gi, '').trim()
            : rawViews
            ? rawViews.replace(/\s*views?/gi, '').trim()
            : 'Like';

          return (
            <div
              key={`reel-item-${sId}-${idx}`}
              ref={(el) => (reelRefs.current[idx] = el)}
              data-index={idx}
              className="shorts-reel-item"
            >
              {/* Centered Reel Card */}
              <div className="shorts-reel-card">
                {/* Video Playback Container - Zero Overlays */}
                <div
                  className="shorts-video-viewport"
                  onClick={() => {
                    if (isActive) {
                      setIsPlaying((p) => !p);
                    } else {
                      scrollToReel(idx);
                    }
                  }}
                >
                  {isNearActive ? (
                    <>
                      <video
                        ref={(el) => (videoRefs.current[idx] = el)}
                        className="shorts-html5-video"
                        src={apiUrl(`/api/videos/${encodeURIComponent(sId)}/stream`)}
                        poster={short.thumbnailUrl || `https://i.ytimg.com/vi/${sId}/hqdefault.jpg`}
                        autoPlay={isActive}
                        loop={!autoAdvance}
                        playsInline
                        preload="metadata"
                        muted={true}
                        onTimeUpdate={(e) => {
                          const aud = audioRefs.current[idx];
                          if (aud && Math.abs(e.target.currentTime - aud.currentTime) > 0.25) {
                            aud.currentTime = e.target.currentTime;
                          }
                        }}
                        onSeeked={(e) => {
                          const aud = audioRefs.current[idx];
                          if (aud) aud.currentTime = e.target.currentTime;
                        }}
                        onEnded={() => {
                          if (autoAdvance) {
                            scrollToReel(idx + 1);
                          }
                        }}
                        onError={(e) => {
                          // Resilient retry on transient stream error - never fall back to iframe
                          setTimeout(() => {
                            if (e.target && !e.target.paused) {
                              e.target.load();
                              e.target.play().catch(() => {});
                            }
                          }, 1000);
                        }}
                      />
                      <audio
                        ref={(el) => (audioRefs.current[idx] = el)}
                        src={apiUrl(`/api/videos/${encodeURIComponent(sId)}/audio`)}
                        loop={!autoAdvance}
                        preload="metadata"
                        muted={isMuted}
                        onEnded={() => {
                          if (autoAdvance) {
                            scrollToReel(idx + 1);
                          }
                        }}
                      />
                    </>
                  ) : (
                    <img
                      src={short.thumbnailUrl || `https://i.ytimg.com/vi/${sId}/hqdefault.jpg`}
                      alt={short.title}
                      className="shorts-html5-video"
                      loading="lazy"
                    />
                  )}
                </div>

                {/* Bottom Video Metadata Overlay */}
                <div className="shorts-meta-overlay" onClick={(e) => e.stopPropagation()}>
                    <div className="shorts-channel-row">
                      <img
                        src={
                          short.channelAvatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            short.channelName || 'Creator'
                          )}&background=ff0000&color=fff`
                        }
                        alt={short.channelName}
                        className="shorts-channel-avatar"
                      />
                      <span className="shorts-channel-name">{short.channelName}</span>
                      <button
                        type="button"
                        className={`shorts-sub-btn ${isSubscribed ? 'subscribed' : ''}`}
                        onClick={() => onToggleSubscribe && onToggleSubscribe(short)}
                      >
                        {isSubscribed ? 'Subscribed' : 'Subscribe'}
                      </button>
                    </div>
                    <h3 className="shorts-video-title">{short.title}</h3>
                  </div>

                {/* Right Side Action Floating Column (Strictly NO watch later & NO up/down arrows) */}
                <div className="shorts-side-actions" onClick={(e) => e.stopPropagation()}>
                  {/* Like Button */}
                  <button
                    type="button"
                    className={`shorts-action-btn ${isLiked ? 'active' : ''}`}
                    onClick={() => onToggleLike && onToggleLike(short)}
                    title="Like this short"
                  >
                    <div className="shorts-action-icon">
                      <ThumbsUpIcon size={22} filled={isLiked} />
                    </div>
                    <span className="shorts-action-label">{displayLikes}</span>
                  </button>

                  {/* Comments Button (Displays comments of the video) */}
                  <button
                    type="button"
                    className="shorts-action-btn"
                    onClick={() => setShowComments(true)}
                    title="Display comments of the video"
                  >
                    <div className="shorts-action-icon">
                      <CommentIcon size={22} />
                    </div>
                    <span className="shorts-action-label">{short.commentsCount || 'Comments'}</span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    className="shorts-action-btn"
                    onClick={() => handleShare(short)}
                    title="Share short"
                  >
                    <div className="shorts-action-icon">
                      <ShareIcon size={22} />
                    </div>
                    <span className="shorts-action-label">Share</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-Up Comments Drawer (Displays comments of the active short video) */}
      {showComments && activeShort && (
        <div className="shorts-comments-overlay" onClick={() => setShowComments(false)}>
          <div
            className="shorts-comments-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shorts-comments-drawer-header">
              <div className="shorts-comments-title-wrap">
                <h3 className="shorts-comments-heading">Comments</h3>
                {activeShort.commentsCount && (
                  <span className="shorts-comments-badge">
                    {activeShort.commentsCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="shorts-comments-close-btn"
                onClick={() => setShowComments(false)}
                title="Close comments"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="shorts-comments-drawer-content">
              <CommentsSection
                videoId={activeShort.videoId || activeShort._id}
                currentUser={currentUser}
                onRequireAuth={onRequireAuth}
                onNotify={onNotify}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
