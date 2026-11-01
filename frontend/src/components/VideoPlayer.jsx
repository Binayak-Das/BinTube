import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ThumbsUpIcon,
  ClockIcon,
  ShareIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  NextTrackIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
  SettingsIcon,
  TheaterIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  Rewind10Icon,
  Forward10Icon,
  PlaylistIcon,
  SpeedometerIcon,
  LoopIcon,
  LockIcon,
  UnlockIcon,
} from './Icons.jsx';
import CommentsSection from './CommentsSection.jsx';
import VideoActionMenu from './VideoActionMenu.jsx';
import { apiUrl } from '../config/api.js';

// Base64 1x1 invisible MP4 loop for bulletproof mobile screen wake lock (NoSleep standard)
const NO_SLEEP_VIDEO_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr9tZGF0AAACoAYF//+///AAAAMmF2Y0MBZAAK/+EAGWdkAAqs2V+WXAWyAAADAAIAAAMAYB4kSywBAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACtwAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTQuNjMuMTA0';

// Format seconds to mm:ss or hh:mm:ss
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const sStr = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) {
    const mStr = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${mStr}:${sStr}`;
  }
  return `${m}:${sStr}`;
}

export default function VideoPlayer({
  video,
  relatedVideos = [],
  onSelectVideo,
  isWatchLater,
  onToggleWatchLater,
  onNotify,
  isLiked = false,
  onToggleLike,
  isSubscribed = false,
  onToggleSubscribe,
  playlistContext = null,
  onOpenSaveToPlaylist,
  currentUser = null,
  onRequireAuth = null,
  watchLaterIds = [],
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const bgAudioRef = useRef(null);
  const progressTrackRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const unlockPillTimerRef = useRef(null);
  const keepAwakeVideoRef = useRef(null);
  const wakeLockRef = useRef(null);
  const shouldBePlayingRef = useRef(true);
  const settingsMenuRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockPill, setShowUnlockPill] = useState(false);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // 'main' or 'speed'
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(() => localStorage.getItem('yt_loop') === 'true');
  const [isCCActive, setIsCCActive] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Hold to 2X Speed state & refs
  const [isHolding2x, setIsHolding2x] = useState(false);
  const holdTimerRef = useRef(null);
  const isHolding2xRef = useRef(false);
  const previousSpeedRef = useRef(1);
  const hasHeldRef = useRef(false);

  // Double-tap seeking & play/pause action feedback
  const lastTapRef = useRef(null);
  const singleTapTimerRef = useRef(null);
  const [ripple, setRipple] = useState(null); // 'left' or 'right'
  const rippleTimerRef = useRef(null);
  const [actionFlash, setActionFlash] = useState(null); // 'play' or 'pause'
  const flashTimerRef = useRef(null);

  // Autoplay preference (defaults to true)
  const [autoplay, setAutoplay] = useState(() => {
    return localStorage.getItem('yt_autoplay') !== 'false';
  });

  // Dynamic Related Videos Pagination on Page Scroll
  const [extraRelated, setExtraRelated] = useState([]);
  const [relatedPage, setRelatedPage] = useState(1);
  const [loadingMoreRelated, setLoadingMoreRelated] = useState(false);
  const [hasMoreRelated, setHasMoreRelated] = useState(true);
  const relatedSentinelRef = useRef(null);

  const vId = video.videoId || video._id;
  const videoSrc = apiUrl(`/api/videos/${encodeURIComponent(vId)}/stream`);
  const audioSrc = apiUrl(`/api/videos/${encodeURIComponent(vId)}/audio`);

  useEffect(() => {
    setExtraRelated([]);
    setRelatedPage(1);
    setLoadingMoreRelated(false);
    setHasMoreRelated(true);
  }, [vId]);

  const allRelatedVideos = [...relatedVideos, ...extraRelated];

  const isPlaylistMode = Boolean(
    playlistContext && playlistContext.videos && playlistContext.videos.length > 0
  );

  const playlistNextVideo = isPlaylistMode
    ? playlistContext.videos[playlistContext.currentIndex + 1] || null
    : null;

  const upNextVideo = allRelatedVideos && allRelatedVideos.length > 0 ? allRelatedVideos[0] : null;

  const nextVideo = isPlaylistMode
    ? (playlistNextVideo || upNextVideo)
    : upNextVideo;

  // Fetch more related videos on page scroll with UNLIMITED endless loading
  const fetchMoreRelated = useCallback(async () => {
    if (loadingMoreRelated) return;
    setLoadingMoreRelated(true);
    try {
      const currentVId = video.videoId || video._id;
      const cleanTitle = (video.title || '').replace(/[\(\)\[\]\{\}\#\@\|\-]/g, ' ').trim();
      const primaryKeywords = cleanTitle.split(' ').slice(0, 5).join(' ');
      const channelKeywords = video.channelName || '';
      const catKeywords = video.category && video.category !== 'All' ? video.category : 'Music';

      const relatedQueryPool = [
        primaryKeywords,
        `${channelKeywords} videos`,
        `${primaryKeywords} trending`,
        `${catKeywords} popular`,
        `${channelKeywords} music`,
        `${primaryKeywords} live`,
        'viral videos 2025',
        'recommended trending',
      ];

      const nextPage = relatedPage + 1;
      const qIdx = nextPage % relatedQueryPool.length;
      const queryTerm = relatedQueryPool[qIdx] || primaryKeywords || 'trending';

      const res = await fetch(
        apiUrl(`/api/videos?q=${encodeURIComponent(queryTerm)}&page=${nextPage}&limit=12`)
      );
      if (res.ok) {
        const data = await res.json();
        const incoming = (data.videos || []).filter((v) => {
          const id = v.videoId || v._id;
          if (id === currentVId) return false;
          if (relatedVideos.some((r) => (r.videoId || r._id) === id)) return false;
          if (extraRelated.some((r) => (r.videoId || r._id) === id)) return false;
          return true;
        });

        if (incoming.length > 0) {
          setExtraRelated((prev) => [...prev, ...incoming]);
        }
        setRelatedPage(nextPage);
      }
    } catch (err) {
      console.warn('Error loading more related videos:', err);
    } finally {
      setLoadingMoreRelated(false);
    }
  }, [loadingMoreRelated, relatedPage, video, relatedVideos, extraRelated]);

  // Track user scroll before loading secondary batches of related videos
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  useEffect(() => {
    const handlePageScroll = () => {
      if (window.scrollY > 100) {
        setUserHasScrolled(true);
      }
    };
    window.addEventListener('scroll', handlePageScroll, { passive: true });
    return () => window.removeEventListener('handlePageScroll', handlePageScroll);
  }, []);

  useEffect(() => {
    // Strictly wait until user has scrolled down before loading subsequent batches
    if (!userHasScrolled) return;
    const sentinel = relatedSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreRelated();
        }
      },
      { rootMargin: '80px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [userHasScrolled, fetchMoreRelated]);

  // Screen Wake Lock API to prevent phone / PC display sleep while playing in foreground
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (_) { }
    }

    try {
      if (keepAwakeVideoRef.current && keepAwakeVideoRef.current.paused) {
        keepAwakeVideoRef.current.play().catch(() => { });
      }
    } catch (_) { }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => { });
      wakeLockRef.current = null;
    }
    if (keepAwakeVideoRef.current) {
      try {
        keepAwakeVideoRef.current.pause();
      } catch (_) { }
    }
  }, []);

  // Next video transition handler
  const playNextVideo = useCallback(() => {
    if (isPlaylistMode) {
      if (playlistNextVideo) {
        onNotify(`Playing next in ${playlistContext.title}: ${playlistNextVideo.title.slice(0, 30)}...`);
        onSelectVideo(playlistNextVideo, {
          ...playlistContext,
          currentIndex: playlistContext.currentIndex + 1,
        });
        return;
      } else if (autoplay && upNextVideo) {
        onNotify(`Finished ${playlistContext.title}. Playing up next: ${upNextVideo.title.slice(0, 30)}...`);
        onSelectVideo(upNextVideo, null);
        return;
      } else {
        onNotify(`Reached end of ${playlistContext.title}`);
        return;
      }
    }

    if (nextVideo) {
      onNotify(`Playing next: ${nextVideo.title.slice(0, 30)}...`);
      onSelectVideo(nextVideo);
    }
  }, [isPlaylistMode, playlistNextVideo, playlistContext, autoplay, upNextVideo, nextVideo, onNotify, onSelectVideo]);

  // Handle video end state
  const handleVideoEnded = useCallback(() => {
    if (isLooping) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => { });
        setIsPlaying(true);
      }
      return;
    }
    if (autoplay) {
      if (isPlaylistMode) {
        if (playlistNextVideo || upNextVideo) {
          playNextVideo();
        }
      } else if (nextVideo) {
        playNextVideo();
      }
    }
  }, [isLooping, autoplay, isPlaylistMode, playlistNextVideo, upNextVideo, nextVideo, playNextVideo]);

  // Action Flash Feedback
  const triggerFlash = useCallback((type) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setActionFlash(type);
    flashTimerRef.current = setTimeout(() => {
      setActionFlash(null);
    }, 550);
  }, []);

  // UI Ripple feedback for double-tap seeking
  const triggerRipple = useCallback((direction) => {
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    setRipple(direction);
    rippleTimerRef.current = setTimeout(() => {
      setRipple(null);
    }, 650);
  }, []);

  // Toggle Play / Pause (Keeps visual video and audio track strictly synchronized)
  const togglePlayPause = useCallback((forcePlay = null) => {
    const vid = videoRef.current;
    const aud = bgAudioRef.current;
    if (!vid) return;

    const isCurrentlyPlaying = document.hidden && aud && !aud.paused ? true : !vid.paused;
    const shouldPlay = forcePlay !== null ? forcePlay : !isCurrentlyPlaying;

    shouldBePlayingRef.current = shouldPlay;

    if (shouldPlay) {
      vid.play().catch(() => { });
      if (aud) {
        aud.currentTime = vid.currentTime;
        aud.volume = isMuted ? 0 : volume / 100;
        aud.muted = isMuted;
        aud.playbackRate = vid.playbackRate || playbackSpeed;
        aud.play().catch(() => { });
      }
      setIsPlaying(true);
      requestWakeLock();
      triggerFlash('play');
    } else {
      vid.pause();
      if (aud) aud.pause();
      setIsPlaying(false);
      releaseWakeLock();
      triggerFlash('pause');
    }
  }, [requestWakeLock, releaseWakeLock, triggerFlash, isMuted, volume, playbackSpeed]);

  // Seek relative (forward / backward seconds)
  const seekRelative = useCallback((seconds) => {
    const vid = videoRef.current;
    const aud = bgAudioRef.current;
    if (!vid) return;

    const activeEl = document.hidden && aud && !aud.paused ? aud : vid;
    const cur = activeEl.currentTime || 0;
    const dur = activeEl.duration || duration || 0;
    const target = Math.max(0, Math.min(dur || 999999, cur + seconds));

    vid.currentTime = target;
    if (aud) aud.currentTime = target;
    setCurrentTime(target);

    if (seconds < 0) {
      triggerRipple('left');
    } else {
      triggerRipple('right');
    }
  }, [duration, triggerRipple]);

  // Native HTML5 <video> Event Handlers
  const handleVideoPlay = () => {
    setIsPlaying(true);
    shouldBePlayingRef.current = true;
    requestWakeLock();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch (_) { }
    }
  };

  const handleVideoPause = () => {
    // Only register pause if not in background and user actually stopped playback
    if (!document.hidden && !shouldBePlayingRef.current) {
      setIsPlaying(false);
      releaseWakeLock();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch (_) { }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !document.hidden) {
      const vTime = videoRef.current.currentTime || 0;
      setCurrentTime(vTime);
      const aud = bgAudioRef.current;
      if (aud && Math.abs(vTime - aud.currentTime) > 0.25) {
        aud.currentTime = vTime;
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (bgAudioRef.current && document.hidden) {
      setCurrentTime(bgAudioRef.current.currentTime || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur)) {
        setDuration(dur);
      }
      videoRef.current.muted = true; // Video track is muted so browser never blocks visual autoplay and avoids dual audio
      videoRef.current.playbackRate = playbackSpeed;
      setIsBuffering(false);

      if (shouldBePlayingRef.current) {
        videoRef.current.play().catch(() => { });
        if (bgAudioRef.current) {
          bgAudioRef.current.volume = isMuted ? 0 : volume / 100;
          bgAudioRef.current.muted = isMuted;
          bgAudioRef.current.playbackRate = playbackSpeed;
          bgAudioRef.current.play().catch(() => { });
        }
      }
    }
  };

  const handleVideoError = () => {
    setIsBuffering(false);
    console.warn('Direct stream error on <video>, activating resilient embed fallback...');
    setUseEmbedFallback(true);
  };

  // Switch video stream on video change - Unmuted by default
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(true);
    setIsPlaying(true);
    setUseEmbedFallback(false);
    shouldBePlayingRef.current = true;

    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.muted = true;
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().catch(() => { });
    }

    if (bgAudioRef.current) {
      bgAudioRef.current.load();
      bgAudioRef.current.volume = isMuted ? 0 : volume / 100;
      bgAudioRef.current.muted = isMuted;
      bgAudioRef.current.playbackRate = playbackSpeed;
      if (shouldBePlayingRef.current) {
        bgAudioRef.current.play().catch(() => { });
      }
    }
  }, [vId]);

  // Document-level user gesture unlocker for unmuted audio
  useEffect(() => {
    const unlockAudioOnGesture = () => {
      const aud = bgAudioRef.current;
      if (aud && shouldBePlayingRef.current && !isMuted && aud.paused) {
        aud.muted = false;
        aud.volume = volume / 100;
        aud.play().catch(() => { });
      }
      const vid = videoRef.current;
      if (vid && shouldBePlayingRef.current && vid.paused) {
        vid.play().catch(() => { });
      }
    };

    window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true });
    window.addEventListener('touchstart', unlockAudioOnGesture, { passive: true });
    window.addEventListener('click', unlockAudioOnGesture, { passive: true });
    window.addEventListener('keydown', unlockAudioOnGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioOnGesture);
      window.removeEventListener('touchstart', unlockAudioOnGesture);
      window.removeEventListener('click', unlockAudioOnGesture);
      window.removeEventListener('keydown', unlockAudioOnGesture);
    };
  }, [isMuted, volume]);

  // Seamless Background Play Engine:
  // When switching tabs or minimizing, background audio plays continuously and resumes visual in foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      const vid = videoRef.current;
      const aud = bgAudioRef.current;
      if (!vid || !aud) return;

      if (isHidden) {
        // Tab switched to background or phone screen turned off:
        // Keep background audio playing at exact timestamp and proper unmuted volume
        if (shouldBePlayingRef.current) {
          aud.currentTime = vid.currentTime;
          aud.volume = isMuted ? 0 : volume / 100;
          aud.muted = isMuted;
          aud.playbackRate = vid.playbackRate || playbackSpeed;
          if (aud.paused) {
            aud.play().catch((e) => console.warn('Background audio play:', e));
          }
        }
      } else {
        // Tab restored / user brought browser back to foreground:
        // Synchronize visual video element timestamp with the continuously playing audio track
        if (shouldBePlayingRef.current) {
          const timestamp = !aud.paused ? aud.currentTime : vid.currentTime;
          vid.currentTime = timestamp;
          vid.playbackRate = aud.playbackRate || playbackSpeed;
          if (vid.paused) {
            vid.play().catch(() => { });
          }
          if (aud.paused && !isMuted) {
            aud.play().catch(() => { });
          }
          setIsPlaying(true);
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock, isMuted, volume, playbackSpeed]);

  // Full MediaSession API Integration for Lockscreen & Notification Controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: video.title || 'Playing Video',
      artist: video.channelName || 'YouTube',
      album: 'Bintube',
      artwork: [
        {
          src: video.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sizes: '512x512',
          type: 'image/jpeg',
        },
      ],
    });

    const actionHandlers = [
      ['play', () => togglePlayPause(true)],
      ['pause', () => togglePlayPause(false)],
      ['seekbackward', (details) => seekRelative(-(details.seekOffset || 10))],
      ['seekforward', (details) => seekRelative(details.seekOffset || 10)],
      ['previoustrack', () => seekRelative(-10)],
      ['nexttrack', () => playNextVideo()],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          if (videoRef.current) videoRef.current.currentTime = details.seekTime;
          if (bgAudioRef.current) bgAudioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      }],
      ['stop', () => togglePlayPause(false)],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_) { }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (_) { }
      }
    };
  }, [video, vId, togglePlayPause, seekRelative, playNextVideo]);

  // Close settings popup when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    const handleOutsideClick = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettings(false);
        setSettingsView('main');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showSettings]);

  // Autohide controls delay: 4s on mobile devices, 2.8s on desktop
  const getHideDelay = () => {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth <= 768 || 'ontouchstart' in window);
    return isMobile ? 4000 : 2800;
  };

  const handleLockedTap = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setShowUnlockPill(true);
    if (unlockPillTimerRef.current) clearTimeout(unlockPillTimerRef.current);
    unlockPillTimerRef.current = setTimeout(() => {
      setShowUnlockPill(false);
    }, 2500); // Minimal lock indicator hides automatically after 2.5s
  };

  const handleUnlock = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsLocked(false);
    setShowUnlockPill(false);
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, getHideDelay());
  };

  // Autohide controls logic
  const handleMouseMove = () => {
    if (isLocked) return;
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (isPlaying && !showSettings) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, getHideDelay());
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettings && !isLocked) {
      setShowControls(false);
    }
  };

  // Hold to 2X Speed Pointer Handlers
  const handlePointerDown = (e) => {
    if (isLocked) {
      handleLockedTap(e);
      return;
    }
    hasHeldRef.current = false;
    previousSpeedRef.current = playbackSpeed;
    holdTimerRef.current = setTimeout(() => {
      hasHeldRef.current = true;
      isHolding2xRef.current = true;
      setIsHolding2x(true);
      if (videoRef.current) {
        videoRef.current.playbackRate = 2;
      }
      if (bgAudioRef.current) {
        bgAudioRef.current.playbackRate = 2;
      }
    }, 400);
  };

  const handlePointerUp = (e) => {
    if (isLocked) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHolding2xRef.current) {
      isHolding2xRef.current = false;
      setIsHolding2x(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = previousSpeedRef.current || 1;
      }
      if (bgAudioRef.current) {
        bgAudioRef.current.playbackRate = previousSpeedRef.current || 1;
      }
      return;
    }

    if (hasHeldRef.current) return;

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX) || 0;
    const relativeX = (clickX - rect.left) / rect.width;
    const isRight = relativeX > 0.65;
    const isLeft = relativeX < 0.35;

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      lastTapRef.current = null;
      if (isRight) {
        seekRelative(10);
      } else if (isLeft) {
        seekRelative(-10);
      } else {
        toggleFullscreen();
      }
    } else {
      lastTapRef.current = { time: now, x: relativeX };
      singleTapTimerRef.current = setTimeout(() => {
        togglePlayPause();
        lastTapRef.current = null;
      }, 250);
    }
  };

  const handlePointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHolding2xRef.current) {
      isHolding2xRef.current = false;
      setIsHolding2x(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = previousSpeedRef.current || 1;
      }
      if (bgAudioRef.current) {
        bgAudioRef.current.playbackRate = previousSpeedRef.current || 1;
      }
    }
  };

  // Subtitles / Closed Captions Toggle
  const handleToggleCC = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const nextState = !isCCActive;
    setIsCCActive(nextState);
    if (typeof onNotify === 'function') {
      onNotify(nextState ? 'Subtitles / CC turned on' : 'Subtitles turned off');
    }
  }, [isCCActive, onNotify]);

  // Seek on scrubber
  const handleScrub = (e) => {
    if (!progressTrackRef.current || !duration || !videoRef.current) return;
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setCurrentTime(targetTime);
    videoRef.current.currentTime = targetTime;
    if (bgAudioRef.current) bgAudioRef.current.currentTime = targetTime;
  };

  const handleProgressHover = (e) => {
    if (!progressTrackRef.current || !duration) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  // Volume: Controls audio stream with instant un-mute restoration
  const handleVolumeChange = (e) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    const aud = bgAudioRef.current;
    if (aud) {
      aud.volume = newVol / 100;
      if (newVol > 0) {
        aud.muted = false;
        setIsMuted(false);
      } else {
        aud.muted = true;
        setIsMuted(true);
      }
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = useCallback(() => {
    const aud = bgAudioRef.current;
    if (!aud) return;
    if (isMuted) {
      // Un-mute: restore volume if at zero, so audio is audible immediately
      const restoredVol = volume === 0 ? 50 : volume;
      setVolume(restoredVol);
      aud.volume = restoredVol / 100;
      aud.muted = false;
      aud.play().catch(() => { });
      setIsMuted(false);
    } else {
      // Mute audio
      aud.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isLocked) return;
      if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase())) return;

      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        setIsTheater((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seekRelative, toggleMute, toggleFullscreen, isLocked]);

  // Social / Share via Native Web Share API
  const handleShare = async () => {
    const shareOrigin = window.location.origin || 'http://localhost:5173';
    const shareUrl = `${shareOrigin}/watch?v=${encodeURIComponent(vId)}`;
    const shareTitle = video?.title || 'Check out this video';

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

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (typeof onNotify === 'function') {
          onNotify('Link copied to clipboard');
        }
        return;
      } catch (_) { }
    }

    try {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      if (typeof onNotify === 'function') {
        onNotify('Link copied to clipboard');
      }
    } catch (_) {
      if (typeof onNotify === 'function') {
        onNotify(`Link: ${shareUrl}`);
      }
    }
  };

  const handleToggleAutoplay = () => {
    const nextVal = !autoplay;
    setAutoplay(nextVal);
    localStorage.setItem('yt_autoplay', String(nextVal));
    onNotify(nextVal ? 'Autoplay is on' : 'Autoplay is off');
  };

  const handleToggleLoop = () => {
    const nextVal = !isLooping;
    setIsLooping(nextVal);
    localStorage.setItem('yt_loop', String(nextVal));
    if (videoRef.current) videoRef.current.loop = nextVal;
    if (bgAudioRef.current) bgAudioRef.current.loop = nextVal;
    onNotify(nextVal ? 'Loop video is on' : 'Loop video is off');
  };

  const changePlaybackSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    if (bgAudioRef.current) bgAudioRef.current.playbackRate = speed;
    setShowSettings(false);
    setSettingsView('main');
    onNotify(`${speed}x speed`);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`watch-page ${isTheater ? 'theater-layout' : ''}`}>
      {/* Primary Left Video Column */}
      <div className="watch-player-column">
        {/* Full-width YouTube Player Container with Custom Controller */}
        <div
          ref={containerRef}
          className={`yt-custom-player-wrapper ${(showControls || !isPlaying || showSettings) && !isLocked ? 'controls-visible' : ''} ${isLocked ? 'is-locked' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleMouseMove}
        >
          {/* Native HTML5 Video Element with resilient IFrame Fallback */}
          <div className="yt-video-embed-box">
            {useEmbedFallback ? (
              <iframe
                className="yt-html5-video"
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(vId)}?autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={video.title}
                style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'auto' }}
              />
            ) : (
              <video
                ref={videoRef}
                className="yt-html5-video"
                src={videoSrc}
                poster={video.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`}
                autoPlay
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                preload="auto"
                loop={isLooping}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onCanPlay={() => {
                  setIsBuffering(false);
                  if (shouldBePlayingRef.current && videoRef.current?.paused) {
                    videoRef.current.play().catch(() => { });
                  }
                }}
                onError={handleVideoError}
              />
            )}

            {/* Background Audio Playback Engine for Phone Minimizing / Screen Off */}
            <audio
              ref={bgAudioRef}
              src={audioSrc}
              preload="auto"
              playsInline
              loop={isLooping}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={handleVideoEnded}
            />

            {/* Buffering Spinner Overlay */}
            {isBuffering && (
              <div className="yt-player-buffering-overlay">
                <div className="spinner"></div>
              </div>
            )}
          </div>

          {/* Screen Lock Overlay & Minimal Unlock Pill at Bottom */}
          {isLocked && (
            <div
              className={`yt-locked-screen-overlay ${showUnlockPill ? 'visible' : ''}`}
              onClick={handleLockedTap}
            >
              <button
                type="button"
                className="yt-unlock-pill"
                onClick={handleUnlock}
                title="Tap to unlock screen"
              >
                <UnlockIcon size={16} />
                <span>Tap to unlock</span>
              </button>
            </div>
          )}

          {/* Click to Play/Pause, Double-Tap to Seek & Hold to 2X overlay */}
          <div
            className="yt-player-click-overlay"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerCancel}
            onPointerCancel={handlePointerCancel}
          />

          {/* Hold to 2X Speed Indicator */}
          {isHolding2x && (
            <div className="yt-speed-hold-pill">
              <span className="yt-speed-pulse-icon">▶▶</span>
              <span>2X Speed</span>
            </div>
          )}

          {/* Double Tap Seek Feedback (Right: +10s, Left: -10s) */}
          {ripple === 'right' && (
            <div className="yt-seek-ripple ripple-right">
              <div className="ripple-circle">
                <Forward10Icon size={34} />
                <span className="ripple-text">+10 seconds</span>
              </div>
            </div>
          )}
          {ripple === 'left' && (
            <div className="yt-seek-ripple ripple-left">
              <div className="ripple-circle">
                <Rewind10Icon size={34} />
                <span className="ripple-text">-10 seconds</span>
              </div>
            </div>
          )}

          {/* Center Flash on Play/Pause (Key K / Space) */}
          {actionFlash && (
            <div className="yt-action-flash">
              {actionFlash === 'play' ? <PlayIcon size={44} /> : <PauseIcon size={44} />}
            </div>
          )}

          {/* BOTTOM CONTROLLER BAR */}
          <div className="yt-controller-bar">
            {/* Red Scrubber Timeline */}
            <div
              ref={progressTrackRef}
              className="yt-scrubber-container"
              onClick={handleScrub}
              onTouchStart={handleScrub}
              onTouchMove={handleScrub}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setHoverTime(null)}
            >
              <div className="yt-scrubber-rail">
                {/* Buffer Track */}
                <div
                  className="yt-scrubber-buffer"
                  style={{ width: `${Math.min(100, progressPercent + 25)}%` }}
                />
                {/* Played Track (Red) */}
                <div
                  className="yt-scrubber-played"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="yt-scrubber-thumb" />
                </div>
              </div>

              {/* Hover Timestamp Tooltip */}
              {hoverTime !== null && (
                <div
                  className="yt-hover-timestamp"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="yt-controls-row">
              {/* Left Controls */}
              <div className="yt-ctrls-left">
                {/* Play / Pause button */}
                <button
                  className="yt-ctrl-btn"
                  onClick={() => togglePlayPause()}
                  title={isPlaying ? 'Pause (k)' : 'Play (k)'}
                >
                  {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                </button>

                {/* Next Video button */}
                <button
                  className="yt-ctrl-btn"
                  onClick={playNextVideo}
                  title="Next (SHIFT+N)"
                  disabled={!nextVideo}
                >
                  <NextTrackIcon size={20} />
                </button>

                {/* Volume Button & Hover Slider */}
                <div className="yt-volume-wrapper">
                  <button
                    className="yt-ctrl-btn"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeMuteIcon size={22} />
                    ) : volume < 50 ? (
                      <VolumeLowIcon size={22} />
                    ) : (
                      <VolumeHighIcon size={22} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="yt-volume-slider"
                    style={{
                      background:
                        isMuted || volume === 0
                          ? 'rgba(255, 255, 255, 0.25)'
                          : `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.25) ${volume}%)`,
                    }}
                    title={`Volume ${isMuted ? 0 : volume}%`}
                  />
                </div>

                {/* Time Display (e.g. 0:10 / 4:41) */}
                <div className="yt-time-display">
                  <span>{formatTime(currentTime)}</span>
                  <span className="yt-time-sep">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="yt-ctrls-right">
                {/* Settings Gear */}
                <div className="yt-settings-wrapper" ref={settingsMenuRef}>
                  <button
                    className={`yt-ctrl-btn yt-settings-btn ${showSettings ? 'active-settings' : ''}`}
                    onClick={() => {
                      setShowSettings(!showSettings);
                      setSettingsView('main');
                    }}
                    title="Settings"
                  >
                    <SettingsIcon size={20} className={showSettings ? 'spin-icon' : ''} />
                  </button>

                  {/* Settings Popup Menu */}
                  {showSettings && (
                    <>
                      <div
                        className="yt-settings-backdrop"
                        onClick={() => setShowSettings(false)}
                      />
                      <div className="yt-settings-menu">
                        {settingsView === 'speed' ? (
                          <div className="yt-settings-subpanel">
                            <div
                              className="yt-menu-header yt-submenu-header"
                              onClick={() => setSettingsView('main')}
                            >
                              <span className="yt-back-arrow">‹</span>
                              <span>Playback speed</span>
                            </div>

                            {/* Quick Speed Preset Chips */}
                            <div className="yt-speed-presets-bar">
                              {[0.5, 1, 1.25, 1.5, 2].map((spd) => (
                                <button
                                  key={`chip-${spd}`}
                                  type="button"
                                  className={`yt-speed-preset-chip ${playbackSpeed === spd ? 'active' : ''}`}
                                  onClick={() => {
                                    changePlaybackSpeed(spd);
                                    setSettingsView('main');
                                  }}
                                >
                                  {spd === 1 ? '1x' : `${spd}x`}
                                </button>
                              ))}
                            </div>

                            <div className="yt-settings-scroll-list">
                              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((spd) => (
                                <div
                                  key={spd}
                                  className={`yt-menu-row ${playbackSpeed === spd ? 'active-row' : ''}`}
                                  onClick={() => changePlaybackSpeed(spd)}
                                >
                                  <span>{spd === 1 ? 'Normal' : spd}</span>
                                  <div className="yt-check-slot">
                                    {playbackSpeed === spd && <CheckIcon size={16} />}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="yt-settings-mainpanel">
                            <div className="yt-menu-header">Playback Settings</div>

                            {/* Quality Row */}
                            <div className="yt-menu-row yt-settings-row-interactive">
                              <div className="yt-menu-row-left">
                                <span className="yt-row-icon-badge">HD</span>
                                <span>Quality</span>
                              </div>
                              <div className="yt-menu-row-right">
                                <span className="yt-quality-pill">1080p HD</span>
                              </div>
                            </div>

                            {/* Playback Speed row */}
                            <div
                              className="yt-menu-row yt-menu-row-navigable yt-settings-row-interactive"
                              onClick={() => setSettingsView('speed')}
                            >
                              <div className="yt-menu-row-left">
                                <SpeedometerIcon size={18} />
                                <span>Playback speed</span>
                              </div>
                              <div className="yt-menu-row-right">
                                <span className="yt-menu-val">
                                  {playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}
                                </span>
                                <span className="yt-forward-arrow">›</span>
                              </div>
                            </div>

                            {/* Loop Video toggle */}
                            <div
                              className="yt-menu-row yt-settings-row-interactive"
                              onClick={handleToggleLoop}
                              title="Loop video"
                            >
                              <div className="yt-menu-row-left">
                                <LoopIcon size={18} />
                                <span>Loop video</span>
                              </div>
                              <div className="yt-menu-row-right">
                                <span className="yt-menu-val">{isLooping ? 'On' : 'Off'}</span>
                              </div>
                            </div>

                            {/* Autoplay Row */}
                            <div
                              className="yt-menu-row yt-settings-row-interactive"
                              onClick={handleToggleAutoplay}
                              title="Autoplay next video"
                            >
                              <div className="yt-menu-row-left">
                                <PlayIcon size={18} />
                                <span>Autoplay</span>
                              </div>
                              <div className="yt-menu-row-right">
                                <span className="yt-menu-val">{autoplay ? 'On' : 'Off'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Screen Lock Button */}
                <button
                  className="yt-ctrl-btn yt-lock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLocked(true);
                    setShowControls(false);
                    handleLockedTap();
                  }}
                  title="Lock screen"
                >
                  <LockIcon size={20} />
                </button>

                {/* Theater Mode Button */}
                <button
                  className="yt-ctrl-btn"
                  onClick={() => setIsTheater(!isTheater)}
                  title={isTheater ? 'Default view (t)' : 'Theater mode (t)'}
                >
                  <TheaterIcon size={20} />
                </button>

                {/* Fullscreen Button */}
                <button
                  className="yt-ctrl-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
                >
                  {isFullscreen ? (
                    <FullscreenExitIcon size={20} />
                  ) : (
                    <FullscreenIcon size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Title */}
        <h1 className="watch-title">{video.title}</h1>

        {/* Channel and Actions Bar */}
        <div className="watch-meta-bar">
          {/* Channel info */}
          <div className="watch-channel-info">
            <img
              src={
                video.channelAvatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  video.channelName
                )}&background=cc0000&color=fff&size=100`
              }
              alt={video.channelName}
              className="watch-channel-avatar"
            />
            <div className="watch-channel-names">
              <div className="watch-channel-name">
                <span>{video.channelName}</span>
                <CheckIcon size={14} />
              </div>
              <span className="watch-subscriber-count">
                {video.subscriberCount}
              </span>
            </div>
            <button
              className={`subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
              onClick={() =>
                onToggleSubscribe &&
                onToggleSubscribe({
                  channelName: video.channelName,
                  channelAvatar: video.channelAvatar,
                  subscriberCount: video.subscriberCount,
                })
              }
            >
              {isSubscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>

          {/* Action buttons */}
          <div className="watch-actions">
            {/* Likes */}
            <button
              className={`action-pill-btn ${isLiked ? 'active' : ''}`}
              onClick={() => onToggleLike && onToggleLike(video)}
              title="Like"
            >
              <ThumbsUpIcon size={16} filled={isLiked} />
              <span>{video.likes}</span>
            </button>

            {/* Watch Later toggle */}
            <button
              className={`action-pill-btn ${isWatchLater ? 'active' : ''}`}
              onClick={() => onToggleWatchLater(video)}
              title={isWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
            >
              <ClockIcon size={16} />
              <span>{isWatchLater ? 'Saved' : 'Watch Later'}</span>
            </button>

            {/* Share button */}
            <button
              className="action-pill-btn"
              onClick={handleShare}
              title="Share"
            >
              <ShareIcon size={16} />
              <span>Share</span>
            </button>

            {/* Save to Playlist */}
            <button
              className="action-pill-btn"
              onClick={() => onOpenSaveToPlaylist && onOpenSaveToPlaylist(video)}
              title="Save to playlist"
            >
              <PlaylistIcon size={16} />
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Description Box */}
        <div
          className={`watch-description-box ${isDescExpanded ? 'expanded' : 'collapsed'}`}
          onClick={() => !isDescExpanded && setIsDescExpanded(true)}
        >
          <div className="desc-stats">
            <span className="desc-stats-views">{video.views}</span> &nbsp;•&nbsp; <span>{video.uploadDate}</span>
          </div>
          <div className="desc-body">
            <p className="desc-text">
              {isDescExpanded
                ? (video.description || 'No description available for this video.')
                : (video.description && video.description.length > 200
                  ? `${video.description.slice(0, 200)}...`
                  : (video.description || 'No description available for this video.'))}
            </p>
          </div>
          {video.description && video.description.length > 200 && (
            <button
              type="button"
              className="desc-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescExpanded(!isDescExpanded);
              }}
            >
              {isDescExpanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="desc-tags">
              {video.tags.map((tag) => (
                <span key={tag} className="desc-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Comments Section */}
        <CommentsSection
          videoId={video.videoId || video._id}
          currentUser={currentUser}
          onRequireAuth={onRequireAuth}
          onNotify={onNotify}
        />
      </div>

      {/* Up Next / Related Column */}
      <div className="watch-related-column">
        {/* Playlist Queue Box if playing a playlist */}
        {isPlaylistMode && (
          <div className="playlist-queue-box">
            <div className="playlist-queue-header">
              <div className="playlist-queue-title-row">
                <PlaylistIcon size={20} />
                <div className="playlist-queue-titles">
                  <h4 className="playlist-queue-title">{playlistContext.title}</h4>
                  <p className="playlist-queue-sub">
                    Video {playlistContext.currentIndex + 1} of {playlistContext.videos.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="playlist-queue-list">
              {playlistContext.videos.map((item, idx) => {
                const isCurrent = idx === playlistContext.currentIndex;
                const itemId = item.videoId || item._id;

                return (
                  <div
                    key={`queue-${itemId}-${idx}`}
                    className={`playlist-queue-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      if (!isCurrent) {
                        onSelectVideo(item, {
                          ...playlistContext,
                          currentIndex: idx,
                        });
                      }
                    }}
                  >
                    <span className="queue-item-index">
                      {isCurrent ? '▶' : idx + 1}
                    </span>
                    <div className="queue-thumb-wrap">
                      <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
                      <span className="queue-duration">{item.duration}</span>
                    </div>
                    <div className="queue-info">
                      <p className="queue-title" title={item.title}>
                        {item.title}
                      </p>
                      <span className="queue-channel">{item.channelName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Autoplay Toggle Header */}
        <div className="up-next-header">
          <h3 className="related-heading">Up next</h3>
          <div className="autoplay-control">
            <span className="autoplay-label">Autoplay</span>
            <button
              type="button"
              className={`autoplay-switch ${autoplay ? 'on' : 'off'}`}
              onClick={handleToggleAutoplay}
              title={autoplay ? 'Autoplay is on' : 'Autoplay is off'}
            >
              <span className="autoplay-thumb" />
            </button>
          </div>
        </div>

        {/* Related Videos List (Loads more on page scroll) */}
        <div className="related-videos-list">
          {allRelatedVideos.length === 0 ? (
            <div className="related-skeletons-list">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={`rel-skel-${i}`} className="related-skeleton-card">
                  <div className="related-skeleton-thumb shimmer" />
                  <div className="related-skeleton-info">
                    <div className="related-skeleton-line title shimmer" />
                    <div className="related-skeleton-line title-short shimmer" />
                    <div className="related-skeleton-line channel shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            allRelatedVideos.map((item, index) => {
              const relId = item.videoId || item._id;
              const handleRelClick = (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                onSelectVideo(item);
              };

              const relIsWatchLater = Boolean(watchLaterIds && watchLaterIds.includes(relId));

              return (
                <div key={`rel-${relId}-${index}`} className="related-card-wrapper">
                  <Link
                    to={`/watch?v=${encodeURIComponent(relId)}`}
                    state={{ video: item }}
                    className="related-card"
                    onClick={handleRelClick}
                  >
                    <div className="related-thumb-box">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="related-thumb-img"
                        loading="lazy"
                      />
                      <span className="duration-badge">{item.duration}</span>
                    </div>
                    <div className="related-info">
                      <h4 className="related-title" title={item.title}>
                        {item.title}
                      </h4>
                      <p className="related-channel">{item.channelName}</p>
                      <p className="related-meta">
                        {item.views} • {item.uploadDate}
                      </p>
                    </div>
                  </Link>

                  <VideoActionMenu
                    video={item}
                    isWatchLater={relIsWatchLater}
                    onToggleWatchLater={onToggleWatchLater}
                    onOpenSaveToPlaylist={onOpenSaveToPlaylist}
                    onNotify={onNotify}
                    className="related-menu-btn"
                  />
                </div>
              );
            })
          )}

          {/* Infinite Scroll Sentinel for Related Videos: Only render after first batch exists */}
          {allRelatedVideos.length > 0 && (
            <div ref={relatedSentinelRef} className="related-scroll-sentinel">
              {loadingMoreRelated && (
                <div className="related-skeletons-list" style={{ marginTop: '8px' }}>
                  {[1, 2].map((i) => (
                    <div key={`rel-more-skel-${i}`} className="related-skeleton-card">
                      <div className="related-skeleton-thumb shimmer" />
                      <div className="related-skeleton-info">
                        <div className="related-skeleton-line title shimmer" />
                        <div className="related-skeleton-line title-short shimmer" />
                        <div className="related-skeleton-line channel shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Screen sleep prevention loop */}
      <video
        ref={keepAwakeVideoRef}
        playsInline
        muted
        loop
        preload="auto"
        aria-hidden="true"
        width="1"
        height="1"
        src={NO_SLEEP_VIDEO_SRC}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </div>
  );
}
