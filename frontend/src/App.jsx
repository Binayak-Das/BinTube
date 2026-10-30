import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import CategoryBar from './components/CategoryBar.jsx';
import VideoCard from './components/VideoCard.jsx';
import ShortsCard from './components/ShortsCard.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import WatchLaterPage from './components/WatchLaterPage.jsx';
import SearchResultsPage from './components/SearchResultsPage.jsx';
import SubscriptionsPage from './components/SubscriptionsPage.jsx';
import LikedVideosPage from './components/LikedVideosPage.jsx';
import AuthModal from './components/AuthModal.jsx';
import { apiUrl } from './config/api.js';
import {
  ShortsIcon,
  MusicIcon,
  GamepadIcon,
  CodeIcon,
  FlameIcon,
  ClockIcon,
} from './components/Icons.jsx';

const DEFAULT_SUBSCRIBED_CHANNELS = [];

export default function App() {
  const [activePage, setActivePage] = useState('home'); // 'home' | 'watch' | 'watch-later' | 'search' | 'subscriptions' | 'liked'
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Home Multi-Content Sections
  const [homeSections, setHomeSections] = useState(null);
  const [loadingSections, setLoadingSections] = useState(false);

  // Feed & Infinite scroll
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');

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

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const isFetchingRef = useRef(false);
  const isFetchingHomeRef = useRef(false);
  const fetchIdRef = useRef(0);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  // Restore authenticated user session on mount
  useEffect(() => {
    const token = localStorage.getItem('bintube_token');
    if (token) {
      fetch(apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setUser(data.user);
          if (data.user.watchLaterIds) {
            setWatchLaterIds(data.user.watchLaterIds);
          }
        })
        .catch(() => {
          localStorage.removeItem('bintube_token');
        });
    }
  }, []);

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
    } else if (activePage === 'search') {
      document.title = `${searchQuery} - YouTube Search`;
    } else {
      document.title = 'YouTube';
    }
  }, [activePage, selectedVideo, searchQuery]);

  // Fetch Home Multi-Content Sections with randomizer on every refresh
  const loadHomeSections = useCallback(async (_force = false) => {
    if (isFetchingHomeRef.current) return;
    isFetchingHomeRef.current = true;
    setLoadingSections(true);
    try {
      const res = await fetch(apiUrl(`/api/videos/home-sections?_t=${Date.now()}`));
      const data = await res.json();
      if (res.ok) {
        setHomeSections(data);
        if (data.feed && data.feed.length > 0) {
          setVideos(data.feed);
        }
      }
    } catch (err) {
      console.error('Error loading home sections:', err);
    } finally {
      setLoadingSections(false);
      isFetchingHomeRef.current = false;
    }
  }, []);

  // Fetch Videos with pagination, cancellation of stale requests, and strict deduplication
  const fetchVideos = useCallback(
    async (pageToFetch, isReset = false) => {
      // If resetting, never get blocked by a stale in-flight request
      if (!isReset && isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);

      const thisFetchId = ++fetchIdRef.current;

      try {
        const queryTerm = activePage === 'search' ? searchQuery : '';
        const params = new URLSearchParams({
          page: pageToFetch,
          limit: 12,
          category: category !== 'All' ? category : '',
          q: queryTerm,
          _t: Date.now(),
        });

        const res = await fetch(apiUrl(`/api/videos?${params.toString()}`));
        const data = await res.json();

        // Discard response if a newer request or category switch occurred in the meantime
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

  // Dedicated category selection: instantly wipes old category videos and resets state
  const handleSelectCategory = useCallback(
    (newCat) => {
      if (newCat === category) return;
      fetchIdRef.current++; // Invalidate any pending network requests from old category
      isFetchingRef.current = false;
      setVideos([]); // Immediately clear old category videos from screen
      setPage(1);
      setHasMore(true);
      setLoading(true);
      setCategory(newCat);
    },
    [category]
  );

  // Handle category or page change
  useEffect(() => {
    setPage(1);
    if (activePage === 'home') {
      if (category === 'All' && !searchQuery) {
        loadHomeSections(true);
      } else {
        fetchVideos(1, true);
      }
    } else if (activePage === 'search') {
      fetchVideos(1, true);
    }
  }, [category, searchQuery, activePage, loadHomeSections, fetchVideos]);

  // Infinite Scroll IntersectionObserver with debouncing and safeguards
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
          !loadingSections &&
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
  }, [activePage, hasMore, loading, loadingSections, page, videos.length, fetchVideos]);

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
          setWatchLaterVideos(data.videos);
          setWatchLaterIds(data.watchLaterIds || data.videos.map((v) => v.videoId));
        }
      } catch (err) {
        console.error('Failed to load watch later from server:', err);
      }
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('yt_guest_wl_v') || '[]');
        setWatchLaterVideos(stored);
      } catch { }
    }
  }, []);

  useEffect(() => {
    if (activePage === 'watch-later') {
      loadWatchLaterVideos();
    }
  }, [activePage, loadWatchLaterVideos]);

  // Select video to watch (loads genuinely related videos for that specific video)
  const handleSelectVideo = async (video) => {
    setSelectedVideo(video);
    setRelatedVideos([]);
    setActivePage('watch');
    setIsDrawerOpen(false);

    const vId = video.videoId || video._id;
    try {
      const res = await fetch(apiUrl(`/api/videos/${vId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.video) {
          setSelectedVideo(data.video);
        }
        if (data.related && data.related.length > 0) {
          setRelatedVideos(data.related);
        }
      }
    } catch (err) {
      console.error('Error loading related videos:', err);
    }
  };

  // Liked Videos Handlers
  const handleToggleLike = (video) => {
    const vId = video.videoId || video._id;
    const exists = likedVideoIds.includes(vId);
    let updatedIds;
    let updatedVideos;

    if (exists) {
      updatedIds = likedVideoIds.filter((id) => id !== vId);
      updatedVideos = likedVideos.filter((v) => (v.videoId || v._id) !== vId);
      showToast('Removed from Liked videos');
    } else {
      updatedIds = [vId, ...likedVideoIds];
      updatedVideos = [video, ...likedVideos];
      showToast('Added to Liked videos');
    }

    setLikedVideoIds(updatedIds);
    setLikedVideos(updatedVideos);
    localStorage.setItem('yt_liked_video_ids', JSON.stringify(updatedIds));
    localStorage.setItem('yt_liked_videos', JSON.stringify(updatedVideos));
  };

  const handleRemoveLike = (videoId) => {
    const updatedIds = likedVideoIds.filter((id) => id !== videoId);
    const updatedVideos = likedVideos.filter((v) => (v.videoId || v._id) !== videoId);
    setLikedVideoIds(updatedIds);
    setLikedVideos(updatedVideos);
    localStorage.setItem('yt_liked_video_ids', JSON.stringify(updatedIds));
    localStorage.setItem('yt_liked_videos', JSON.stringify(updatedVideos));
    showToast('Removed from Liked videos');
  };

  const handleClearLikedVideos = () => {
    setLikedVideoIds([]);
    setLikedVideos([]);
    localStorage.removeItem('yt_liked_video_ids');
    localStorage.removeItem('yt_liked_videos');
    showToast('Liked videos cleared');
  };

  // Subscriptions Handlers
  const handleToggleSubscribe = (channelInfo) => {
    const name = channelInfo.channelName;
    const exists = subscribedChannels.some(
      (c) => c.channelName.toLowerCase() === name.toLowerCase()
    );
    let updated;
    if (exists) {
      updated = subscribedChannels.filter(
        (c) => c.channelName.toLowerCase() !== name.toLowerCase()
      );
      showToast(`Unsubscribed from ${name}`);
    } else {
      updated = [
        ...subscribedChannels,
        {
          channelName: name,
          channelAvatar:
            channelInfo.channelAvatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=cc0000&color=fff&size=100`,
          subscriberCount: channelInfo.subscriberCount || '1.2M subscribers',
        },
      ];
      showToast(`Subscribed to ${name}`);
    }
    setSubscribedChannels(updated);
    localStorage.setItem('yt_subscribed_channels', JSON.stringify(updated));
  };

  const handleNavigate = (pageName) => {
    if (pageName === 'home') {
      setSelectedVideo(null);
      setSearchQuery('');
      setCategory('All');
      if (activePage === 'home' && category === 'All') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadHomeSections(true);
      }
    }
    setActivePage(pageName);
    setIsDrawerOpen(false);
  };

  // Search initiates navigation to dedicated search results page
  const handleSearch = (query) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    // Clear old cached videos immediately and activate top line loader
    setVideos([]);
    setLoading(true);
    setSearchQuery(cleanQuery);
    setActivePage('search');
    setCategory('All');
    setIsDrawerOpen(false);
  };

  // Toggle Sidebar or Drawer based on active page
  const handleToggleMenu = () => {
    if (activePage === 'watch') {
      setIsDrawerOpen((prev) => !prev);
    } else {
      // Toggle standard sidebar on desktop; on mobile it acts as drawer
      if (window.innerWidth <= 900) {
        setIsDrawerOpen((prev) => !prev);
      } else {
        setIsSidebarOpen((prev) => !prev);
      }
    }
  };

  // Watch Later toggle
  const handleToggleWatchLater = async (video) => {
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
      } catch (err) {
        showToast('Error updating Watch Later');
      }
    } else {
      // Guest mode
      const exists = watchLaterIds.includes(vId);
      let updatedIds;
      let updatedVideos;

      if (exists) {
        updatedIds = watchLaterIds.filter((id) => id !== vId);
        updatedVideos = watchLaterVideos.filter((v) => (v.videoId || v._id) !== vId);
        showToast('Removed from Watch Later');
      } else {
        updatedIds = [vId, ...watchLaterIds];
        updatedVideos = [video, ...watchLaterVideos];
        showToast('Saved to Watch Later (Guest)');
      }

      setWatchLaterIds(updatedIds);
      setWatchLaterVideos(updatedVideos);
      localStorage.setItem('yt_guest_wl', JSON.stringify(updatedIds));
      localStorage.setItem('yt_guest_wl_v', JSON.stringify(updatedVideos));
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
    } else {
      const updatedIds = watchLaterIds.filter((id) => id !== videoId);
      const updatedVideos = watchLaterVideos.filter(
        (v) => (v.videoId || v._id) !== videoId
      );
      setWatchLaterIds(updatedIds);
      setWatchLaterVideos(updatedVideos);
      localStorage.setItem('yt_guest_wl', JSON.stringify(updatedIds));
      localStorage.setItem('yt_guest_wl_v', JSON.stringify(updatedVideos));
      showToast('Removed from Watch Later');
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
    } else {
      setWatchLaterIds([]);
      setWatchLaterVideos([]);
      localStorage.removeItem('yt_guest_wl');
      localStorage.removeItem('yt_guest_wl_v');
      showToast('Watch Later playlist cleared');
    }
  };

  // Download video directly to user's device without redirecting
  const handleDownload = (video) => {
    const vId = video.videoId || video._id;
    const safeTitle = (video.title || 'video')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .slice(0, 50) || 'video';
    showToast(`Downloading: ${video.title.slice(0, 35)}...`);

    const link = document.createElement('a');
    link.href = apiUrl(`/api/videos/${vId}/download`);
    link.setAttribute('download', `${safeTitle}.mp4`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auth handlers
  const handleAuthSuccess = (data) => {
    localStorage.setItem('bintube_token', data.token);
    setUser(data.user);
    if (data.user.watchLaterIds) {
      setWatchLaterIds(data.user.watchLaterIds);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bintube_token');
    setUser(null);
    setWatchLaterIds([]);
    showToast('Signed out of YouTube');
  };

  const isHomeMultiSection = activePage === 'home' && category === 'All';

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

      {/* Signature YouTube Red Top Line Loader */}
      {(loading || loadingSections) && <div className="yt-top-line-loader" />}

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
          />
        )}

        {/* Overlay Drawer for Watch Page (or mobile toggle) - Solves "three bars not working" */}
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
        />

        {/* Main Content Area: Maximum Space Utilization */}
        <main className={`main-content ${activePage === 'watch' ? 'watch-mode' : ''}`}>
          {activePage === 'home' && (
            <>
              {/* Category Bar */}
              <CategoryBar
                activeCategory={category}
                onSelectCategory={handleSelectCategory}
              />

              {/* ALL SECTIONS ON HOME PAGE (Trending, Recent, Shorts, Music, Gaming, Tech, Feed) */}
              {isHomeMultiSection ? (
                <>
                  {/* 1. TRENDING NOW SECTION */}
                  {homeSections?.trending && homeSections.trending.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <FlameIcon size={22} style={{ color: '#ff0000' }} />
                          <h2 className="section-title">Trending Now</h2>
                        </div>
                        <button
                          className="section-more-btn"
                          onClick={() => handleSelectCategory('Trending')}
                        >
                          View all &rarr;
                        </button>
                      </div>
                      <div className="videos-grid">
                        {homeSections.trending.map((video, idx) => (
                          <VideoCard
                            key={`trending-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 2. RECENTLY UPLOADED SECTION */}
                  {homeSections?.recent && homeSections.recent.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <ClockIcon size={22} style={{ color: '#3ea6ff' }} />
                          <h2 className="section-title">Recently Uploaded</h2>
                        </div>
                        <button
                          className="section-more-btn"
                          onClick={() => handleSelectCategory('Recent')}
                        >
                          View all &rarr;
                        </button>
                      </div>
                      <div className="videos-grid">
                        {homeSections.recent.map((video, idx) => (
                          <VideoCard
                            key={`recent-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 3. YOUTUBE SHORTS SECTION */}
                  {homeSections?.shorts && homeSections.shorts.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <ShortsIcon size={22} />
                          <h2 className="section-title">Shorts</h2>
                        </div>
                      </div>
                      <div className="shorts-shelf">
                        {homeSections.shorts.map((video, idx) => (
                          <ShortsCard
                            key={`short-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 4. TRENDING MUSIC SECTION */}
                  {homeSections?.music && homeSections.music.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <MusicIcon size={22} style={{ color: '#ff4444' }} />
                          <h2 className="section-title">Trending Music</h2>
                        </div>
                        <button
                          className="section-more-btn"
                          onClick={() => handleSelectCategory('Music')}
                        >
                          Explore Music &rarr;
                        </button>
                      </div>
                      <div className="videos-grid">
                        {homeSections.music.map((video, idx) => (
                          <VideoCard
                            key={`music-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 5. GAMING HIGHLIGHTS SECTION */}
                  {homeSections?.gaming && homeSections.gaming.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <GamepadIcon size={22} style={{ color: '#3ea6ff' }} />
                          <h2 className="section-title">Gaming Highlights</h2>
                        </div>
                        <button
                          className="section-more-btn"
                          onClick={() => handleSelectCategory('Gaming')}
                        >
                          Explore Gaming &rarr;
                        </button>
                      </div>
                      <div className="videos-grid">
                        {homeSections.gaming.map((video, idx) => (
                          <VideoCard
                            key={`gaming-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 6. TECH & DEVELOPMENT SECTION */}
                  {homeSections?.tech && homeSections.tech.length > 0 && (
                    <section className="home-section">
                      <div className="section-header">
                        <div className="section-title-wrapper">
                          <CodeIcon size={22} style={{ color: '#2ba640' }} />
                          <h2 className="section-title">Technology & Development</h2>
                        </div>
                        <button
                          className="section-more-btn"
                          onClick={() => handleSelectCategory('Tech')}
                        >
                          Explore Tech &rarr;
                        </button>
                      </div>
                      <div className="videos-grid">
                        {homeSections.tech.map((video, idx) => (
                          <VideoCard
                            key={`tech-${video.videoId || video._id}-${idx}`}
                            video={video}
                            onSelectVideo={handleSelectVideo}
                            isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                            onToggleWatchLater={handleToggleWatchLater}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 7. CONTINUOUS FEED WITH SCROLL-TO-LOAD */}
                  <section className="home-section">
                    <div className="section-header">
                      <div className="section-title-wrapper">
                        <FlameIcon size={22} style={{ color: '#f57c00' }} />
                        <h2 className="section-title">Explore More Videos</h2>
                      </div>
                    </div>
                    <div className="videos-grid">
                      {videos.map((video, idx) => (
                        <VideoCard
                          key={`feed-${video.videoId || video._id}-${idx}`}
                          video={video}
                          onSelectVideo={handleSelectVideo}
                          isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                          onToggleWatchLater={handleToggleWatchLater}
                          onDownload={handleDownload}
                        />
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                /* SPECIFIC CATEGORY FILTER VIEW */
                videos.length === 0 && !loading ? (
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
                        key={`cat-${category}-${video.videoId || video._id}-${idx}`}
                        video={video}
                        onSelectVideo={handleSelectVideo}
                        isWatchLater={watchLaterIds.includes(video.videoId || video._id)}
                        onToggleWatchLater={handleToggleWatchLater}
                        onDownload={handleDownload}
                      />
                    ))}
                  </div>
                )
              )}

              {/* Infinite Scroll Sentinel */}
              <div ref={sentinelRef} className="scroll-sentinel">
                {(loading || loadingSections) && (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Loading more content...</span>
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
              onDownload={handleDownload}
              sentinelRef={sentinelRef}
            />
          )}

          {/* DEDICATED WATCH PAGE */}
          {activePage === 'watch' && selectedVideo && (
            <VideoPlayer
              video={selectedVideo}
              relatedVideos={relatedVideos}
              onSelectVideo={handleSelectVideo}
              isWatchLater={watchLaterIds.includes(selectedVideo.videoId || selectedVideo._id)}
              onToggleWatchLater={handleToggleWatchLater}
              onDownload={handleDownload}
              onNotify={showToast}
              isLiked={likedVideoIds.includes(selectedVideo.videoId || selectedVideo._id)}
              onToggleLike={handleToggleLike}
              isSubscribed={subscribedChannels.some(
                (c) => c.channelName.toLowerCase() === (selectedVideo.channelName || '').toLowerCase()
              )}
              onToggleSubscribe={handleToggleSubscribe}
            />
          )}

          {/* DEDICATED WATCH LATER PAGE */}
          {activePage === 'watch-later' && (
            <WatchLaterPage
              videos={watchLaterVideos}
              onSelectVideo={handleSelectVideo}
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
              onDownload={handleDownload}
              onExplore={() => handleNavigate('home')}
            />
          )}

          {/* DEDICATED LIKED VIDEOS PAGE */}
          {activePage === 'liked' && (
            <LikedVideosPage
              videos={likedVideos}
              onSelectVideo={handleSelectVideo}
              onRemoveLike={handleRemoveLike}
              onClearAll={handleClearLikedVideos}
              onExplore={() => handleNavigate('home')}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={handleToggleWatchLater}
              onDownload={handleDownload}
            />
          )}
        </main>
      </div>

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
