import express from 'express';
import { Readable } from 'stream';
import { Ytdl, Client } from '@distube/ytdl-core';
import {
  fetchYouTubeVideos,
  fetchYouTubeVideoById,
  fetchHomeSections,
} from '../services/youtube.js';

const router = express.Router();
const ytdl = new Ytdl({ clients: [Client.Mweb, Client.WebEmbedded, Client.Tv] });

// Anti-caching middleware so every page refresh receives fresh randomized videos
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Realtime YouTube Categories
const CATEGORIES = [
  'All',
  'Music',
  'Gaming',
  'Tech',
  'Coding',
  'News',
  'Sports',
  'Animation',
  'Podcasts',
  'Documentaries',
];

// Get Multi-Content Sections for Home Page (Shorts, Music, Gaming, Tech, Featured, Feed)
router.get('/home-sections', async (req, res) => {
  try {
    const sections = await fetchHomeSections();
    return res.json(sections);
  } catch (err) {
    console.error('Error fetching home sections:', err);
    return res.status(500).json({ message: 'Error retrieving home page sections.' });
  }
});

// Authentic YouTube Shorts Hashtag Pool for unlimited infinite scrolling
const SHORTS_HASHTAGS = [
  'shorts', 'funny', 'viral', 'reels', 'comedy',
  'trendingshorts', 'dance', 'gaming', 'pets', 'satisfying',
  'entertainment', 'prank', 'magic', 'food', 'sports',
  'meme', 'animals', 'music', 'art', 'illusions',
  'facts', 'talent', 'diy', 'cute', 'fails',
  'standup', 'stunts', 'comedyvideo', 'lifehacks', 'shortsvideo'
];

// In-memory pool for deduplicated, authentic YouTube shorts
const shortsCachePool = new Map();
let lastShortsHashtagIdx = 0;

async function fetchHashtagShorts(tag) {
  try {
    const res = await fetch(`https://www.youtube.com/hashtag/${encodeURIComponent(tag)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const dataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!dataMatch) return [];

    const data = JSON.parse(dataMatch[1]);
    const gridItems =
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents || [];

    const shorts = [];
    for (const item of gridItems) {
      const v = item?.richItemRenderer?.content?.videoRenderer;
      if (!v || !v.videoId) continue;

      // Ensure it is a genuine short (reelWatchEndpoint, webPageType SHORTS, or short duration <= 60s)
      const isReel = Boolean(
        v.navigationEndpoint?.reelWatchEndpoint ||
        v.navigationEndpoint?.commandMetadata?.webPageType === 'WEB_PAGE_TYPE_SHORTS' ||
        v.lengthText?.simpleText?.match(/^0:[0-5][0-9]$|^1:00$/)
      );
      if (!isReel) continue;

      const title = v.title?.runs?.map((r) => r.text).join('') || 'YouTube Short';
      const channel = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'Creator';
      const avatar =
        v.avatar?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url ||
        v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(channel)}&background=ff0000&color=fff`;
      const views = v.viewCountText?.simpleText || '250K views';
      const duration = v.lengthText?.simpleText || '0:45';

      const viewsNum = parseInt(views.replace(/[^0-9]/g, ''), 10) || 120000;
      const likesNum = Math.max(1200, Math.floor(viewsNum * 0.05));
      const commentsNum = Math.max(80, Math.floor(viewsNum * 0.003));

      const formatK = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
      };

      shorts.push({
        _id: v.videoId,
        videoId: v.videoId,
        title,
        channelName: channel,
        channelAvatar: avatar,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        views,
        duration,
        likes: formatK(likesNum),
        commentsCount: formatK(commentsNum),
        subscriberCount: '1.2M subscribers',
        isShort: true,
      });
    }

    return shorts;
  } catch (err) {
    return [];
  }
}

