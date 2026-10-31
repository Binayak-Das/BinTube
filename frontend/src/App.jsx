import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import CategoryBar from './components/CategoryBar.jsx';
import VideoCard from './components/VideoCard.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import WatchLaterPage from './components/WatchLaterPage.jsx';
import SearchResultsPage from './components/SearchResultsPage.jsx';
import SubscriptionsPage from './components/SubscriptionsPage.jsx';
import LikedVideosPage from './components/LikedVideosPage.jsx';
import PlaylistsPage from './components/PlaylistsPage.jsx';
import SaveToPlaylistModal from './components/SaveToPlaylistModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import { apiUrl } from './config/api.js';

const DEFAULT_SUBSCRIBED_CHANNELS = [];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine active page and parameters from current URL
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  let activePage = 'home';
  if (pathname === '/subscriptions' || pathname === '/feed/subscriptions') {
    activePage = 'subscriptions';
  } else if (
    pathname === '/liked' ||
    (pathname === '/playlist' && searchParams.get('list') === 'LL')
  ) {
    activePage = 'liked';
  } else if (
    pathname === '/watch-later' ||
    (pathname === '/playlist' && searchParams.get('list') === 'WL')
  ) {
    activePage = 'watch-later';
  } else if (
    pathname === '/playlists' ||
    pathname === '/playlist'
  ) {
    activePage = 'playlists';
  } else if (pathname === '/results' || pathname === '/search') {
    activePage = 'search';
  } else if (pathname === '/watch') {
    activePage = 'watch';
  }

  // Active query parameters
  const searchQuery =
    searchParams.get('search_query') || searchParams.get('q') || '';
  const category = searchParams.get('category') || 'All';
  const activeVideoId = searchParams.get('v') || '';

  // Watch video state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Feed & Infinite scroll
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // User state
  const [user, setUser] = useState(null);
  const [watchLaterIds, setWatchLaterIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('yt_guest_wl') || '[]');
    } catch {
      return [];
    }
  });
  const [watchLaterVideos, setWatchLaterVideos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('yt_guest_wl_v') || '[]');
    } catch {
      return [];
    }
  });

  // Liked Videos State
  const [likedVideos, setLikedVideos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('yt_liked_videos') || '[]');
    } catch {
      return [];
    }
  });
  const [likedVideoIds, setLikedVideoIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('yt_liked_video_ids') || '[]');
    } catch {
      return [];
    }
  });

  // Subscribed Channels State
  const [subscribedChannels, setSubscribedChannels] = useState(() => {
    try {
      const stored = localStorage.getItem('yt_subscribed_channels');
      return stored ? JSON.parse(stored) : DEFAULT_SUBSCRIBED_CHANNELS;
    } catch {
      return DEFAULT_SUBSCRIBED_CHANNELS;
    }
  });

  // Playlists State
  const [playlists, setPlaylists] = useState([]);
  const [saveToPlaylistTarget, setSaveToPlaylistTarget] = useState(null);
  const [playlistContext, setPlaylistContext] = useState(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const isFetchingRef = useRef(false);
  const fetchIdRef = useRef(0);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  // Load all user data from backend MongoDB (Personalized account storage)
  const loadUserData = useCallback(async (token) => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, likedRes, subsRes, plRes, wlRes] = await Promise.allSettled([
        fetch(apiUrl('/api/auth/me'), { headers }),
        fetch(apiUrl('/api/liked-videos'), { headers }),
        fetch(apiUrl('/api/subscriptions'), { headers }),
        fetch(apiUrl('/api/playlists'), { headers }),
        fetch(apiUrl('/api/watch-later'), { headers }),
      ]);

      if (meRes.status === 'fulfilled' && meRes.value.ok) {
        const data = await meRes.value.json();
        setUser(data.user);
      }
      if (likedRes.status === 'fulfilled' && likedRes.value.ok) {
        const data = await likedRes.value.json();
        setLikedVideos(data.videos || []);
        setLikedVideoIds(data.likedVideoIds || (data.videos || []).map((v) => v.videoId));
      }
      if (subsRes.status === 'fulfilled' && subsRes.value.ok) {
        const data = await subsRes.value.json();
        setSubscribedChannels(data.subscribedChannels || []);
      }
      if (plRes.status === 'fulfilled' && plRes.value.ok) {
        const data = await plRes.value.json();
        setPlaylists(data.playlists || []);
      }
      if (wlRes.status === 'fulfilled' && wlRes.value.ok) {
        const data = await wlRes.value.json();
        setWatchLaterVideos(data.videos || []);
        setWatchLaterIds(data.watchLaterIds || (data.videos || []).map((v) => v.videoId));
      }
    } catch (err) {
      console.error('Error loading personalized user data:', err);
    }
  }, []);

  // Restore authenticated user session on mount
  useEffect(() => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      loadUserData(token);
    }
  }, [loadUserData]);

  // Update document title for SEO & YouTube experience
  useEffect(() => {
    if (activePage === 'watch' && selectedVideo) {
      document.title = `${selectedVideo.title} - YouTube`;
    } else if (activePage === 'watch-later') {
      document.title = 'Watch Later - YouTube';
    } else if (activePage === 'subscriptions') {
      document.title = 'Subscriptions - YouTube';
    } else if (activePage === 'liked') {
      document.title = 'Liked videos - YouTube';
    } else if (activePage === 'playlists') {
      document.title = 'Playlists - YouTube';
    } else if (activePage === 'search') {
      document.title = searchQuery
        ? `${searchQuery} - YouTube Search`
        : 'Search - YouTube';
    } else if (category && category !== 'All') {
      document.title = `${category} - YouTube`;
    } else {
      document.title = 'YouTube';
    }
  }, [activePage, selectedVideo, searchQuery, category]);

  // Synchronize /watch page with URL parameter ?v=...
  useEffect(() => {
    if (activePage !== 'watch') return;

    if (!activeVideoId) {
      navigate('/', { replace: true });
      return;
    }

    const currentId = selectedVideo?.videoId || selectedVideo?._id;
    const hasFullDetails = selectedVideo?.hasFullDetails;

    // If already on this video and full details are loaded, just ensure related are loaded
    if (currentId === activeVideoId && hasFullDetails) {
      if (relatedVideos.length === 0) {
        fetch(apiUrl(`/api/videos/${encodeURIComponent(activeVideoId)}`))
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.related?.length) {
              setRelatedVideos(data.related);
            }
          })
          .catch(console.error);
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If passed via Link state, show video preview instantly without waiting for fetch
    if (
      location.state?.video &&
      (location.state.video.videoId === activeVideoId ||
        location.state.video._id === activeVideoId)
    ) {
      setSelectedVideo(location.state.video);
    }

    // Always fetch full video details (complete description, author details) & related videos
    fetch(apiUrl(`/api/videos/${encodeURIComponent(activeVideoId)}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.video) {
          setSelectedVideo(data.video);
        }
        if (data?.related) {
          setRelatedVideos(data.related);
        }
      })
      .catch((err) => {
        console.error('Error fetching video for watch page:', err);
      });
  }, [activePage, activeVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Videos with pagination, cancellation of stale requests, and strict deduplication
  const fetchVideos = useCallback(
    async (pageToFetch, isReset = false) => {
      if (!isReset && isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);

      const thisFetchId = ++fetchIdRef.current;

      try {
        const queryTerm = activePage === 'search' ? searchQuery : '';
        const params = new URLSearchParams({
          page: pageToFetch,
          limit: 18,
          category: category !== 'All' ? category : '',
          q: queryTerm,
          _t: Date.now(),
        });

        const res = await fetch(apiUrl(`/api/videos?${params.toString()}`));
        const data = await res.json();

        // Discard response if a newer request occurred in the meantime
        if (thisFetchId !== fetchIdRef.current) return;

        if (res.ok && data.videos) {
          setVideos((prev) => {
            if (isReset) {
              const seen = new Set();
              return data.videos.filter((v) => {
                const id = v.videoId || v._id;
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
              });
            }
            const seen = new Set(prev.map((v) => v.videoId || v._id));
            const newUnique = data.videos.filter((v) => {
              const id = v.videoId || v._id;
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            return [...prev, ...newUnique];
          });
          setHasMore(data.hasMore);
          setPage(data.page);
        }
      } catch (err) {
        console.error('Fetch YouTube videos error:', err);
      } finally {
        if (thisFetchId === fetchIdRef.current) {
          setLoading(false);
          isFetchingRef.current = false;
        }
      }
    },
    [category, searchQuery, activePage]
  );

  // Fetch videos whenever category, search query, or page mode changes
  useEffect(() => {
    setPage(1);
    if (activePage === 'home' || activePage === 'search') {
      fetchVideos(1, true);
    }
  }, [category, searchQuery, activePage, fetchVideos]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (activePage !== 'home' && activePage !== 'search') return;
    if (observerRef.current) observerRef.current.disconnect();

    let debounceTimer = null;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loading &&
          !isFetchingRef.current &&
          videos.length > 0
        ) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchVideos(page + 1, false);
          }, 250);
        }
      },
      { rootMargin: '250px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [activePage, hasMore, loading, page, videos.length, fetchVideos]);

  // Load Watch Later Videos
  // Load Watch Later Videos
  const loadWatchLaterVideos = useCallback(async () => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl('/api/watch-later'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWatchLaterVideos(data.videos || []);
          setWatchLaterIds(data.watchLaterIds || (data.videos || []).map((v) => v.videoId));
        }
      } catch (err) {
        console.error('Failed to load watch later from server:', err);
      }
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('yt_guest_wl_v') || '[]');
        setWatchLaterVideos(stored);
      } catch {}
    }
  }, []);

  // Load Liked Videos
  const loadLikedVideos = useCallback(async () => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl('/api/liked-videos'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLikedVideos(data.videos || []);
          setLikedVideoIds(data.likedVideoIds || (data.videos || []).map((v) => v.videoId));
        }
      } catch (err) {
        console.error('Failed to load liked videos from server:', err);
      }
    }
  }, []);

  // Load Subscriptions
  const loadSubscriptions = useCallback(async () => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl('/api/subscriptions'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSubscribedChannels(data.subscribedChannels || []);
        }
      } catch (err) {
        console.error('Failed to load subscriptions from server:', err);
      }
    }
  }, []);

  // Load Playlists
  const loadPlaylists = useCallback(async () => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl('/api/playlists'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlaylists(data.playlists || []);
        }
      } catch (err) {
        console.error('Failed to load playlists from server:', err);
      }
    }
  }, []);

  // Refresh page collections whenever activePage changes
  useEffect(() => {
    if (activePage === 'watch-later') {
      loadWatchLaterVideos();
    } else if (activePage === 'liked') {
      loadLikedVideos();
    } else if (activePage === 'subscriptions') {
      loadSubscriptions();
    } else if (activePage === 'playlists') {
      loadPlaylists();
    }
  }, [activePage, loadWatchLaterVideos, loadLikedVideos, loadSubscriptions, loadPlaylists]);

  // Dedicated Navigation Handlers with real URLs
  const handleNavigate = (pageName) => {
    setIsDrawerOpen(false);
    if (pageName === 'home') {
      navigate('/');
    } else if (pageName === 'subscriptions') {
      navigate('/subscriptions');
    } else if (pageName === 'liked') {
      navigate('/liked');
    } else if (pageName === 'watch-later') {
      navigate('/watch-later');
    } else if (pageName === 'playlists') {
      navigate('/playlists');
    } else if (pageName === 'search') {
      navigate(`/results?search_query=${encodeURIComponent(searchQuery || '')}`);
    }
  };

  const handleSelectCategory = (newCat) => {
    setIsDrawerOpen(false);
    fetchIdRef.current++;
    isFetchingRef.current = false;
    setVideos([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);

    if (newCat === 'All') {
      navigate('/');
    } else {
      navigate(`/?category=${encodeURIComponent(newCat)}`);
    }
  };

  const handleSearch = (query) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    setIsDrawerOpen(false);
    setVideos([]);
    setLoading(true);
    navigate(`/results?search_query=${encodeURIComponent(cleanQuery)}`);
  };

  const handleSelectVideo = (video, newPlaylistContext = null) => {
    const vId = video.videoId || video._id;
    if (!vId) return;
    setIsDrawerOpen(false);
    setSelectedVideo(video);
    setRelatedVideos([]);

    if (newPlaylistContext !== null) {
      setPlaylistContext(newPlaylistContext);
    } else if (playlistContext && !playlistContext.videos.some((v) => (v.videoId || v._id) === vId)) {
      setPlaylistContext(null);
    }

    navigate(`/watch?v=${encodeURIComponent(vId)}`, { state: { video } });
  };

  // Play All Playlist Videos in order
  const handlePlayPlaylist = (playlistVideos, startIndex = 0, title = 'Playlist', id = 'playlist') => {
    if (!playlistVideos || playlistVideos.length === 0) return;
    const startVid = playlistVideos[startIndex] || playlistVideos[0];
    const context = {
      id,
      title,
      videos: playlistVideos,
      currentIndex: startIndex,
    };
    setPlaylistContext(context);
    handleSelectVideo(startVid, context);
  };

  // Auth protection helper
  const requireAuth = (actionDescription = 'perform this action') => {
    const token = localStorage.getItem('bintube_token');
    if (!token || !user) {
      setIsAuthModalOpen(true);
      showToast(`Please sign in to ${actionDescription}`);
      return false;
    }
    return true;
  };

  // Liked Videos Handlers (Backed by MongoDB User Account)
  const handleToggleLike = async (video) => {
    if (!requireAuth('like videos')) return;
    const vId = video.videoId || video._id;
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl(`/api/liked-videos/${vId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ video }),
      });
      const data = await res.json();
      if (res.ok) {
        setLikedVideoIds(data.likedVideoIds);
        setLikedVideos(data.videos);
        showToast(data.message);
      }
    } catch {
      showToast('Error updating liked videos');
    }
  };

  const handleRemoveLike = async (videoId) => {
    if (!requireAuth('manage liked videos')) return;
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl(`/api/liked-videos/${videoId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLikedVideoIds(data.likedVideoIds);
        setLikedVideos(data.videos);
        showToast(data.message);
      }
    } catch {
      showToast('Removed from Liked videos');
    }
  };

  const handleClearLikedVideos = async () => {
    if (!requireAuth('clear liked videos')) return;
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl('/api/liked-videos'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLikedVideoIds([]);
        setLikedVideos([]);
        showToast(data.message);
      }
    } catch {
      showToast('Error clearing liked videos');
    }
  };

  // Subscriptions Handlers (Backed by MongoDB User Account)
  const handleToggleSubscribe = async (channelInfo) => {
    if (!requireAuth('subscribe to channels')) return;
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl('/api/subscriptions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(channelInfo),
      });
      const data = await res.json();
      if (res.ok) {
        setSubscribedChannels(data.subscribedChannels);
        showToast(data.message);
      }
    } catch {
      showToast('Error updating subscription');
    }
  };

  // Playlists Handlers (Backed by MongoDB User Account)
  const handleCreatePlaylist = async (title, description = '', initialVideo = null) => {
    if (!requireAuth('create playlists')) return;
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl('/api/playlists'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, initialVideo }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlaylists(data.playlists);
        showToast(data.message);
        return data.playlist;
      } else {
        showToast(data.message || 'Failed to create playlist');
      }
    } catch {
      showToast('Error creating playlist');
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    try {
      const res = await fetch(apiUrl(`/api/playlists/${playlistId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPlaylists(data.playlists);
        showToast(data.message);
      }
    } catch {
      showToast('Error deleting playlist');
    }
  };

  const handleToggleVideoInPlaylist = async (playlistId, video, isCurrentlySaved) => {
    const token = localStorage.getItem('bintube_token');
    if (!token) return;

    const vId = video.videoId || video._id;
    try {
      if (isCurrentlySaved) {
        const res = await fetch(apiUrl(`/api/playlists/${playlistId}/videos/${vId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === playlistId
                ? {
                    ...p,
                    videos: data.playlist.videos,
                    videoCount: data.playlist.videos.length,
                    coverThumbnail: data.playlist.videos[0]?.thumbnailUrl || '',
                  }
                : p
            )
          );
          showToast(data.message);
        }
      } else {
        const res = await fetch(apiUrl(`/api/playlists/${playlistId}/videos`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ video }),
        });
        const data = await res.json();
        if (res.ok) {
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === playlistId
                ? {
                    ...p,
                    videos: data.playlist.videos,
                    videoCount: data.playlist.videos.length,
                    coverThumbnail: data.playlist.videos[0]?.thumbnailUrl || '',
                  }
                : p
            )
          );
          showToast(data.message);
        }
      }
    } catch {
      showToast('Error updating playlist video');
    }
  };

  const handleRemoveVideoFromPlaylist = async (playlistId, videoId) => {
    const token = localStorage.getItem('bintube_token');
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/playlists/${playlistId}/videos/${videoId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  videos: data.playlist.videos,
                  videoCount: data.playlist.videos.length,
                  coverThumbnail: data.playlist.videos[0]?.thumbnailUrl || '',
                }
              : p
          )
        );
        showToast(data.message);
      }
    } catch {
      showToast('Error removing video from playlist');
    }
  };

  // Toggle Sidebar or Drawer
  const handleToggleMenu = () => {
    if (activePage === 'watch') {
      setIsDrawerOpen((prev) => !prev);
    } else {
      if (window.innerWidth <= 900) {
        setIsDrawerOpen((prev) => !prev);
      } else {
        setIsSidebarOpen((prev) => !prev);
      }
    }
  };

  // Watch Later toggle (Backed by MongoDB User Account)
  const handleToggleWatchLater = async (video) => {
    if (!requireAuth('save videos to Watch Later')) return;
    const vId = video.videoId || video._id;
    const token = localStorage.getItem('bintube_token');

    if (token) {
      try {
        const res = await fetch(apiUrl(`/api/watch-later/${vId}`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ video }),
        });
        const data = await res.json();
        if (res.ok) {
          setWatchLaterIds(data.watchLaterIds);
          showToast(data.message);
          if (activePage === 'watch-later') {
            loadWatchLaterVideos();
          }
        }
      } catch {
        showToast('Error updating Watch Later');
      }
    }
  };

  const handleRemoveWatchLater = async (videoId) => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl(`/api/watch-later/${videoId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWatchLaterIds(data.watchLaterIds);
          setWatchLaterVideos((prev) =>
            prev.filter((v) => (v.videoId || v._id) !== videoId)
          );
          showToast('Removed from Watch Later');
        }
      } catch {
        showToast('Failed to remove video');
      }
    }
  };

  const handleClearWatchLater = async () => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      try {
        const res = await fetch(apiUrl('/api/watch-later'), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setWatchLaterIds([]);
          setWatchLaterVideos([]);
          showToast('Watch Later playlist cleared');
        }
      } catch {
        showToast('Failed to clear playlist');
      }
    }
  };

  // Auth handlers
  const handleAuthSuccess = (data) => {
    localStorage.setItem('bintube_token', data.token);
    setUser(data.user);
    loadUserData(data.token);
    showToast(`Welcome back, ${data.user.username}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem('bintube_token');
    setUser(null);
    setWatchLaterIds([]);
    setWatchLaterVideos([]);
    setLikedVideos([]);
    setLikedVideoIds([]);
    setSubscribedChannels([]);
    setPlaylists([]);
    setPlaylistContext(null);
    showToast('Signed out of YouTube');
  };

  return (
    <div className="app-shell">
      {/* YouTube Clone Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearch={handleSearch}
        activePage={activePage}
        onNavigate={handleNavigate}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        watchLaterCount={watchLaterIds.length}
        onToggleSidebar={handleToggleMenu}
      />

      <div className="app-body">
        {/* Persistent Left Sidebar: Desktop Docked for Home/Search/WatchLater/Subscriptions/Liked; Drawer for Watch Page and Mobile */}
        {activePage !== 'watch' && (
          <Sidebar
            isOpen={isSidebarOpen}
            isOverlay={false}
            activePage={activePage}
            activeCategory={category}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            watchLaterCount={watchLaterIds.length}
            likedCount={likedVideos.length}
            subscriptionsCount={subscribedChannels.length}
            playlistsCount={playlists.length}
          />
        )}

        {/* Overlay Drawer for Watch Page and mobile toggle */}
        <Sidebar
          isOpen={isDrawerOpen}
          isOverlay={true}
          onClose={() => setIsDrawerOpen(false)}
          activePage={activePage}
          activeCategory={category}
          onNavigate={handleNavigate}
          onSelectCategory={handleSelectCategory}
          watchLaterCount={watchLaterIds.length}
          likedCount={likedVideos.length}
          subscriptionsCount={subscribedChannels.length}
          playlistsCount={playlists.length}
        />

        {/* Main Content Area */}
        <main className={`main-content ${activePage === 'watch' ? 'watch-mode' : ''}`}>
          {/* HOME PAGE: Clean unified video feed without dividing section titles */}
          {activePage === 'home' && (
            <>
              {/* Category Bar */}
              <CategoryBar
                activeCategory={category}
                onSelectCategory={handleSelectCategory}
              />

              {videos.length === 0 && !loading ? (
                <div className="empty-state">
                  <h3 className="empty-state-title">No videos found</h3>
                  <p className="empty-state-desc">
                    Try selecting another category.
                  </p>
                  <button
                    className="nav-btn primary"
                    onClick={() => handleSelectCategory('All')}
                  >
                    Reset to All
                  </button>
                </div>
              ) : (
                <div className="videos-grid">
                  {videos.map((video, idx) => (
                    <VideoCard
                      key={`feed-${video.videoId || video._id}-${idx}`}
                      video={video}
                      onSelectVideo={handleSelectVideo}
                      isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                      onToggleWatchLater={handleToggleWatchLater}
                    />
                  ))}
                </div>
              )}

              {/* Infinite Scroll Sentinel */}
              <div ref={sentinelRef} className="scroll-sentinel">
                {loading && (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Loading more videos...</span>
                  </div>
                )}
                {!hasMore && videos.length > 0 && (
                  <span className="end-catalog-msg">
                    You've reached the end of the results.
                  </span>
                )}
              </div>
            </>
          )}

          {/* DEDICATED SEARCH RESULTS PAGE */}
          {activePage === 'search' && (
            <SearchResultsPage
              searchQuery={searchQuery}
              videos={videos}
              loading={loading}
              hasMore={hasMore}
              onSelectVideo={handleSelectVideo}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
              sentinelRef={sentinelRef}
            />
          )}

          {/* DEDICATED WATCH PAGE */}
          {activePage === 'watch' && (
            selectedVideo ? (
              <VideoPlayer
                video={selectedVideo}
                relatedVideos={relatedVideos}
                onSelectVideo={handleSelectVideo}
                isWatchLater={watchLaterIds.includes(
                  selectedVideo.videoId || selectedVideo._id
                )}
                onToggleWatchLater={handleToggleWatchLater}
                onNotify={showToast}
                isLiked={likedVideoIds.includes(
                  selectedVideo.videoId || selectedVideo._id
                )}
                onToggleLike={handleToggleLike}
                isSubscribed={subscribedChannels.some(
                  (c) =>
                    c.channelName.toLowerCase() ===
                    (selectedVideo.channelName || '').toLowerCase()
                )}
                onToggleSubscribe={handleToggleSubscribe}
                playlistContext={playlistContext}
                onOpenSaveToPlaylist={(vid) => {
                  if (requireAuth('save videos to playlists')) {
                    setSaveToPlaylistTarget(vid);
                  }
                }}
                currentUser={user}
                onRequireAuth={requireAuth}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60vh',
                  gap: '16px',
                  color: '#aaa',
                }}
              >
                <div
                  className="spinner"
                  style={{ width: '40px', height: '40px', borderWidth: '3px' }}
                ></div>
                <span>Loading video player...</span>
              </div>
            )
          )}

          {/* DEDICATED WATCH LATER PAGE */}
          {activePage === 'watch-later' && (
            <WatchLaterPage
              videos={watchLaterVideos}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onRemoveVideo={handleRemoveWatchLater}
              onClearAll={handleClearWatchLater}
              onExplore={() => handleNavigate('home')}
            />
          )}

          {/* DEDICATED SUBSCRIPTIONS PAGE */}
          {activePage === 'subscriptions' && (
            <SubscriptionsPage
              subscribedChannels={subscribedChannels}
              onToggleSubscribe={handleToggleSubscribe}
              onSelectVideo={handleSelectVideo}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onExplore={() => handleNavigate('home')}
            />
          )}

          {/* DEDICATED LIKED VIDEOS PAGE */}
          {activePage === 'liked' && (
            <LikedVideosPage
              videos={likedVideos}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onRemoveLike={handleRemoveLike}
              onClearAll={handleClearLikedVideos}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
            />
          )}

          {/* DEDICATED PLAYLISTS PAGE */}
          {activePage === 'playlists' && (
            <PlaylistsPage
              playlists={playlists}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onRemoveVideoFromPlaylist={handleRemoveVideoFromPlaylist}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
            />
          )}
        </main>
      </div>

      {/* Save to Playlist Modal */}
      <SaveToPlaylistModal
        isOpen={Boolean(saveToPlaylistTarget)}
        onClose={() => setSaveToPlaylistTarget(null)}
        video={saveToPlaylistTarget}
        playlists={playlists}
        onCreatePlaylist={async (title, desc, vid) => {
          await handleCreatePlaylist(title, desc, vid);
        }}
        onToggleVideoInPlaylist={handleToggleVideoInPlaylist}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onNotify={showToast}
      />

      {/* Toast Alert */}
      {toast && (
        <div className="toast-container">
          <div className="toast">{toast}</div>
        </div>
      )}
    </div>
  );
}
