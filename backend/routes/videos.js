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