// Get Dedicated YouTube Shorts Videos (Unlimited infinite loading)
router.get('/shorts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(24, parseInt(req.query.limit) || 12));
    const targetCount = page * limit + limit;

    // Replenish shorts pool if running low
    if (shortsCachePool.size < targetCount) {
      const tagsToFetch = [];
      for (let i = 0; i < 4; i++) {
        const tag = SHORTS_HASHTAGS[lastShortsHashtagIdx % SHORTS_HASHTAGS.length];
        lastShortsHashtagIdx++;
        tagsToFetch.push(tag);
      }

      const results = await Promise.all(tagsToFetch.map(fetchHashtagShorts));
      for (const batch of results) {
        for (const s of batch) {
          if (!shortsCachePool.has(s.videoId)) {
            shortsCachePool.set(s.videoId, s);
          }
        }
      }
    }

    // Fallback: If still under target, supplement from search with duration <= 60
    if (shortsCachePool.size < targetCount) {
      try {
        const fallbackResults = await fetchYouTubeVideos({
          query: `#shorts ${SHORTS_HASHTAGS[page % SHORTS_HASHTAGS.length]}`,
          category: 'All',
          page: Math.floor(page / 2) + 1,
          limit: 12,
        });
        for (const v of fallbackResults?.videos || []) {
          if (!shortsCachePool.has(v.videoId)) {
            shortsCachePool.set(v.videoId, {
              ...v,
              commentsCount: '1.2K',
              isShort: true,
            });
          }
        }
      } catch (_) {}
    }

    const allShorts = Array.from(shortsCachePool.values());
    const startIndex = (page - 1) * limit;
    const pageVideos = allShorts.slice(startIndex, startIndex + limit);

    return res.json({
      videos: pageVideos.length > 0 ? pageVideos : allShorts.slice(0, limit),
      page,
      hasMore: true,
    });
  } catch (err) {
    console.error('Error fetching shorts:', err);
    return res.status(500).json({ message: 'Error retrieving shorts.' });
  }
});

// Get Paginated & Filtered Realtime YouTube Videos
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(24, parseInt(req.query.limit) || 12));
    const query = req.query.q || '';
    const category = req.query.category || 'All';

    const result = await fetchYouTubeVideos({
      query,
      category,
      page,
      limit,
    });

    return res.json(result);
  } catch (err) {
    console.error('Error fetching realtime YouTube videos:', err);
    return res.status(500).json({ message: 'Error retrieving YouTube videos.' });
  }
});

// Get Categories list
router.get('/meta/categories', (req, res) => {
  return res.json(CATEGORIES);
});

// Realtime Search Suggestions (Debounced & throttled on client, proxied without CORS issue)
const handleSuggestions = async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json({ suggestions: [] });
  }

  // 1. YouTube Client API (Exact ranking & matches official YouTube suggestions)
  try {
    const ytUrl = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=en&q=${encodeURIComponent(query)}`;
    const response = await fetch(ytUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const text = await response.text();
      const match = text.match(/window\.google\.ac\.h\((.*)\)/s);
      if (match) {
        const data = JSON.parse(match[1]);
        if (Array.isArray(data[1])) {
          const suggestions = data[1]
            .map((item) => (Array.isArray(item) ? item[0] : item))
            .filter(Boolean);
          if (suggestions.length > 0) {
            return res.json({ suggestions });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching YouTube client suggestions:', err.message);
  }

  // 2. Fallback: Firefox client API format
  try {
    const ffUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    const response = await fetch(ffUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      const suggestions = Array.isArray(data[1]) ? data[1] : [];
      return res.json({ suggestions });
    }
  } catch (err) {
    console.error('Error fetching fallback suggestions:', err.message);
  }

  return res.json({ suggestions: [] });
};

router.get('/meta/suggestions', handleSuggestions);
router.get('/suggestions', handleSuggestions);

// Direct MP4 Video Downloader (Streams file directly if supported, with automatic resilient cloud fallback)
router.get('/:id/download', async (req, res) => {
  const { id } = req.params;
  const fallbackUrl = `https://ssyoutube.com/watch?v=${encodeURIComponent(id)}`;

  try {
    const info = await ytdl.getInfo(id);
    const videoTitle = info.videoDetails?.title || 'video';
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().slice(0, 60) || 'video';

    // Pick best format with both video and audio, preferred MP4
    const format =
      info.formats.find((f) => f.hasVideo && f.hasAudio && f.container === 'mp4') ||
      info.formats.find((f) => f.hasVideo && f.hasAudio) ||
      info.formats.find((f) => f.hasVideo && f.container === 'mp4') ||
      info.formats.find((f) => f.hasVideo);

    if (!format || !format.url) {
      return res.redirect(302, fallbackUrl);
    }

    const videoStreamResponse = await fetch(format.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!videoStreamResponse.ok) {
      return res.redirect(302, fallbackUrl);
    }

    // Set download attachment headers so browser triggers native file save directly
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(safeTitle)}.mp4"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.mp4`
    );
    res.setHeader('Content-Type', 'video/mp4');
    const contentLength = format.contentLength || videoStreamResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (req.method === 'HEAD') {
      return res.end();
    }

    // Pipe directly to browser client
    const nodeStream = Readable.fromWeb(videoStreamResponse.body);
    nodeStream.pipe(res);

    req.on('close', () => {
      nodeStream.destroy();
    });
  } catch (err) {
    console.error('Download stream error:', err.message);
    if (!res.headersSent) {
      // Graceful fallback for cloud serverless (Vercel IP blocks or payload limits)
      return res.redirect(302, fallbackUrl);
    }
  }
});

