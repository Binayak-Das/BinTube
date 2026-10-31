import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  SortIcon,
  CheckIcon,
  TrashIcon,
  ChevronDownIcon,
} from './Icons.jsx';
import { apiUrl } from '../config/api.js';

export default function CommentsSection({
  videoId,
  currentUser = null,
  onRequireAuth,
  onNotify,
}) {
  const [comments, setComments] = useState([]);
  const [totalCount, setTotalCount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [continuationToken, setContinuationToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState('top'); // 'top' or 'newest'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(true);

  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedComments, setLikedComments] = useState(new Set());

  const inputRef = useRef(null);
  const sortMenuRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch comments (initial or on sort change)
  const loadInitialComments = useCallback(async (sort) => {
    if (!videoId) return;
    setLoading(true);
    setComments([]);
    setContinuationToken(null);
    setHasMore(false);

    try {
      const res = await fetch(
        apiUrl(`/api/videos/${videoId}/comments?sortBy=${encodeURIComponent(sort)}`)
      );
      if (!res.ok) {
        throw new Error('Failed to fetch comments');
      }
      const data = await res.json();
      setComments(data.comments || []);
      setTotalCount(data.totalCount || `${(data.comments || []).length} Comments`);
      setContinuationToken(data.nextContinuationToken || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadInitialComments(sortBy);
  }, [loadInitialComments, sortBy]);

  // Load more comments (Pagination / Infinite Scroll)
  const handleLoadMore = useCallback(async () => {
    if (!continuationToken || loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const res = await fetch(
        apiUrl(
          `/api/videos/${videoId}/comments?continuation=${encodeURIComponent(
            continuationToken
          )}&sortBy=${encodeURIComponent(sortBy)}`
        )
      );
      if (!res.ok) {
        throw new Error('Failed to load more comments');
      }
      const data = await res.json();
      const newItems = data.comments || [];
      if (newItems.length > 0) {
        setComments((prev) => {
          const seenIds = new Set(prev.map((c) => c.id));
          const filtered = newItems.filter((c) => !seenIds.has(c.id));
          return [...prev, ...filtered];
        });
      }
      setContinuationToken(data.nextContinuationToken || null);
      setHasMore(Boolean(data.hasMore && data.nextContinuationToken));
    } catch (err) {
      console.error('Error loading more comments:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [videoId, continuationToken, loadingMore, hasMore, sortBy]);

  // Infinite scroll observer for loading all comments smoothly inside the separate scrolling area
  useEffect(() => {
    if (!hasMore || loadingMore || !isCommentsExpanded) return;
    const sentinel = sentinelRef.current;
    const rootEl = scrollAreaRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { root: rootEl, rootMargin: '250px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, loadingMore, isCommentsExpanded]);

  // Handle Sort By change
  const handleSortChange = (newSort) => {
    if (newSort === sortBy) {
      setShowSortMenu(false);
      return;
    }
    setSortBy(newSort);
    setShowSortMenu(false);
  };

  const handleInputFocus = () => {
    if (!currentUser) {
      if (typeof onRequireAuth === 'function') {
        onRequireAuth('comment on videos');
      }
      return;
    }
    setIsInputFocused(true);
  };

  const handleCancel = () => {
    setInputText('');
    setIsInputFocused(false);
  };

  const handleSubmitComment = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    if (!currentUser) {
      if (typeof onRequireAuth === 'function') {
        onRequireAuth('comment on videos');
      }
      return;
    }

    const token = localStorage.getItem('bintube_token');
    if (!token) {
      if (typeof onRequireAuth === 'function') {
        onRequireAuth('comment on videos');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/videos/${videoId}/comments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: inputText.trim() }),
      });

      if (!res.ok) {
        throw new Error('Could not submit comment');
      }

      const newComment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setInputText('');
      setIsInputFocused(false);
      if (typeof onNotify === 'function') {
        onNotify('Comment added');
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      if (typeof onNotify === 'function') {
        onNotify('Failed to post comment. Try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete own comment handler
  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmed) return;

    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl(`/api/videos/${videoId}/comments/${commentId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        if (typeof onNotify === 'function') {
          onNotify('Comment deleted');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (typeof onNotify === 'function') {
          onNotify(errData.message || 'Failed to delete comment');
        }
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      if (typeof onNotify === 'function') {
        onNotify('Failed to delete comment');
      }
    }
  };

  const toggleCommentLike = (commentId) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // User avatar URL helper
  const getUserAvatar = () => {
    if (currentUser?.avatar) return currentUser.avatar;
    if (currentUser?.name) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        currentUser.name
      )}&background=cc0000&color=fff&size=80`;
    }
    return 'https://ui-avatars.com/api/?name=User&background=272727&color=aaa&size=80';
  };

  return (
    <div className="comments-section-container">
      {/* Comments Header with Sort By Dropdown and Collapse/Expand */}
      <div className="comments-header">
        <div className="comments-title-wrap">
          <button
            type="button"
            className="comments-expand-toggle-btn"
            onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
            title={isCommentsExpanded ? 'Collapse comments' : 'Expand comments'}
          >
            <h3 className="comments-count-title">
              {totalCount || (loading ? 'Comments' : `${comments.length} Comments`)}
            </h3>
            <ChevronDownIcon
              size={18}
              className={`comments-chevron-icon ${isCommentsExpanded ? 'expanded' : ''}`}
            />
          </button>

          {isCommentsExpanded && (
            <div className="comments-sort-wrapper" ref={sortMenuRef}>
              <button
                type="button"
                className="comments-sort-btn"
                onClick={() => setShowSortMenu(!showSortMenu)}
                title="Sort comments"
              >
                <SortIcon size={18} />
                <span>{sortBy === 'newest' ? 'Newest first' : 'Top comments'}</span>
              </button>

              {/* Sort Menu Dropdown */}
              {showSortMenu && (
                <div className="comments-sort-dropdown">
                  <div
                    className={`comments-sort-option ${sortBy === 'top' ? 'active' : ''}`}
                    onClick={() => handleSortChange('top')}
                  >
                    <span>Top comments</span>
                    {sortBy === 'top' && <CheckIcon size={16} className="sort-check-active" />}
                  </div>
                  <div
                    className={`comments-sort-option ${sortBy === 'newest' ? 'active' : ''}`}
                    onClick={() => handleSortChange('newest')}
                  >
                    <span>Newest first</span>
                    {sortBy === 'newest' && <CheckIcon size={16} className="sort-check-active" />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isCommentsExpanded ? (
        <>
          {/* Add Comment Box */}
          <div className="comments-add-box">
            <img
              src={getUserAvatar()}
              alt={currentUser?.name || 'User'}
              className="comment-user-avatar"
            />
            <div className="comment-form-wrap">
              <textarea
                ref={inputRef}
                className={`comment-textarea ${isInputFocused ? 'active' : ''}`}
                placeholder="Add a comment..."
                rows={isInputFocused ? 3 : 1}
                value={inputText}
                onFocus={handleInputFocus}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmitComment();
                  }
                }}
              />
              {isInputFocused && (
                <div className="comment-form-actions">
                  <button
                    type="button"
                    className="comment-cancel-btn"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="comment-submit-btn"
                    onClick={handleSubmitComment}
                    disabled={!inputText.trim() || isSubmitting}
                  >
                    {isSubmitting ? 'Posting...' : 'Comment'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SEPARATE SCROLLING AREA FOR COMMENTS */}
          <div className="comments-scroll-area" ref={scrollAreaRef}>
            <div className="comments-list">
              {loading ? (
                // Shimmer Skeleton Loaders
                <div className="comments-skeletons">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="comment-skeleton-item">
                      <div className="skeleton-avatar shimmer"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-line shimmer short"></div>
                        <div className="skeleton-line shimmer medium"></div>
                        <div className="skeleton-line shimmer long"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="comments-empty-state">
                  <p>No comments yet. Be the first to share what you think!</p>
                </div>
              ) : (
                comments.map((c) => {
                  const isLiked = likedComments.has(c.id);
                  let displayLikes = c.likes && c.likes !== '0' ? c.likes : '';
                  if (isLiked) {
                    const num = parseInt(c.likes, 10);
                    displayLikes = !isNaN(num) ? String(num + 1) : '1';
                  }

                  const isOwnComment = Boolean(
                    c.isUserComment &&
                      currentUser &&
                      (c.userId === (currentUser._id || currentUser.id) || !c.userId)
                  );

                  return (
                    <div key={c.id} className="comment-item">
                      <img
                        src={
                          c.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            c.author || 'U'
                          )}&background=333&color=fff&size=80`
                        }
                        alt={c.author}
                        className="comment-author-avatar"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            c.author || 'U'
                          )}&background=333&color=fff&size=80`;
                        }}
                      />
                      <div className="comment-content">
                        <div className="comment-meta-row">
                          <span className="comment-author-name">{c.author}</span>
                          {c.isUserComment && <span className="comment-you-badge">You</span>}
                          {c.time && <span className="comment-time">{c.time}</span>}
                        </div>
                        <p className="comment-text-body">{c.text}</p>

                        <div className="comment-actions-row">
                          <button
                            type="button"
                            className={`comment-action-pill ${isLiked ? 'liked' : ''}`}
                            onClick={() => toggleCommentLike(c.id)}
                            title="Like"
                          >
                            <ThumbsUpIcon size={14} filled={isLiked} />
                            {displayLikes && <span className="comment-like-count">{displayLikes}</span>}
                          </button>
                          <button
                            type="button"
                            className="comment-action-pill"
                            title="Dislike"
                          >
                            <ThumbsDownIcon size={14} />
                          </button>

                          {/* Option to delete own comment */}
                          {isOwnComment && (
                            <button
                              type="button"
                              className="comment-action-pill comment-delete-btn"
                              onClick={() => handleDeleteComment(c.id)}
                              title="Delete your comment"
                            >
                              <TrashIcon size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Load More Comments / Infinite Scroll Sentinel */}
              {hasMore && (
                <div className="comments-load-more-wrap">
                  <button
                    type="button"
                    className="comments-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <div className="comment-btn-spinner" />
                        <span>Loading more comments...</span>
                      </>
                    ) : (
                      <span>Load more comments</span>
                    )}
                  </button>
                  <div ref={sentinelRef} className="comments-sentinel" />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div
          className="comments-collapsed-preview"
          onClick={() => setIsCommentsExpanded(true)}
        >
          <span>Tap to show {totalCount || 'comments'}</span>
        </div>
      )}
    </div>
  );
}
