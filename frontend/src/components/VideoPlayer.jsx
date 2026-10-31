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
} from './Icons.jsx';
import CommentsSection from './CommentsSection.jsx';
import { apiUrl } from '../config/api.js';

// Base64 1x1 invisible MP4 loop for bulletproof mobile screen wake lock (NoSleep standard)
const NO_SLEEP_VIDEO_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr9tZGF0AAACoAYF//+///AAAAMmF2Y0MBZAAK/+EAGWdkAAqs2V+WXAWyAAADAAIAAAMAYB4kSywBAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACtwAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTQuNjMuMTA0';

// Base64 valid 1-second silent WAV for mobile background audio routing & MediaSession keepalive
const SILENT_AUDIO_SRC =
  'data:audio/wav;base64,UklGRqxYAQBXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YYhYAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

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
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const progressTrackRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const intervalRef = useRef(null);
  const audioAnchorRef = useRef(null);
  const audioContextRef = useRef(null);
  const keepAwakeVideoRef = useRef(null);
  const wakeLockRef = useRef(null);
  const backgroundWorkerRef = useRef(null);
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

  // Audio carrier engine: keeps audio hardware pipe & MediaSession active in OS
  const ensureAudioCarrier = useCallback(() => {
    try {
      if (audioAnchorRef.current) {
        audioAnchorRef.current.play().catch(() => {});
      }
    } catch (_) {}

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001; // virtually inaudible carrier
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioContextRef.current = ctx;
        } else if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
    } catch (_) {}
  }, []);

  // Multi-tier Screen Wake Lock API & NoSleep fallback to prevent phone / PC display sleep while playing
  const requestWakeLock = useCallback(async () => {
    // 1. Native Screen Wake Lock API
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (_) { }
    }

    // 2. Continuous Video Keep-Awake fallback (100% works on iOS Safari & Android Chrome)
    try {
      if (keepAwakeVideoRef.current && keepAwakeVideoRef.current.paused) {
        keepAwakeVideoRef.current.play().catch(() => {});
      }
    } catch (_) {}

    // 3. Audio session keepalive
    ensureAudioCarrier();
  }, [ensureAudioCarrier]);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => { });
      wakeLockRef.current = null;
    }
    if (keepAwakeVideoRef.current) {
      try {
        keepAwakeVideoRef.current.pause();
      } catch (_) {}
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

  // Handle video end state (Plays up next after playlist finishes if autoplay is on, or loops)
  const handleVideoEnded = useCallback(() => {
    if (isLooping) {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(0, true);
        playerRef.current.playVideo();
        setIsPlaying(true);
        return;
      }
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
              ensureAudioCarrier();
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
                if ('mediaSession' in navigator) {
                  try {
                    navigator.mediaSession.playbackState = 'playing';
                  } catch (_) {}
                }
                ensureAudioCarrier();
                requestWakeLock();
              } else if (e.data === 2) {
                // If browser/OS paused playback due to minimize or screen off, auto-play immediately!
                if (document.hidden && shouldBePlayingRef.current) {
                  ensureAudioCarrier();
                  setIsPlaying(true);
                  if ('mediaSession' in navigator) {
                    try {
                      navigator.mediaSession.playbackState = 'playing';
                    } catch (_) {}
                  }

                  try {
                    playerRef.current?.playVideo();
                  } catch (_) {}

                  // Rapid bursts of automatic re-play commands so playback never stops
                  [30, 90, 200, 450, 900].forEach((delay) => {
                    setTimeout(() => {
                      if (shouldBePlayingRef.current && document.hidden) {
                        try {
                          playerRef.current?.playVideo();
                        } catch (_) {}
                      }
                    }, delay);
                  });
                  return;
                }
                setIsPlaying(false);
                if ('mediaSession' in navigator) {
                  try {
                    navigator.mediaSession.playbackState = 'paused';
                  } catch (_) {}
                }
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
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend().catch(() => {});
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) { }
      }
    };
  }, [video.videoId || video._id, requestWakeLock, releaseWakeLock, ensureAudioCarrier]);

  // Periodic Screen Wake Lock Heartbeat (ensures screen never sleeps while playing)
  useEffect(() => {
    if (!isPlaying) return;
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (!wakeLockRef.current) {
          requestWakeLock();
        }
        if (keepAwakeVideoRef.current && keepAwakeVideoRef.current.paused) {
          keepAwakeVideoRef.current.play().catch(() => {});
        }
      }
    }, 12000);

    return () => clearInterval(heartbeat);
  }, [isPlaying, requestWakeLock]);

  // Web Worker Background Watchdog:
  // Automatically forces the video to keep playing when minimized or when the screen turns off,
  // completely bypassing mobile browser background timer throttling!
  useEffect(() => {
    let worker = null;
    try {
      const workerBlob = new Blob(
        [
          `let interval = null;
          self.onmessage = function(e) {
            if (e.data === 'start') {
              if (!interval) {
                interval = setInterval(function() {
                  self.postMessage('ping');
                }, 500);
              }
            } else if (e.data === 'stop') {
              if (interval) {
                clearInterval(interval);
                interval = null;
              }
            }
          };`
        ],
        { type: 'application/javascript' }
      );
      worker = new Worker(URL.createObjectURL(workerBlob));
      backgroundWorkerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data === 'ping') {
          if (shouldBePlayingRef.current && document.hidden) {
            if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
              try {
                const state = playerRef.current.getPlayerState();
                if (state !== 1 && state !== 3) {
                  playerRef.current.playVideo();
                }
              } catch (_) {}
            }
            try {
              if (audioAnchorRef.current && audioAnchorRef.current.paused) {
                audioAnchorRef.current.play().catch(() => {});
              }
            } catch (_) {}
          }
        }
      };

      worker.postMessage('start');
    } catch (err) {
      console.warn('Background worker error:', err);
    }

    return () => {
      if (worker) {
        worker.postMessage('stop');
        worker.terminate();
        backgroundWorkerRef.current = null;
      }
    };
  }, []);

  // Automatically plays video when app is minimized or screen turns off
  useEffect(() => {
    const triggerAutoResume = () => {
      if (!shouldBePlayingRef.current) return;
      ensureAudioCarrier();
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try {
          playerRef.current.playVideo();
        } catch (_) {}
      }
      [30, 90, 200, 450, 900].forEach((ms) => {
        setTimeout(() => {
          if (shouldBePlayingRef.current && playerRef.current && typeof playerRef.current.playVideo === 'function') {
            try {
              playerRef.current.playVideo();
            } catch (_) {}
          }
        }, ms);
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        // Minimized / screen turned off: automatically keep playing!
        triggerAutoResume();
      } else {
        // Foreground restored: re-engage wake lock and resume
        if (shouldBePlayingRef.current) {
          requestWakeLock();
          if (keepAwakeVideoRef.current && keepAwakeVideoRef.current.paused) {
            keepAwakeVideoRef.current.play().catch(() => {});
          }
          if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
            try {
              playerRef.current.playVideo();
              setIsPlaying(true);
            } catch (_) {}
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', triggerAutoResume);
    window.addEventListener('blur', triggerAutoResume);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', triggerAutoResume);
      window.removeEventListener('blur', triggerAutoResume);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [requestWakeLock, ensureAudioCarrier]);

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
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          audioContextRef.current.suspend().catch(() => {});
        }
        triggerFlash('pause');
      } else {
        shouldBePlayingRef.current = true;
        playerRef.current.playVideo();
        setIsPlaying(true);
        ensureAudioCarrier();
        requestWakeLock();
        triggerFlash('play');
      }
    } catch (_) { }
  }, [isPlaying, releaseWakeLock, requestWakeLock, ensureAudioCarrier]);

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
        setIsPlaying(true);
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'playing';
          } catch (_) {}
        }
        ensureAudioCarrier();
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          try {
            playerRef.current.playVideo();
          } catch (_) {}
        }
        requestWakeLock();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        shouldBePlayingRef.current = false;
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'paused';
          } catch (_) {}
        }
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try {
            playerRef.current.pauseVideo();
          } catch (_) {}
        }
        releaseWakeLock();
        audioAnchorRef.current?.pause();
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          audioContextRef.current.suspend().catch(() => {});
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        seekRelative(-offset);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        seekRelative(offset);
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(details.seekTime, true);
          setCurrentTime(details.seekTime);
        }
      });

      if (nextVideo) {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNextVideo();
        });
      }

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        seekRelative(-10);
      });
    } catch (_) { }

    return () => {
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
        }
      } catch (_) { }
    };
  }, [video, nextVideo, playNextVideo, currentTime, duration, requestWakeLock, releaseWakeLock, ensureAudioCarrier, seekRelative]);

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

  // Social / Share via Native Web Share API (navigator.share)
  const handleShare = async () => {
    const vId = video?.videoId || video?._id;
    if (!vId) return;
    const origin = window.location.origin || 'http://localhost:5173';
    const shareUrl = `${origin}/watch?v=${encodeURIComponent(vId)}`;
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
        if (err && (err.name === 'AbortError' || err.code === 20)) {
          return;
        }
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (typeof onNotify === 'function') {
          onNotify('Link copied to clipboard');
        }
        return;
      } catch (_) {}
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
    onNotify(nextVal ? 'Loop video is on' : 'Loop video is off');
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

                          {/* Loop Video Row */}
                          <div
                            className="yt-settings-row-interactive"
                            onClick={handleToggleLoop}
                            title="Loop video"
                          >
                            <div className="yt-row-left">
                              <LoopIcon size={17} />
                              <span className="yt-row-title">Loop video</span>
                            </div>
                            <div className="yt-row-right">
                              <div className={`yt-mini-switch ${isLooping ? 'on' : 'off'}`}>
                                <span className="yt-mini-thumb" />
                              </div>
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
                  </>
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

        {/* Comments Section (Display real YouTube & user comments) */}
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

      {/* Screen sleep prevention loop (NoSleep HTML5 video technique - 100% works across all mobile browsers) */}
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

      {/* Audio carrier element to keep OS audio hardware session & lock screen media notification alive */}
      <audio
        ref={audioAnchorRef}
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        src={SILENT_AUDIO_SRC}
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