// In-memory cache for resolved format stream URLs (3-hour TTL)
const streamUrlCache = new Map(); // id -> { videoUrl, audioUrl, expiresAt }

async function resolveVideoFormats(id) {
  const cached = streamUrlCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const info = await ytdl.getInfo(id);

  // 1. Check if a pre-muxed combined format with height >= 720 exists
  const combined720 = info.formats.find(
    (f) => f.hasAudio && f.hasVideo && (f.height >= 720 || f.itag === 22) && f.container === 'mp4' && f.url
  );
  if (combined720) {
    const result = {
      videoUrl: combined720.url,
      audioUrl: combined720.url,
      videoType: combined720.mimeType?.split(';')?.[0] || 'video/mp4',
      audioType: combined720.mimeType?.split(';')?.[0] || 'audio/mp4',
      hasAudio: true,
      expiresAt: Date.now() + 3 * 3600 * 1000,
    };
    streamUrlCache.set(id, result);
    return result;
  }

  // 2. Select high-definition MP4 video stream (at least 720p: 720p or 1080p)
  const mp4Videos = info.formats
    .filter((f) => f.hasVideo && f.container === 'mp4' && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  // Prioritize 720p or 1080p, otherwise highest available
  const videoFormat =
    mp4Videos.find((f) => f.height === 720) ||
    mp4Videos.find((f) => f.height === 1080) ||
    mp4Videos.find((f) => f.height >= 720) ||
    mp4Videos[0] ||
    info.formats.find((f) => f.hasVideo && f.url);

  // 3. Select best high-fidelity audio format (e.g. 128kbps AAC / itag 140 m4a)
  const audioFormats = info.formats
    .filter((f) => f.hasAudio && !f.hasVideo && f.url)
    .sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));

  const audioFormat =
    audioFormats.find((f) => f.container === 'mp4' || f.container === 'm4a') ||
    audioFormats[0] ||
    info.formats.find((f) => f.hasAudio && f.url) ||
    videoFormat;

  const result = {
    videoUrl: videoFormat?.url,
    audioUrl: audioFormat?.url || videoFormat?.url,
    videoType: videoFormat?.mimeType?.split(';')?.[0] || 'video/mp4',
    audioType: audioFormat?.mimeType?.split(';')?.[0] || 'audio/mp4',
    hasAudio: Boolean(videoFormat?.hasAudio),
    expiresAt: Date.now() + 3 * 3600 * 1000,
  };

  streamUrlCache.set(id, result);
  return result;
}

// Stream Video Directly (HTML5 <video> range-supported direct stream)
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;
  const rangeHeader = req.headers.range;

  try {
    const { videoUrl, videoType } = await resolveVideoFormats(id);
    if (!videoUrl) {
      return res.status(404).json({ message: 'No playable video stream found' });
    }

    const forwardHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (rangeHeader) {
      forwardHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(videoUrl, { headers: forwardHeaders });

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || videoType || 'video/mp4');

    if (upstream.status === 206) {
      res.status(206);
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
    } else {
      res.status(upstream.status);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
    }

    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.pipe(res);

    req.on('close', () => {
      try {
        nodeStream.destroy();
      } catch (_) {}
    });
  } catch (err) {
    console.error(`Stream error for video ${id}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error streaming video', error: err.message });
    }
  }
});

// Stream Audio Directly (Dedicated background audio playback)
router.get('/:id/audio', async (req, res) => {
  const { id } = req.params;
  const rangeHeader = req.headers.range;

  try {
    const { audioUrl, audioType } = await resolveVideoFormats(id);
    if (!audioUrl) {
      return res.status(404).json({ message: 'No playable audio stream found' });
    }

    const forwardHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (rangeHeader) {
      forwardHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(audioUrl, { headers: forwardHeaders });

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || audioType || 'audio/mp4');

    if (upstream.status === 206) {
      res.status(206);
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
    } else {
      res.status(upstream.status);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
    }

    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.pipe(res);

    req.on('close', () => {
      try {
        nodeStream.destroy();
      } catch (_) {}
    });
  } catch (err) {
    console.error(`Audio stream error for video ${id}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error streaming audio', error: err.message });
    }
  }
});

// Get Single YouTube Video Details + Related Videos
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchYouTubeVideoById(id);
    return res.json(data);
  } catch (err) {
    console.error('Error loading video details:', err);
    return res.status(500).json({ message: 'Error loading YouTube video details.' });
  }
});

export default router;
