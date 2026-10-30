import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThumbsUpIcon,
  ClockIcon,
  DownloadIcon,
  ShareIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  NextTrackIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
  SubtitlesIcon,
  SettingsIcon,
  TheaterIcon,
  FullscreenIcon,
  FullscreenExitIcon,
} from './Icons.jsx';

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
  onDownload,
  onNotify,
  isLiked = false,
  onToggleLike,
  isSubscribed = false,
  onToggleSubscribe,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const progressTrackRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const intervalRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isCCActive, setIsCCActive] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Autoplay preference (defaults to true)
  const [autoplay, setAutoplay] = useState(() => {
    return localStorage.getItem('yt_autoplay') !== 'false';
  });

  const nextVideo = relatedVideos && relatedVideos.length > 0 ? relatedVideos[0] : null;

  // Next video transition handler
  const playNextVideo = useCallback(() => {
    if (nextVideo) {
      onNotify(`Playing next: ${nextVideo.title.slice(0, 30)}...`);
      onSelectVideo(nextVideo);
    }
  }, [nextVideo, onNotify, onSelectVideo]);

  // Handle video end state
  const handleVideoEnded = useCallback(() => {
    if (autoplay && nextVideo) {
      playNextVideo();
    }
  }, [autoplay, nextVideo, playNextVideo]);

  const handleVideoEndedRef = useRef(null);
  handleVideoEndedRef.current = handleVideoEnded;

  // Load YouTube IFrame API and initialize player (strictly only on video ID change)
  useEffect(() => {
    let isMounted = true;
    const vId = video.videoId || video._id;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);

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
          },
          events: {
            onReady: (e) => {
              if (!isMounted) return;
              e.target.playVideo();
              const dur = e.target.getDuration();
              if (dur) setDuration(dur);
              try {
                const track = e.target.getOption('captions', 'track');
                const hasTrack = Boolean(track && (track.languageCode || track.displayName || track.languageName || Object.keys(track).length > 0));
                setIsCCActive(hasTrack);
              } catch (_) { }
            },
            onStateChange: (e) => {
              if (!isMounted) return;
              // 0: ended, 1: playing, 2: paused, 3: buffering
              if (e.data === 0) {
                handleVideoEndedRef.current?.();
              } else if (e.data === 1) {
                setIsPlaying(true);
              } else if (e.data === 2) {
                setIsPlaying(false);
              }
            },
            onApiChange: (e) => {
              if (!isMounted || !e.target) return;
              try {
                const track = e.target.getOption('captions', 'track');
                const hasTrack = Boolean(track && (track.languageCode || track.displayName || track.languageName || Object.keys(track).length > 0));
                setIsCCActive(hasTrack);
              } catch (_) { }
            },
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
      try {
        playerRef.current.destroy();
      } catch (_) { }
    }
  };
}, [video.videoId || video._id]);

// Autohide controls logic
const handleMouseMove = () => {
  setShowControls(true);
  if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
  if (isPlaying) {
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 2800);
  }
};

const handleMouseLeave = () => {
  if (isPlaying) {
    setShowControls(false);
    setShowSettings(false);
  }
};

// Play / Pause toggle
const togglePlayPause = () => {
  if (!playerRef.current) return;
  try {
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  } catch (_) { }
};

// Subtitles / Closed Captions Toggle
const handleToggleCC = (e) => {
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
        if (trackList && trackList.length > 0) {
          playerRef.current.setOption('captions', 'track', trackList[0]);
        } else {
          playerRef.current.setOption('captions', 'track', { languageCode: '' });
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
  };

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

const toggleMute = () => {
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
};

// Fullscreen
const toggleFullscreen = () => {
  if (!containerRef.current) return;
  if (!document.fullscreenElement) {
    containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
  } else {
    document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
  }
};

// Keyboard Shortcuts
useEffect(() => {
  const handleKeyDown = (e) => {
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;

    if (e.code === 'Space' || e.code === 'KeyK') {
      e.preventDefault();
      togglePlayPause();
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
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(Math.min(duration, currentTime + 5), true);
      }
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(Math.max(0, currentTime - 5), true);
      }
    } else if (e.code === 'KeyN' && e.shiftKey) {
      e.preventDefault();
      playNextVideo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isPlaying, isMuted, currentTime, duration, isCCActive, playNextVideo]);

// Social / Share
const handleShare = () => {
  const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(videoUrl);
    onNotify('YouTube link copied to clipboard!');
  } else {
    onNotify(`Link: ${videoUrl}`);
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
        className={`yt-custom-player-wrapper ${showControls || !isPlaying ? 'controls-visible' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* YouTube Target Element */}
        <div className="yt-video-embed-box">
          <div id={`yt-player-target-${video.videoId || video._id}`} className="yt-iframe-fill" />
        </div>

        {/* Click to Play/Pause overlay */}
        <div
          className="yt-player-click-overlay"
          onClick={togglePlayPause}
          onDoubleClick={toggleFullscreen}
        />

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
              {/* CC (Subtitles) Button */}
              <button
                className={`yt-ctrl-btn yt-cc-btn ${isCCActive ? 'active' : ''}`}
                onClick={handleToggleCC}
                title="Subtitles/closed captions (c)"
              >
                <SubtitlesIcon size={20} />
              </button>

              {/* Settings Gear with HD Badge */}
              <div className="yt-settings-wrapper">
                <button
                  className="yt-ctrl-btn yt-settings-btn"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Settings"
                >
                  <SettingsIcon size={20} />
                  <span className="yt-hd-badge">HD</span>
                </button>

                {/* Settings Popup Menu */}
                {showSettings && (
                  <div className="yt-settings-menu">
                    <div className="yt-menu-header">Playback Settings</div>
                    <div className="yt-menu-item">
                      <span>Quality</span>
                      <span className="yt-menu-val">1080p HD</span>
                    </div>
                    <div className="yt-menu-item" onClick={() => {
                      const speeds = [0.75, 1, 1.25, 1.5, 2];
                      const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                      setPlaybackSpeed(nextSpeed);
                      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
                        playerRef.current.setPlaybackRate(nextSpeed);
                      }
                      onNotify(`Speed: ${nextSpeed}x`);
                    }}>
                      <span>Playback speed</span>
                      <span className="yt-menu-val">{playbackSpeed}x</span>
                    </div>
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

          {/* Download Video button */}
          <button
            className="action-pill-btn"
            onClick={() => onDownload(video)}
            title="Download YouTube Video"
          >
            <DownloadIcon size={16} />
            <span>Download</span>
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
        </div>
      </div>

      {/* Description Box */}
      <div className="watch-description-box">
        <div className="desc-stats">
          <span>{video.views}</span> &nbsp;•&nbsp; <span>{video.uploadDate}</span>
        </div>
        <p className="desc-text">
          {isDescExpanded
            ? video.description
            : `${video.description.slice(0, 180)}${video.description.length > 180 ? '...' : ''}`}
        </p>
        {video.description.length > 180 && (
          <button
            className="desc-toggle-btn"
            onClick={() => setIsDescExpanded(!isDescExpanded)}
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

      {/* Related Videos List */}
      <div className="related-videos-list">
        {relatedVideos.length === 0 ? (
          <div className="related-loading-box">
            <div className="spinner"></div>
            <span>Finding related videos...</span>
          </div>
        ) : (
          relatedVideos.map((item, index) => (
            <div
              key={item.videoId || item._id}
              className={`related-card ${index === 0 && autoplay ? 'next-in-queue' : ''}`}
              onClick={() => onSelectVideo(item)}
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
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);
}
