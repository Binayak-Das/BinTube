import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVerticalIcon, ClockIcon, PlaylistIcon, ShareIcon } from './Icons.jsx';

function calculateMenuCoords(btnEl) {
  if (!btnEl) return { top: 0, left: 0 };
  const rect = btnEl.getBoundingClientRect();
  const menuWidth = 224;
  const menuHeight = 200;

  // Determine vertical placement: open downwards, or upwards if near viewport bottom
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = rect.bottom + 6;
  if (spaceBelow < menuHeight && rect.top > menuHeight) {
    top = Math.max(8, rect.top - menuHeight - 6);
  }

  // Determine horizontal placement: align right with button, bounded to screen edges
  let left = rect.right - menuWidth;
  if (left < 8) {
    left = 8;
  } else if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8;
  }

  return { top, left };
}

export default function VideoActionMenu({
  video,
  isWatchLater = false,
  onToggleWatchLater,
  onOpenSaveToPlaylist,
  onNotify,
  extraAction = null,
  align = 'right',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  const updateCoords = useCallback(() => {
    if (!btnRef.current) return;
    setCoords(calculateMenuCoords(btnRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateCoords();
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleOutsideClick = (e) => {
      if (
        btnRef.current &&
        btnRef.current.contains(e.target)
      ) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      // Close dropdown smoothly on scroll to avoid visual detachment
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateCoords]);

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);

    const vId = video.videoId || video._id;
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

  return (
    <div
      className={`yt-action-menu-container ${isOpen ? 'is-open' : ''} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="yt-three-dots-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isOpen && btnRef.current) {
            setCoords(calculateMenuCoords(btnRef.current));
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        }}
        title="More options"
        aria-label="More options"
      >
        <MoreVerticalIcon size={18} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="yt-three-dots-dropdown yt-portal-dropdown"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 999999999,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {onToggleWatchLater && (
              <button
                type="button"
                className="yt-three-dots-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  onToggleWatchLater(video);
                }}
              >
                <ClockIcon size={18} />
                <span>{isWatchLater ? 'Remove from Watch Later' : 'Watch Later'}</span>
              </button>
            )}

            {onOpenSaveToPlaylist && (
              <button
                type="button"
                className="yt-three-dots-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenSaveToPlaylist(video);
                }}
              >
                <PlaylistIcon size={18} />
                <span>Save to playlist</span>
              </button>
            )}

            <button
              type="button"
              className="yt-three-dots-item"
              onClick={handleShare}
            >
              <ShareIcon size={18} />
              <span>Share</span>
            </button>

            {extraAction && (
              <button
                type="button"
                className={`yt-three-dots-item ${extraAction.danger ? 'danger-item' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  extraAction.onClick(video);
                }}
              >
                {extraAction.icon}
                <span>{extraAction.label}</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
