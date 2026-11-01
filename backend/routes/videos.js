import express from 'express';
import { Readable, pipeline } from 'stream';
import { Ytdl, Client } from '@distube/ytdl-core';
import {
  fetchYouTubeVideos,
  fetchYouTubeVideoById,
  fetchHomeSections,
} from '../services/youtube.js';

const router = express.Router();
// Prioritize VisionOS, Tv, and WebEmbedded clients (zero player-script/PO token delay, resolves in ~1.2s)
const ytdl = new Ytdl({
  clients: [Client.VisionOS, Client.Tv, Client.WebEmbedded],
  timeoutMs: 6500,
});

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

// Authentic YouTube Shorts Categories Pool for diverse, non-repeating infinite scrolling
const SHORTS_CATEGORIES = {
  comedy: ['funny', 'comedy', 'prank', 'humor', 'fails', 'standup', 'jokes', 'funnyvideo'],
  tech: ['tech', 'gadgets', 'technology', 'lifehacks', 'diy', 'smartphones', 'coding'],
  animals: ['pets', 'animals', 'dogs', 'cats', 'funnyanimals', 'wildlife', 'cutedogs'],
  facts: ['facts', 'mindblowing', 'science', 'curiosity', 'history', 'didyouknow', 'amazingfacts'],
  satisfying: ['satisfying', 'art', 'crafts', 'asmr', 'relaxing', 'pottery', 'drawing'],
  entertainment: ['viral', 'reels', 'magic', 'stunts', 'illusions', 'dance', 'trendingshorts'],
  gaming: ['gaming', 'gamingclips', 'gameplay', 'gameshorts', 'gta', 'minecraft'],
  lifestyle: ['food', 'streetfood', 'cooking', 'travel', 'sports', 'fitness', 'workout']
};

const categoryKeys = Object.keys(SHORTS_CATEGORIES);

// In-memory cache per hashtag with 1-hour TTL: tag -> { shorts, timestamp }
const tagShortsCache = new Map();
const TAG_CACHE_TTL = 60 * 60 * 1000;

function normalizeTitleForDedup(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 28);
}

