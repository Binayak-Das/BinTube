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
import HistoryPage from './components/HistoryPage.jsx';
import NotFoundPage from './components/NotFoundPage.jsx';
import SaveToPlaylistModal from './components/SaveToPlaylistModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import ShortsCard from './components/ShortsCard.jsx';
import ShortsPage from './components/ShortsPage.jsx';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import YouPage from './components/YouPage.jsx';
import { ShortsIcon } from './components/Icons.jsx';
import { apiUrl } from './config/api.js';

const DEFAULT_SUBSCRIBED_CHANNELS = [];

// Whitelist of valid known routes to restrict access to unknown/unavailable pages
const VALID_ROUTES = new Set([
  '/',
  '/watch',
  '/shorts',
  '/results',
  '/search',
  '/subscriptions',
  '/feed/subscriptions',
  '/history',
  '/feed/history',
  '/liked',
  '/watch-later',
  '/playlists',
  '/playlist',
  '/you',
  '/feed/you',
]);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine active page and parameters from current URL
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  let activePage = 'home';

  // Restrict users from visiting any unknown unavailable page
  if (pathname !== '/' && !VALID_ROUTES.has(pathname)) {
    activePage = 'not-found';
  } else if (pathname === '/shorts' || pathname.startsWith('/shorts/')) {
    activePage = 'shorts';
  } else if (pathname === '/subscriptions' || pathname === '/feed/subscriptions') {
    activePage = 'subscriptions';
  } else if (
    pathname === '/history' ||
    pathname === '/feed/history'
  ) {
    activePage = 'history';
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
  } else if (pathname === '/you' || pathname === '/feed/you') {
    activePage = 'you';
  } else if (pathname === '/results' || pathname === '/search') {
    activePage = 'search';
  } else if (pathname === '/watch') {
    if (!searchParams.get('v')) {
      activePage = 'not-found';
    } else {
      activePage = 'watch';
    }
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

  // Watch History State (Maintained strictly per-account: loaded from MongoDB on login)
  const [historyVideos, setHistoryVideos] = useState([]);

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

  // Shorts & Home Synchronous Loading State
  const [homeShorts, setHomeShorts] = useState([]);
  const [selectedShort, setSelectedShort] = useState(null);
  const [isHomeReady, setIsHomeReady] = useState(false);

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
      const [meRes, likedRes, subsRes, plRes, wlRes, histRes] = await Promise.allSettled([
        fetch(apiUrl('/api/auth/me'), { headers }),
        fetch(apiUrl('/api/liked-videos'), { headers }),
        fetch(apiUrl('/api/subscriptions'), { headers }),
        fetch(apiUrl('/api/playlists'), { headers }),
        fetch(apiUrl('/api/watch-later'), { headers }),
        fetch(apiUrl('/api/history'), { headers }),
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
      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const data = await histRes.value.json();
        setHistoryVideos(data.videos || []);
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
    if (activePage === 'not-found') {
      document.title = '404 Not Found - YouTube';
    } else if (activePage === 'shorts') {
      document.title = 'Shorts - YouTube';
    } else if (activePage === 'watch' && selectedVideo) {
      document.title = `${selectedVideo.title} - YouTube`;
    } else if (activePage === 'watch-later') {
      document.title = 'Watch Later - YouTube';
    } else if (activePage === 'history') {
      document.title = 'Watch history - YouTube';
    } else if (activePage === 'subscriptions') {
      document.title = 'Subscriptions - YouTube';
    } else if (activePage === 'liked') {
      document.title = 'Liked videos - YouTube';
    } else if (activePage === 'playlists') {
      document.title = 'Playlists - YouTube';
    } else if (activePage === 'you') {
      document.title = 'You - YouTube';
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
      recordWatchHistory(location.state.video);
    }

    // Always fetch full video details (complete description, author details) & related videos
    fetch(apiUrl(`/api/videos/${encodeURIComponent(activeVideoId)}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.video) {
          setSelectedVideo(data.video);
          recordWatchHistory(data.video);
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

      if (isReset && activePage === 'home') {
        setIsHomeReady(false);
      }

      const thisFetchId = ++fetchIdRef.current;
      let willRetry = false;

      try {
        const queryTerm = activePage === 'search' ? searchQuery : '';
        const params = new URLSearchParams({
          page: pageToFetch,
          limit: 18,
          category: category !== 'All' ? category : '',
          q: queryTerm,
          _t: Date.now(),
        });

        // Synchronous loading for Home page: fetch BOTH videos and shorts before displaying
        const isHomeAllInitial = activePage === 'home' && isReset && category === 'All';

        let res, data, shortsData = null;

        if (isHomeAllInitial) {
          const [videoRes, shortsRes] = await Promise.all([
            fetch(apiUrl(`/api/videos?${params.toString()}`)),
            fetch(apiUrl(`/api/videos/shorts?limit=8&_t=${Date.now()}`)),
          ]);
          res = videoRes;
          data = videoRes.ok ? await videoRes.json() : null;
          shortsData = shortsRes.ok ? await shortsRes.json() : null;
        } else {
          res = await fetch(apiUrl(`/api/videos?${params.toString()}`));
          data = await res.json();
        }

        // Discard response if a newer request occurred in the meantime
        if (thisFetchId !== fetchIdRef.current) return;

        if (shortsData?.videos && shortsData.videos.length > 0) {
          setHomeShorts(shortsData.videos);
        }

        if (res.ok && data?.videos) {
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
          // Unlimited infinite loading: always keep hasMore true
          setHasMore(true);
          setPage(data.page || pageToFetch);
        }
      } catch (err) {
        console.error('Fetch YouTube videos error:', err);
        // If background tab switch interrupted the initial fetch, retry automatically while keeping skeleton loading active
        if (isReset && thisFetchId === fetchIdRef.current) {
          willRetry = true;
          setTimeout(() => {
            if (thisFetchId === fetchIdRef.current) {
              fetchVideos(pageToFetch, isReset);
            }
          }, 1200);
          return;
        }
      } finally {
        if (!willRetry && thisFetchId === fetchIdRef.current) {
          setLoading(false);
          isFetchingRef.current = false;
          if (activePage === 'home' && isReset) {
            setIsHomeReady(true);
          }
        }
      }
    },
    [category, searchQuery, activePage]
  );

  // Fetch videos whenever category, search query, or page mode changes
  useEffect(() => {
    setPage(1);
    if (activePage === 'home') {
      setIsHomeReady(false);
      setLoading(true);
      fetchVideos(1, true);
    } else if (activePage === 'search') {
      setLoading(true);
      fetchVideos(1, true);
    }
  }, [category, searchQuery, activePage, fetchVideos]);

  // Resume / retry in-flight fetches if user switched tabs before home/search loading completed
  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        if (videos.length === 0 && (activePage === 'home' || activePage === 'search')) {
          setLoading(true);
          if (activePage === 'home') setIsHomeReady(false);
          fetchVideos(1, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    return () => document.removeEventListener('visibilitychange', handleVisibilityRefresh);
  }, [videos.length, activePage, fetchVideos]);

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

  // Load Watch History (Strictly for authenticated user)
  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem('bintube_token');
    if (!token) {
      setHistoryVideos([]);
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/history'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryVideos(data.videos || []);
      }
    } catch (err) {
      console.error('Failed to load history from server:', err);
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
    } else if (activePage === 'you') {
      if (user) loadHistory();
      loadWatchLaterVideos();
      loadLikedVideos();
      loadSubscriptions();
      loadPlaylists();
    }
  }, [activePage, user, loadHistory, loadWatchLaterVideos, loadLikedVideos, loadSubscriptions, loadPlaylists]);

  // Dedicated Navigation Handlers with real URLs
  const handleNavigate = (pageName) => {
    setIsDrawerOpen(false);
    if (pageName === 'home') {
      setIsHomeReady(false);
      setLoading(true);
      navigate('/');
    } else if (pageName === 'shorts') {
      navigate('/shorts');
    } else if (pageName === 'subscriptions') {
      navigate('/subscriptions');
    } else if (pageName === 'history') {
      navigate('/history');
    } else if (pageName === 'liked') {
      navigate('/liked');
    } else if (pageName === 'watch-later') {
      navigate('/watch-later');
    } else if (pageName === 'playlists') {
      navigate('/playlists');
    } else if (pageName === 'you') {
      navigate('/you');
    } else if (pageName === 'search') {
      setLoading(true);
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
    setIsHomeReady(false);

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

  // Watch History Handlers (Maintained strictly account-wise for authenticated users)
  const recordWatchHistory = useCallback(async (video) => {
    if (!video) return;
    const vId = video.videoId || video._id;
    if (!vId) return;

    // Strict per-account history: Only record if user is logged in
    const token = localStorage.getItem('bintube_token');
    if (!token || !user) return;

    if (localStorage.getItem('yt_history_paused') === 'true') return;

    const entry = {
      videoId: vId,
      title: video.title || 'Watched Video',
      thumbnailUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
      duration: video.duration || '0:00',
      channelName: video.channelName || 'YouTube Creator',
      channelAvatar: video.channelAvatar || '',
      subscriberCount: video.subscriberCount || '100K subscribers',
      likes: video.likes || '10K',
      views: video.views || '100K views',
      uploadDate: video.uploadDate || 'Recently',
      description: video.description || '',
      watchedAt: new Date().toISOString(),
    };

    setHistoryVideos((prev) => {
      const filtered = prev.filter((item) => (item.videoId || item._id) !== vId);
      return [entry, ...filtered].slice(0, 250);
    });

    try {
      await fetch(apiUrl('/api/history'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ video: entry }),
      });
    } catch (err) {
      console.error('Error saving history to server:', err);
    }
  }, [user]);

  const handleRemoveHistory = async (videoId) => {
    const token = localStorage.getItem('bintube_token');
    if (!token || !user) return;

    setHistoryVideos((prev) => prev.filter((item) => (item.videoId || item._id) !== videoId));

    try {
      await fetch(apiUrl(`/api/history/${videoId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Error deleting history item from server:', err);
    }
    showToast('Video removed from history');
  };

  const handleClearHistory = async () => {
    const token = localStorage.getItem('bintube_token');
    if (!token || !user) return;

    setHistoryVideos([]);

    try {
      await fetch(apiUrl('/api/history'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Error clearing history on server:', err);
    }
    showToast('Watch history cleared');
  };

  const handleSelectVideo = (video, newPlaylistContext = null) => {
    const vId = video.videoId || video._id;
    if (!vId) return;
    setIsDrawerOpen(false);
    setSelectedVideo(video);
    setRelatedVideos([]);

    // Record into user's watch history
    recordWatchHistory(video);

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
    localStorage.removeItem('yt_history_videos');
    setUser(null);
    setHistoryVideos([]);
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
            historyCount={user ? historyVideos.length : 0}
            currentUser={user}
            onRequireAuth={requireAuth}
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
          historyCount={user ? historyVideos.length : 0}
          currentUser={user}
          onRequireAuth={requireAuth}
        />

        {/* Main Content Area */}
        <main
          className={`main-content ${activePage === 'watch' ? 'watch-mode' : ''} ${
            activePage === 'shorts' ? 'shorts-mode' : ''
          }`}
        >
          {/* HOME PAGE: Display all videos only after loading everything (both shorts and videos) */}
          {activePage === 'home' && (
            <>
              {/* Category Bar */}
              <CategoryBar
                activeCategory={category}
                onSelectCategory={handleSelectCategory}
              />

              {!isHomeReady || loading ? (
                /* Unified Loading State until BOTH videos and shorts are loaded */
                <div className="home-unified-loading">
                  <div className="videos-grid">
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div key={`home-skel-${idx}`} className="skeleton-card">
                        <div className="skeleton-thumb-card shimmer" />
                        <div className="skeleton-card-details">
                          <div className="skeleton-avatar shimmer" />
                          <div className="skeleton-card-lines">
                            <div className="skeleton-line shimmer title-line" />
                            <div className="skeleton-line shimmer channel-line" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : videos.length === 0 ? (
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
                <>
                  <div className="videos-grid">
                    {videos.slice(0, 6).map((video, idx) => (
                      <VideoCard
                        key={`feed-${video.videoId || video._id}-${idx}`}
                        video={video}
                        onSelectVideo={handleSelectVideo}
                        isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                        onToggleWatchLater={handleToggleWatchLater}
                        onOpenSaveToPlaylist={(vid) => {
                          if (requireAuth('save videos to playlists')) {
                            setSaveToPlaylistTarget(vid);
                          }
                        }}
                        onNotify={showToast}
                      />
                    ))}
                  </div>

                  {/* YouTube Shorts Shelf on Home Tab (Revealed simultaneously with videos) */}
                  {homeShorts.length > 0 && category === 'All' && (
                    <div className="home-shorts-shelf">
                      <div className="home-shorts-header">
                        <div className="home-shorts-title-group">
                          <ShortsIcon size={24} color="#ff0000" />
                          <h2 className="home-shorts-heading">Shorts</h2>
                        </div>
                      </div>
                      <div className="home-shorts-grid">
                        {homeShorts.slice(0, 6).map((short) => (
                          <ShortsCard
                            key={`home-short-${short.videoId || short._id}`}
                            video={short}
                            onSelectVideo={(s) => {
                              setSelectedShort(s);
                              handleNavigate('shorts');
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remaining Videos in Home Feed */}
                  {videos.length > 6 && (
                    <div className="videos-grid">
                      {videos.slice(6).map((video, idx) => (
                        <VideoCard
                          key={`feed-${video.videoId || video._id}-${idx + 6}`}
                          video={video}
                          onSelectVideo={handleSelectVideo}
                          isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                          onToggleWatchLater={handleToggleWatchLater}
                          onOpenSaveToPlaylist={(vid) => {
                            if (requireAuth('save videos to playlists')) {
                              setSaveToPlaylistTarget(vid);
                            }
                          }}
                          onNotify={showToast}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Infinite Scroll Sentinel: Render skeletons on load more instead of text spinners */}
              <div ref={sentinelRef} className="scroll-sentinel">
                {loading && (
                  <div className="videos-grid" style={{ marginTop: '16px' }}>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={`more-home-skel-${idx}`} className="skeleton-card">
                        <div className="skeleton-thumb-card shimmer" />
                        <div className="skeleton-card-details">
                          <div className="skeleton-avatar shimmer" />
                          <div className="skeleton-card-lines">
                            <div className="skeleton-line shimmer title-line" />
                            <div className="skeleton-line shimmer channel-line" />
                          </div>
                        </div>
                      </div>
                    ))}
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
                watchLaterIds={watchLaterIds}
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

          {/* DEDICATED HISTORY PAGE (Restricted to logged-in users) */}
          {activePage === 'history' && (
            <HistoryPage
              videos={historyVideos}
              currentUser={user}
              onRequireAuth={() => setIsAuthModalOpen(true)}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onRemoveHistory={handleRemoveHistory}
              onClearAll={handleClearHistory}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
            />
          )}

          {/* DEDICATED WATCH LATER PAGE (Restricted to logged-in users) */}
          {activePage === 'watch-later' && (
            <WatchLaterPage
              videos={watchLaterVideos}
              currentUser={user}
              onRequireAuth={() => requireAuth('access Watch Later')}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onRemoveVideo={handleRemoveWatchLater}
              onClearAll={handleClearWatchLater}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
            />
          )}

          {/* DEDICATED SUBSCRIPTIONS PAGE (Restricted to logged-in users) */}
          {activePage === 'subscriptions' && (
            <SubscriptionsPage
              subscribedChannels={subscribedChannels}
              currentUser={user}
              onRequireAuth={() => requireAuth('access subscriptions')}
              onToggleSubscribe={handleToggleSubscribe}
              onSelectVideo={handleSelectVideo}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onExplore={() => handleNavigate('home')}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
            />
          )}

          {/* DEDICATED LIKED VIDEOS PAGE (Restricted to logged-in users) */}
          {activePage === 'liked' && (
            <LikedVideosPage
              videos={likedVideos}
              currentUser={user}
              onRequireAuth={() => requireAuth('access liked videos')}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onRemoveLike={handleRemoveLike}
              onClearAll={handleClearLikedVideos}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
            />
          )}

          {/* DEDICATED PLAYLISTS PAGE (Restricted to logged-in users) */}
          {activePage === 'playlists' && (
            <PlaylistsPage
              playlists={playlists}
              currentUser={user}
              onRequireAuth={() => requireAuth('access your playlists')}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onRemoveVideoFromPlaylist={handleRemoveVideoFromPlaylist}
              onSelectVideo={handleSelectVideo}
              onPlayPlaylist={handlePlayPlaylist}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenSaveToPlaylist={(vid) => {
                if (requireAuth('save videos to playlists')) {
                  setSaveToPlaylistTarget(vid);
                }
              }}
              onNotify={showToast}
            />
          )}

          {/* DEDICATED SHORTS SECTION (Displays ONLY Shorts, NO Watch Later) */}
          {activePage === 'shorts' && (
            <ShortsPage
              initialShort={selectedShort}
              onNotify={showToast}
              likedVideoIds={likedVideoIds}
              onToggleLike={handleToggleLike}
              subscribedChannels={subscribedChannels}
              onToggleSubscribe={handleToggleSubscribe}
              currentUser={user}
              onRequireAuth={requireAuth}
            />
          )}

          {/* DEDICATED YOU PAGE (Mobile Bottom Nav You Hub with Profile, Shortcuts & Log out) */}
          {activePage === 'you' && (
            <YouPage
              currentUser={user}
              onLogout={handleLogout}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onNavigate={handleNavigate}
              historyVideos={historyVideos}
              watchLaterCount={watchLaterIds.length}
              likedCount={likedVideos.length}
              subscriptionsCount={subscribedChannels.length}
              playlists={playlists}
              onSelectVideo={handleSelectVideo}
              onNotify={showToast}
            />
          )}

          {/* 404 NOT FOUND / RESTRICTED UNAVAILABLE PAGE */}
          {activePage === 'not-found' && (
            <NotFoundPage
              onNavigateHome={() => navigate('/')}
              onSearch={handleSearch}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Image 2) */}
      <MobileBottomNav
        activePage={activePage}
        onNavigate={handleNavigate}
        currentUser={user}
        onRequireAuth={() => setIsAuthModalOpen(true)}
      />

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
