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
} from './Icons.jsx';
import { apiUrl } from '../config/api.js';

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
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const progressTrackRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const intervalRef = useRef(null);
  const audioAnchorRef = useRef(null);
  const wakeLockRef = useRef(null);
  const shouldBePlayingRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // 'main' or 'speed'
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
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

  useEffect(() => {
    setExtraRelated([]);
    setRelatedPage(1);
    setLoadingMoreRelated(false);
    setHasMoreRelated(true);
  }, [video.videoId || video._id]);

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

  // Fetch more related videos on page scroll
  const fetchMoreRelated = useCallback(async () => {
    if (loadingMoreRelated || !hasMoreRelated) return;
    setLoadingMoreRelated(true);
    try {
      const currentVId = video.videoId || video._id;
      const queryTerm = video.title || video.channelName || '';
      const nextPage = relatedPage + 1;
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
          setRelatedPage(nextPage);
        } else {
          setHasMoreRelated(false);
        }
      } else {
        setHasMoreRelated(false);
      }
    } catch (err) {
      console.warn('Error loading more related videos:', err);
    } finally {
      setLoadingMoreRelated(false);
    }
  }, [loadingMoreRelated, hasMoreRelated, relatedPage, video, relatedVideos, extraRelated]);

  useEffect(() => {
    const sentinel = relatedSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreRelated();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMoreRelated]);

  // Screen Wake Lock API to prevent phone / PC display sleep while playing
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (_) { }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => { });
      wakeLockRef.current = null;
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
        // Finished all playlist videos, smoothly start playing up next video
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

  // Handle video end state (Plays up next after playlist finishes if autoplay is on)
  const handleVideoEnded = useCallback(() => {
    if (autoplay) {
      if (isPlaylistMode) {
        if (playlistNextVideo || upNextVideo) {
          playNextVideo();
        }
      } else if (nextVideo) {
        playNextVideo();
      }
    }
  }, [autoplay, isPlaylistMode, playlistNextVideo, upNextVideo, nextVideo, playNextVideo]);

  const handleVideoEndedRef = useRef(null);
  handleVideoEndedRef.current = handleVideoEnded;

  // Load YouTube IFrame API and initialize player (strictly only on video ID change)
  useEffect(() => {
    let isMounted = true;
    const vId = video.videoId || video._id;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    shouldBePlayingRef.current = true;

    const setupPlayer = () => {
      if (!isMounted) return;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) { }
      }

      try {
        playerRef.current = new window.YT.Player(`yt-player-target-${vId}`, {
          videoId: vId,
          playerVars: {
            autoplay: 1,
            controls: 0, // Removes native controls and hides the top title bar!
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            playsinline: 1,
            cc_load_policy: 0, // Closed captions disabled as requested
          },
          events: {
            onReady: (e) => {
              if (!isMounted) return;
              e.target.playVideo();
              shouldBePlayingRef.current = true;
              audioAnchorRef.current?.play().catch(() => { });
              requestWakeLock();
              const dur = e.target.getDuration();
              if (dur) setDuration(dur);
              try {
                if (typeof e.target.unloadModule === 'function') {
                  e.target.unloadModule('captions');
                }
                if (typeof e.target.setOption === 'function') {
                  e.target.setOption('captions', 'track', {});
                }
              } catch (_) { }
            },
            onStateChange: (e) => {
              if (!isMounted) return;
              // 0: ended, 1: playing, 2: paused, 3: buffering
              if (e.data === 0) {
                handleVideoEndedRef.current?.();
              } else if (e.data === 1) {
                setIsPlaying(true);
                shouldBePlayingRef.current = true;
                audioAnchorRef.current?.play().catch(() => { });
                requestWakeLock();
              } else if (e.data === 2) {
                // If browser/OS paused playback due to minimize or screen lock, resume playback automatically!
                if (document.hidden && shouldBePlayingRef.current) {
                  setTimeout(() => {
                    if (shouldBePlayingRef.current && playerRef.current && typeof playerRef.current.playVideo === 'function') {
                      audioAnchorRef.current?.play().catch(() => { });
                      playerRef.current.playVideo();
                    }
                  }, 80);
                  return;
                }
                setIsPlaying(false);
                releaseWakeLock();
                audioAnchorRef.current?.pause();
              }
            },
            onApiChange: () => { },
          },
        });
      } catch (err) {
        console.error('Error creating YouTube player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        setupPlayer();
      };
      if (!document.getElementById('yt-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'yt-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
    }

    // Polling interval for timeline progress and completion check
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(cur);
          if (dur > 0 && dur !== duration) setDuration(dur);

          // Sync captions status
          try {
            const track = playerRef.current.getOption('captions', 'track');
            const hasTrack = Boolean(track && (track.languageCode || track.displayName || track.languageName || Object.keys(track).length > 0));
            setIsCCActive((prev) => (prev !== hasTrack ? hasTrack : prev));
          } catch (_) { }

          // Backup check for video ending
          if (dur > 0 && cur >= dur - 0.5) {
            handleVideoEndedRef.current?.();
          }
        } catch (_) { }
      }
    }, 500);

    return () => {
      isMounted = false;
      releaseWakeLock();
      audioAnchorRef.current?.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) { }
      }
    };
  }, [video.videoId || video._id, requestWakeLock, releaseWakeLock]);

  // Keep playing when minimized or when screen sleeps / locks
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Minimized / screen turned off: keep audio & video playing
        if (shouldBePlayingRef.current && playerRef.current && typeof playerRef.current.playVideo === 'function') {
          audioAnchorRef.current?.play().catch(() => { });
          playerRef.current.playVideo();
        }
      } else {
        // Foreground restored: re-engage wake lock to keep screen awake while watching
        if (shouldBePlayingRef.current) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [requestWakeLock]);

  // Set up Media Session API for OS-level background playback controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !video) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.title || 'YouTube Video',
        artist: video.channelName || 'YouTube Creator',
        album: 'Bintube',
        artwork: [
          {
            src:
              video.thumbnailUrl ||
              `https://i.ytimg.com/vi/${video.videoId || video._id}/hqdefault.jpg`,
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        shouldBePlayingRef.current = true;
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
          setIsPlaying(true);
          audioAnchorRef.current?.play().catch(() => { });
          requestWakeLock();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        shouldBePlayingRef.current = false;
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
          audioAnchorRef.current?.pause();
          releaseWakeLock();
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(Math.max(0, currentTime - offset), true);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(Math.min(duration, currentTime + offset), true);
        }
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(details.seekTime, true);
        }
      });

      if (nextVideo) {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNextVideo();
        });
      }
    } catch (_) { }

    return () => {
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
        }
      } catch (_) { }
    };
  }, [video, nextVideo, playNextVideo, currentTime, duration, requestWakeLock, releaseWakeLock]);

  // Sync playbackState with OS media controller
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Sync position state with OS lock screen scrubber
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (duration > 0 && currentTime >= 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: playbackSpeed || 1,
          position: Math.min(Math.max(0, currentTime), duration),
        });
      } catch (_) { }
    }
  }, [currentTime, duration, playbackSpeed]);

  const settingsMenuRef = useRef(null);

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

  // Autohide controls logic
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (isPlaying && !showSettings) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettings) {
      setShowControls(false);
    }
  };

  // UI Ripple feedback for double-tap seeking
  const triggerRipple = (direction) => {
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    setRipple(direction);
    rippleTimerRef.current = setTimeout(() => {
      setRipple(null);
    }, 650);
  };

  // Center flash icon feedback for play/pause
  const triggerFlash = (action) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setActionFlash(action);
    flashTimerRef.current = setTimeout(() => {
      setActionFlash(null);
    }, 550);
  };

  // Relative Seek (+10s, -10s, +5s, etc.)
  const seekRelative = useCallback((offset) => {
    if (!playerRef.current) return;
    const target = Math.max(0, Math.min(duration || 0, currentTime + offset));
    setCurrentTime(target);
    try {
      playerRef.current.seekTo(target, true);
    } catch (_) { }
    if (offset > 0) {
      triggerRipple('right');
    } else {
      triggerRipple('left');
    }
  }, [currentTime, duration]);

  // Speed selection handler
  const changePlaybackSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
    previousSpeedRef.current = speed;
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch (_) { }
    }
    if (typeof onNotify === 'function') {
      onNotify(`Speed: ${speed === 1 ? 'Normal' : `${speed}x`}`);
    }
  }, [onNotify]);

  // Play / Pause toggle
  const togglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        shouldBePlayingRef.current = false;
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        releaseWakeLock();
        audioAnchorRef.current?.pause();
        triggerFlash('pause');
      } else {
        shouldBePlayingRef.current = true;
        playerRef.current.playVideo();
        setIsPlaying(true);
        audioAnchorRef.current?.play().catch(() => { });
        requestWakeLock();
        triggerFlash('play');
      }
    } catch (_) { }
  }, [isPlaying, releaseWakeLock, requestWakeLock]);

  // Pointer / Touch Handlers for Hold to 2X & Double-Tap Seeking
  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    hasHeldRef.current = false;
    isHolding2xRef.current = false;

    // Detect hold for > 350ms to engage 2X speed
    holdTimerRef.current = setTimeout(() => {
      isHolding2xRef.current = true;
      hasHeldRef.current = true;
      setIsHolding2x(true);
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        try {
          playerRef.current.setPlaybackRate(2);
        } catch (_) { }
      }
    }, 350);
  };

  const handlePointerUp = (e) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHolding2xRef.current) {
      // Revert from 2X hold mode
      isHolding2xRef.current = false;
      setIsHolding2x(false);
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        try {
          playerRef.current.setPlaybackRate(previousSpeedRef.current || 1);
        } catch (_) { }
      }
      return;
    }

    if (hasHeldRef.current) {
      hasHeldRef.current = false;
      return;
    }

    // Handle Click vs Double Tap (Left/Right)
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX);
    if (clientX === undefined) return;
    const relativeX = clientX - rect.left;
    const isLeft = relativeX < rect.width * 0.35;
    const isRight = relativeX > rect.width * 0.65;

    const now = Date.now();
    if (lastTapRef.current && (now - lastTapRef.current.time) < 320) {
      // Double tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      if (isRight) {
        seekRelative(10); // 10s forward
      } else if (isLeft) {
        seekRelative(-10); // 10s backward
      } else {
        toggleFullscreen();
      }
    } else {
      // First tap: buffer for single click (toggle play/pause)
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
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        try {
          playerRef.current.setPlaybackRate(previousSpeedRef.current || 1);
        } catch (_) { }
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

    if (playerRef.current) {
      try {
        if (nextState) {
          if (typeof playerRef.current.loadModule === 'function') {
            playerRef.current.loadModule('captions');
          }
          let trackList = [];
          if (typeof playerRef.current.getOption === 'function') {
            trackList = playerRef.current.getOption('captions', 'tracklist') || [];
          }
          const track = trackList.find(t => t.languageCode?.startsWith('en')) || trackList[0] || { languageCode: 'en' };
          if (typeof playerRef.current.setOption === 'function') {
            playerRef.current.setOption('captions', 'track', track);
            playerRef.current.setOption('captions', 'fontSize', 1);
          }
        } else {
          if (typeof playerRef.current.setOption === 'function') {
            playerRef.current.setOption('captions', 'track', {});
          }
          if (typeof playerRef.current.unloadModule === 'function') {
            playerRef.current.unloadModule('captions');
          }
        }
      } catch (err) {
        console.warn('Caption toggle error:', err);
      }
    }

    if (typeof onNotify === 'function') {
      onNotify(nextState ? 'Subtitles / CC turned on' : 'Subtitles turned off');
    }
  }, [isCCActive, onNotify]);

  // Seek on scrubber (supports mouse click/move and mobile touch drag)
  const handleScrub = (e) => {
    if (!progressTrackRef.current || !duration || !playerRef.current) return;
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setCurrentTime(targetTime);
    try {
      playerRef.current.seekTo(targetTime, true);
    } catch (_) { }
  };

  const handleProgressHover = (e) => {
    if (!progressTrackRef.current || !duration) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  // Volume
  const handleVolumeChange = (e) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(newVol);
        if (newVol > 0 && isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
        }
      } catch (_) { }
    }
  };

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (_) { }
  }, [isMuted]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  }, []);

  // Keyboard Shortcuts (K to pause/play, J for +10s, L for -10s)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase())) return;

      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        seekRelative(10); // 10s forward as requested
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        seekRelative(-10); // 10s backward as requested
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        handleToggleCC();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.code === 'KeyN' && e.shiftKey) {
        e.preventDefault();
        playNextVideo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seekRelative, toggleMute, toggleFullscreen, handleToggleCC, playNextVideo]);

  // Social / Share (Copies internal website watch URL, NOT YouTube URL)
  const handleShare = () => {
    const vId = video.videoId || video._id;
    const siteUrl = `${window.location.origin}/watch?v=${encodeURIComponent(vId)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(siteUrl);
      if (typeof onNotify === 'function') {
        onNotify('Video link copied to clipboard!');
      }
    } else {
      if (typeof onNotify === 'function') {
        onNotify(`Link: ${siteUrl}`);
      }
    }
  };

  const handleToggleAutoplay = () => {
    const nextVal = !autoplay;
    setAutoplay(nextVal);
    localStorage.setItem('yt_autoplay', String(nextVal));
    onNotify(nextVal ? 'Autoplay is on' : 'Autoplay is off');
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`watch-page ${isTheater ? 'theater-layout' : ''}`}>
      {/* Primary Left Video Column */}
      <div className="watch-player-column">
        {/* Full-width YouTube Player Container with Custom Controller (Image 3) */}
        <div
          ref={containerRef}
          className={`yt-custom-player-wrapper ${showControls || !isPlaying || showSettings ? 'controls-visible' : ''} ${isCCActive ? 'has-active-cc' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* YouTube Target Element with Fixed Cropping Scaler */}
          <div className="yt-video-embed-box">
            <div className="yt-iframe-scaler">
              <div id={`yt-player-target-${video.videoId || video._id}`} />
            </div>
          </div>

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

          {/* BOTTOM CONTROLLER BAR (Matches Third Image Perfectly!) */}
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
                  onClick={togglePlayPause}
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
                {/* Settings Gear with HD Badge */}
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
                    <span className="yt-hd-badge">HD</span>
                  </button>

                  {/* Settings Popup Menu */}
                  {showSettings && (
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
                                className={`yt-menu-item ${playbackSpeed === spd ? 'active-speed' : ''}`}
                                onClick={() => {
                                  changePlaybackSpeed(spd);
                                  setSettingsView('main');
                                }}
                              >
                                <span className="yt-speed-val-label">
                                  {spd === 1 ? 'Normal (1x)' : `${spd}x`}
                                </span>
                                {playbackSpeed === spd && (
                                  <CheckIcon size={16} className="yt-check-active" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="yt-settings-main-panel">
                          <div className="yt-settings-header-row">
                            <SettingsIcon size={16} />
                            <span>Playback Settings</span>
                          </div>

                          {/* Quality Row */}
                          <div className="yt-settings-row-interactive">
                            <div className="yt-row-left">
                              <span className="yt-row-icon-badge">HD</span>
                              <span className="yt-row-title">Quality</span>
                            </div>
                            <div className="yt-row-right">
                              <span className="yt-quality-pill">1080p HD</span>
                            </div>
                          </div>

                          {/* Playback Speed Row */}
                          <div
                            className="yt-settings-row-interactive"
                            onClick={() => setSettingsView('speed')}
                            title="Change playback speed"
                          >
                            <div className="yt-row-left">
                              <SpeedometerIcon size={17} />
                              <span className="yt-row-title">Playback speed</span>
                            </div>
                            <div className="yt-row-right">
                              <span className="yt-speed-current-pill">
                                {playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}
                              </span>
                              <span className="yt-menu-nav-arrow">›</span>
                            </div>
                          </div>

                          {/* Autoplay Row */}
                          <div
                            className="yt-settings-row-interactive"
                            onClick={handleToggleAutoplay}
                            title="Toggle autoplay"
                          >
                            <div className="yt-row-left">
                              <PlayIcon size={16} />
                              <span className="yt-row-title">Autoplay</span>
                            </div>
                            <div className="yt-row-right">
                              <div className={`yt-mini-switch ${autoplay ? 'on' : 'off'}`}>
                                <span className="yt-mini-thumb" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Miniplayer / Theater Mode Button */}
                <button
                  className="yt-ctrl-btn yt-theater-btn"
                  onClick={() => setIsTheater(!isTheater)}
                  title={isTheater ? 'Default view' : 'Theater mode (t)'}
                >
                  <TheaterIcon size={20} />
                </button>

                {/* Fullscreen Button */}
                <button
                  className="yt-ctrl-btn"
                  onClick={toggleFullscreen}
                  title="Full screen (f)"
                >
                  {isFullscreen ? <FullscreenExitIcon size={20} /> : <FullscreenIcon size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Title (Cleanly below the player, NOT on top) */}
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
            {/* Static Likes with interactive toggle */}
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
            <div className="related-loading-box">
              <div className="spinner"></div>
              <span>Finding related videos...</span>
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

              return (
                <Link
                  key={`rel-${relId}-${index}`}
                  to={`/watch?v=${encodeURIComponent(relId)}`}
                  state={{ video: item }}
                  className={`related-card ${index === 0 && autoplay ? 'next-in-queue' : ''}`}
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
              );
            })
          )}

          {/* Infinite Scroll Sentinel for Related Videos */}
          <div ref={relatedSentinelRef} className="related-scroll-sentinel">
            {loadingMoreRelated && (
              <div className="related-loading-more-box">
                <div className="spinner"></div>
                <span>Loading more videos...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Silent audio anchor to keep audio pipeline active when browser is minimized or phone/PC screen is locked */}
      <audio
        ref={audioAnchorRef}
        loop
        playsInline
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        style={{ display: 'none' }}
      />
    </div>
  );
}