function extractChannelBrand(name) {
  return (name || '')
    .split(/[-–—|•,]/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getTitleKeywords(title) {
  return new Set(
    (title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !['shorts', 'video', 'viral', 'trending', 'shortsvideo', 'reels', 'tiktok'].includes(w))
  );
}

function isKeywordOverlap(kw1, seenKwList) {
  for (const prev of seenKwList) {
    let overlap = 0;
    for (const w of kw1) {
      if (prev.has(w)) overlap++;
    }
    if (overlap >= 2) return true;
  }
  return false;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
    const seenLocalTitles = new Set();

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
      const normTitle = normalizeTitleForDedup(title);
      if (normTitle && seenLocalTitles.has(normTitle)) continue;
      if (normTitle) seenLocalTitles.add(normTitle);

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

async function getShortsForTag(tag) {
  const cleanTag = (tag || '').toLowerCase().trim();
  const cached = tagShortsCache.get(cleanTag);
  if (cached && Date.now() - cached.timestamp < TAG_CACHE_TTL && cached.shorts.length > 0) {
    return cached.shorts;
  }

  const scraped = await fetchHashtagShorts(cleanTag);
  if (scraped && scraped.length > 0) {
    tagShortsCache.set(cleanTag, {
      shorts: scraped,
      timestamp: Date.now(),
    });
    return scraped;
  }

  // Fallback: If hashtag scraping yields nothing, search YouTube for short-duration videos
  try {
    const fallbackResults = await fetchYouTubeVideos({
      query: `#shorts ${cleanTag}`,
      category: 'All',
      limit: 12,
    });
    const fallbackShorts = (fallbackResults?.videos || [])
      .filter((v) => {
        const dur = v.duration || '';
        return dur.match(/^0:[0-5][0-9]$|^1:00$/) || dur === '0:00';
      })
      .map((v) => ({
        ...v,
        commentsCount: '1.2K',
        isShort: true,
      }));

    if (fallbackShorts.length > 0) {
      tagShortsCache.set(cleanTag, {
        shorts: fallbackShorts,
        timestamp: Date.now(),
      });
      return fallbackShorts;
    }
  } catch (_) {}

  return [];
}

// Get Dedicated YouTube Shorts Videos (Constantly Fresh, Randomized & Infinite)
router.get('/shorts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(24, parseInt(req.query.limit) || 12));
    const excludeParam = req.query.exclude || '';
    const excludeIds = new Set(
      excludeParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    // Pick 4 diverse, distinct categories for this batch
    let pickedCategories;
    if (page === 1) {
      // On page 1: Randomly pick 4 distinct categories so it NEVER repeats the same starting reels on revisit!
      pickedCategories = shuffleArray(categoryKeys).slice(0, 4);
    } else {
      // On subsequent pages: systematically rotate across categories to guarantee variety
      const offset = (page * 3) % categoryKeys.length;
      pickedCategories = [
        categoryKeys[offset],
        categoryKeys[(offset + 1) % categoryKeys.length],
        categoryKeys[(offset + 2) % categoryKeys.length],
        categoryKeys[(offset + 3) % categoryKeys.length],
      ];
    }

    // Pick 1 random tag from each chosen category
    const tagsToFetch = pickedCategories.map((cat) => {
      const tags = SHORTS_CATEGORIES[cat];
      return tags[Math.floor(Math.random() * tags.length)];
    });

    // Fetch shorts for each tag in parallel
    const batches = await Promise.all(tagsToFetch.map(getShortsForTag));

    // Interleave & Deduplicate
    const resultList = [];
    const seenIds = new Set(excludeIds);
    const seenTitles = new Set();
    const seenBrands = new Set();
    const seenKeywordsList = [];
    const maxLen = Math.max(...batches.map((b) => b.length), 0);

    for (let i = 0; i < maxLen; i++) {
      for (const batch of batches) {
        if (i < batch.length) {
          const item = batch[i];
          const id = item.videoId || item._id;
          const normTitle = normalizeTitleForDedup(item.title);
          const brand = extractChannelBrand(item.channelName);
          const kw = getTitleKeywords(item.title);

          const isDuplicateTitle = normTitle && seenTitles.has(normTitle);
          const isDuplicateBrand = brand && seenBrands.has(brand);
          const isOverlapping = isKeywordOverlap(kw, seenKeywordsList);

          if (id && !seenIds.has(id) && !isDuplicateTitle && !isDuplicateBrand && !isOverlapping) {
            seenIds.add(id);
            if (normTitle) seenTitles.add(normTitle);
            if (brand) seenBrands.add(brand);
            seenKeywordsList.push(kw);
            resultList.push(item);
          }
        }
      }
      if (resultList.length >= limit) break;
    }

    // If still need more to meet limit, draw from other categories
    if (resultList.length < limit) {
      for (const cat of categoryKeys) {
        const altTag = SHORTS_CATEGORIES[cat][0];
        const extra = await getShortsForTag(altTag);
        for (const item of extra) {
          const id = item.videoId || item._id;
          const normTitle = normalizeTitleForDedup(item.title);
          const brand = extractChannelBrand(item.channelName);
          const kw = getTitleKeywords(item.title);

          const isDuplicateTitle = normTitle && seenTitles.has(normTitle);
          const isDuplicateBrand = brand && seenBrands.has(brand);
          const isOverlapping = isKeywordOverlap(kw, seenKeywordsList);

          if (id && !seenIds.has(id) && !isDuplicateTitle && !isDuplicateBrand && !isOverlapping) {
            seenIds.add(id);
            if (normTitle) seenTitles.add(normTitle);
            if (brand) seenBrands.add(brand);
            seenKeywordsList.push(kw);
            resultList.push(item);
          }
          if (resultList.length >= limit) break;
        }
        if (resultList.length >= limit) break;
      }
    }

    // Shuffle final page 1 so order is dynamically unique every time
    const finalVideos = page === 1 ? shuffleArray(resultList).slice(0, limit) : resultList.slice(0, limit);

    return res.json({
      videos: finalVideos,
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

// In-memory cache for resolved format stream URLs (45-minute safe TTL)
const streamUrlCache = new Map(); // id -> { videoUrl, audioUrl, expiresAt }

async function resolveVideoFormats(id, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = streamUrlCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
  }

  let info;
  try {
    info = await ytdl.getInfo(id);
  } catch (err) {
    console.warn(`ytdl getInfo failed for ${id}: ${err.message}. Retrying with alternate client...`);
    const fallbackYtdl = new Ytdl({ clients: [Client.Tv, Client.WebEmbedded] });
    info = await fallbackYtdl.getInfo(id);
  }

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
      expiresAt: Date.now() + 45 * 60 * 1000,
    };
    streamUrlCache.set(id, result);
    return result;
  }

  // 2. Select high-definition MP4 video stream (universal H.264 / AVC 'avc1' at least 720p)
  // Strictly filter out AV1 ('av01') which fails on many browsers without hardware extension
  const mp4Videos = info.formats
    .filter((f) => f.hasVideo && f.container === 'mp4' && f.url && !f.codecs?.toLowerCase().includes('av01'))
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const allMp4s = info.formats
    .filter((f) => f.hasVideo && f.container === 'mp4' && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const candidatePool = mp4Videos.length > 0 ? mp4Videos : allMp4s;

  const videoFormat =
    candidatePool.find((f) => f.height === 720) ||
    candidatePool.find((f) => f.height === 1080) ||
    candidatePool.find((f) => f.height >= 720) ||
    candidatePool[0] ||
    info.formats.find((f) => f.hasVideo && f.url);

  // 3. Select best high-fidelity audio format (e.g. 128kbps AAC / itag 140 m4a)
  const audioFormats = info.formats
    .filter((f) => f.hasAudio && !f.hasVideo && f.url)
    .sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));

  const audioFormat =
    audioFormats.find((f) => f.container === 'mp4' || f.container === 'm4a' || f.codecs?.toLowerCase().includes('mp4a')) ||
    audioFormats[0] ||
    info.formats.find((f) => f.hasAudio && f.url) ||
    videoFormat;

  const result = {
    videoUrl: videoFormat?.url,
    audioUrl: audioFormat?.url || videoFormat?.url,
    videoType: videoFormat?.mimeType?.split(';')?.[0] || 'video/mp4',
    audioType: audioFormat?.mimeType?.split(';')?.[0] || 'audio/mp4',
    contentLength: parseInt(videoFormat?.contentLength, 10) || null,
    audioContentLength: parseInt(audioFormat?.contentLength, 10) || null,
    hasAudio: Boolean(videoFormat?.hasAudio),
    expiresAt: Date.now() + 45 * 60 * 1000,
  };

  if (result.videoUrl) {
    streamUrlCache.set(id, result);
  }
  return result;
}

// 1.5MB safe chunk size for videos and 512KB for audio (prevents Vercel 4.5MB payload limit & function timeout)
const VIDEO_CHUNK_SIZE = 1.5 * 1024 * 1024;
const AUDIO_CHUNK_SIZE = 512 * 1024;

function getSafeRange(rangeHeader, totalLength, chunkSize) {
  let start = 0;
  let end;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    start = parseInt(parts[0], 10) || 0;
    if (parts[1]) {
      end = parseInt(parts[1], 10);
    }
  }

  // If no end was provided by browser (e.g. 'bytes=0-') or chunk is too big, cap it safely
  if (end === undefined || isNaN(end) || (end - start + 1) > (chunkSize * 2)) {
    end = start + chunkSize - 1;
  }

  if (totalLength && end >= totalLength) {
    end = totalLength - 1;
  }

  return { start, end, rangeString: `bytes=${start}-${end}` };
}

// Stream Video Directly (HTML5 <video> range-supported direct stream)
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;
  const rangeHeader = req.headers.range;
  const isBypassCache = Boolean(req.query.retry || req.query.manual || req.query.t);

  try {
    let formats = await resolveVideoFormats(id, isBypassCache);
    if (!formats?.videoUrl) {
      return res.status(404).json({ message: 'No playable video stream found' });
    }

    const { rangeString } = getSafeRange(rangeHeader, formats.contentLength, VIDEO_CHUNK_SIZE);

    const forwardHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Range': rangeString,
    };

    let upstream = await fetch(formats.videoUrl, { headers: forwardHeaders });

    // If upstream returned 403 Forbidden or 410 Gone (stale/expired CDN token), refresh fresh format immediately
    if (!upstream.ok && (upstream.status === 403 || upstream.status === 410 || upstream.status === 404)) {
      console.warn(`Upstream returned ${upstream.status} for video ${id}. Refreshing fresh format token...`);
      streamUrlCache.delete(id);
      formats = await resolveVideoFormats(id, true);
      if (formats?.videoUrl) {
        upstream = await fetch(formats.videoUrl, { headers: forwardHeaders });
      }
    }

    if (!upstream.ok) {
      console.error(`Upstream error ${upstream.status} for video ${id}`);
      if (!res.headersSent) {
        return res.status(upstream.status).json({ message: `Upstream error ${upstream.status}` });
      }
      return;
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || formats.videoType || 'video/mp4');

    const cr = upstream.headers.get('content-range');
    const cl = upstream.headers.get('content-length');

    if (cr) {
      res.status(206);
      res.setHeader('Content-Range', cr);
    } else {
      res.status(upstream.status);
    }

    if (cl) {
      res.setHeader('Content-Length', cl);
    }

    const nodeStream = Readable.fromWeb(upstream.body);
    pipeline(nodeStream, res, (err) => {
      // Gracefully handle client abort, range slice completion or disconnect without crashing
    });
  } catch (err) {
    console.error(`Stream error for video ${id}:`, err.message);
    streamUrlCache.delete(id);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error streaming video', error: err.message });
    }
  }
});

// Stream Audio Directly (Dedicated background audio playback)
router.get('/:id/audio', async (req, res) => {
  const { id } = req.params;
  const rangeHeader = req.headers.range;
  const isBypassCache = Boolean(req.query.retry || req.query.manual || req.query.t);

  try {
    let formats = await resolveVideoFormats(id, isBypassCache);
    if (!formats?.audioUrl) {
      return res.status(404).json({ message: 'No playable audio stream found' });
    }

    const { rangeString } = getSafeRange(rangeHeader, formats.audioContentLength, AUDIO_CHUNK_SIZE);

    const forwardHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Range': rangeString,
    };

    let upstream = await fetch(formats.audioUrl, { headers: forwardHeaders });

    // If upstream returned 403 Forbidden or 410 Gone (stale/expired CDN token), refresh fresh format immediately
    if (!upstream.ok && (upstream.status === 403 || upstream.status === 410 || upstream.status === 404)) {
      console.warn(`Upstream audio returned ${upstream.status} for video ${id}. Refreshing fresh format token...`);
      streamUrlCache.delete(id);
      formats = await resolveVideoFormats(id, true);
      if (formats?.audioUrl) {
        upstream = await fetch(formats.audioUrl, { headers: forwardHeaders });
      }
    }

    if (!upstream.ok) {
      console.error(`Upstream audio error ${upstream.status} for video ${id}`);
      if (!res.headersSent) {
        return res.status(upstream.status).json({ message: `Upstream audio error ${upstream.status}` });
      }
      return;
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || formats.audioType || 'audio/mp4');

    const cr = upstream.headers.get('content-range');
    const cl = upstream.headers.get('content-length');

    if (cr) {
      res.status(206);
      res.setHeader('Content-Range', cr);
    } else {
      res.status(upstream.status);
    }

    if (cl) {
      res.setHeader('Content-Length', cl);
    }

    const nodeStream = Readable.fromWeb(upstream.body);
    pipeline(nodeStream, res, (err) => {
      // Gracefully handle client abort, range slice completion or disconnect without crashing
    });
  } catch (err) {
    console.error(`Audio stream error for video ${id}:`, err.message);
    streamUrlCache.delete(id);
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
