import ytSearch from 'yt-search';

// Helper to format large numbers to compact YouTube string (e.g. 1.2M, 450K)
function formatCompactNumber(number) {
  if (!number || isNaN(number)) return '0';
  const num = Math.abs(Number(number));
  if (num >= 1.0e9) {
    return (num / 1.0e9).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1.0e6) {
    return (num / 1.0e6).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1.0e3) {
    return (num / 1.0e3).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// Fisher-Yates array shuffle for true randomization on every refresh
function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Pick N random distinct items from an array
function pickRandomItems(arr, count = 1) {
  if (!arr || arr.length === 0) return [];
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Diverse, high-quality search queries per home section for endless variety
const SECTION_QUERIES = {
  trending: [
    'top trending videos today',
    'viral youtube videos 2026',
    'breaking viral moments entertainment',
    'popular entertainment highlights 2026',
    'most viewed youtube hits today',
    'trending creators worldwide videos',
    'internet sensation viral video clips',
    'must watch trending videos today',
    'top charts trending worldwide',
    'viral entertainment buzz 2026',
  ],
  recent: [
    'new uploaded trailers videos today',
    'latest video uploads today',
    'new releases official videos 2026',
    'recent uploaded episodes today',
    'brand new trailers official 2026',
    'newly released official music videos',
    'latest tech gadget review uploads',
    'breaking world news latest uploads',
    'new released gameplay episode today',
    'fresh uploaded videos 2026',
  ],
  shorts: [
    'youtube shorts viral reel comedy',
    'best funny shorts viral clips',
    'mindblowing shorts tricks science',
    'satisfying shorts viral moments',
    'epic viral shorts clips 2026',
    'popular meme shorts reel compilation',
    'trending short videos 2026',
    'amazing skills shorts reel',
    'crazy illusions viral shorts',
    'hilarious viral shorts reel',
  ],
  music: [
    'trending official music hits songs',
    'top hits music official video 2026',
    'billboard top chart songs video',
    'new official music videos 2026',
    'global top music artists hits songs',
    'lo-fi chill beats music video',
    'acoustic live performance hits songs',
    'viral music videos worldwide',
    'top pop rap songs hits 2026',
    'best songs official music video',
  ],
  gaming: [
    'popular gaming gameplay walkthrough highlights',
    'best gaming moments live gameplay 2026',
    'epic gaming funny moments compilation',
    'top new game trailer gameplay',
    'gta 5 funny moments gameplay',
    'minecraft epic builds gameplay',
    'esports tournament clutch moments',
    'unbelievable gaming plays 2026',
    'cyberpunk witcher gameplay highlights',
    'popular twitch gaming stream clips',
  ],
  tech: [
    'latest technology gadgets reviews web',
    'tech news smartphones future technology',
    'best tech gadgets 2026',
    'software engineering coding technology',
    'artificial intelligence breakthroughs 2026',
    'coolest desk setup gadgets 2026',
    'robotics and futuristic technology',
    'next gen technology review 2026',
    'smart tech inventions 2026',
    'computer hardware innovation tech',
  ],
  feed: [
    'popular youtube entertainment videos',
    'fascinating science discovery documentary',
    'stand up comedy highlights funny',
    'extreme sports best moments 4k',
    'street food cooking delicious recipes',
    'mindblowing documentary mysteries',
    'restoration project satisfying 4k',
    'curious world history explained',
    'nature wildlife documentary 4k',
    'travel adventure secret locations',
    'creative woodworking craft maker',
    'magic tricks illusions revealed',
    'popular podcast best discussions',
    'space ocean exploration documentary',
    'bizarre engineering inventions',
    'best car automotive reviews 4k',
  ],
};

// Category queries for filtered browsing
const CATEGORY_QUERIES = {
  All: SECTION_QUERIES.feed,
  Trending: SECTION_QUERIES.trending,
  Recent: SECTION_QUERIES.recent,
  Music: SECTION_QUERIES.music,
  Gaming: SECTION_QUERIES.gaming,
  Tech: SECTION_QUERIES.tech,
  Coding: [
    'programming tutorials software development',
    'web development full course coding',
    'javascript react python coding guide',
    'software developer build project',
    'machine learning python tutorial',
    'full stack app development coding',
    'computer science principles explained',
  ],
  News: [
    'top news headlines global world today',
    'breaking international news today',
    'daily world news report live',
    'global economy tech news today',
    'world affairs politics report news',
  ],
  Sports: [
    'sports highlights championship matches',
    'best sports moments goals plays',
    'cricket football basketball highlights',
    'insane athletic moments plays',
    'champions league sports highlights',
  ],
  Animation: [
    'animated short films 3d animation CGI',
    'best animation funny animated story',
    'cgi 3d animated short video',
    'blender 3d award winning animation',
    'indie animation viral short',
  ],
  Podcasts: [
    'popular video podcast full episodes',
    'best podcast interview discussion',
    'talk show podcast full video',
    'deep conversation podcast video',
    'top thinkers creators podcast interview',
  ],
  Documentaries: [
    'full nature science documentary',
    'history science discovery documentary full',
    'fascinating wild documentary episode',
    'ancient civilization mystery documentary',
    'deep ocean mysteries documentary full',
  ],
};

// In-memory query cache: query -> { videos: Array, timestamp: number }
const queryCache = new Map();
const QUERY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Section pools: sectionName -> Map<videoId, video>
const sectionPools = {
  trending: new Map(),
  recent: new Map(),
  shorts: new Map(),
  music: new Map(),
  gaming: new Map(),
  tech: new Map(),
  feed: new Map(),
};

// Category pools: categoryName -> Map<videoId, video>
const categoryPools = new Map();

// Global lookup map: videoId -> video
const videoMap = new Map();

// Search YouTube for a specific query and cache the result
async function searchAndFormatQuery(queryText, categoryName = 'All') {
  const cleanKey = (queryText || '').trim().toLowerCase();
  if (!cleanKey) return [];

  const now = Date.now();
  const cached = queryCache.get(cleanKey);
  if (cached && now - cached.timestamp < QUERY_CACHE_TTL && cached.videos.length > 0) {
    return cached.videos;
  }

  try {
    const searchResult = await ytSearch(cleanKey);
    const rawVideos = (searchResult && searchResult.videos) || [];
    const formattedList = [];

    for (const item of rawVideos) {
      const videoId = item.videoId || `yt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const viewsCount = item.views || 50000;
      const estimatedLikes = Math.max(120, Math.floor(viewsCount * 0.048));
      const seedMultiplier = ((videoId.charCodeAt(0) || 7) % 8) + 2;
      const estimatedSubs = Math.max(50000, Math.floor(viewsCount * seedMultiplier * 0.4));

      const formatted = {
        _id: videoId,
        videoId: videoId,
        title: item.title || 'Untitled Video',
        description: item.description || '',
        thumbnailUrl:
          item.image ||
          item.thumbnail ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: item.timestamp || '0:00',
        channelName: item.author?.name || 'YouTube Creator',
        channelAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          item.author?.name || 'YT'
        )}&background=cc0000&color=fff&size=100`,
        subscriberCount: `${formatCompactNumber(estimatedSubs)} subscribers`,
        likes: `${formatCompactNumber(estimatedLikes)}`,
        views: `${formatCompactNumber(viewsCount)} views`,
        uploadDate: item.ago || 'Recently',
        category: categoryName || 'All',
        videoUrl: item.url || `https://www.youtube.com/watch?v=${videoId}`,
      };

      videoMap.set(videoId, formatted);
      formattedList.push(formatted);
    }

    if (formattedList.length > 0) {
      queryCache.set(cleanKey, {
        videos: formattedList,
        timestamp: now,
      });
    }

    return formattedList;
  } catch (err) {
    console.error(`YouTube search error for "${queryText}":`, err.message);
    return cached ? cached.videos : [];
  }
}

// Retrieve randomized videos for a section from its query pool
async function getSectionVideos(sectionName, targetCount = 8) {
  if (!sectionPools[sectionName]) {
    sectionPools[sectionName] = new Map();
  }
  const pool = sectionPools[sectionName];

  const queries = SECTION_QUERIES[sectionName] || SECTION_QUERIES.feed;
  // Pick 2 random queries from this section's query pool
  const chosenQueries = pickRandomItems(queries, 2);

  // Fetch queries in parallel
  const queryResults = await Promise.all(
    chosenQueries.map((q) => searchAndFormatQuery(q, sectionName))
  );

  // Store in pool
  for (const list of queryResults) {
    for (const v of list) {
      pool.set(v.videoId, v);
    }
  }

  // If pool has fewer than targetCount, fetch extra queries from this section only
  let poolVideos = Array.from(pool.values());
  if (poolVideos.length < targetCount) {
    const remainingQueries = queries.filter((q) => !chosenQueries.includes(q));
    const extraQueries = pickRandomItems(remainingQueries, 2);
    if (extraQueries.length > 0) {
      const extraResults = await Promise.all(
        extraQueries.map((q) => searchAndFormatQuery(q, sectionName))
      );
      for (const list of extraResults) {
        for (const v of list) {
          pool.set(v.videoId, v);
        }
      }
      poolVideos = Array.from(pool.values());
    }
  }

  // Shuffle pool randomly on EVERY refresh
  const shuffled = shuffleArray(poolVideos);
  return shuffled.slice(0, targetCount);
}

// Fetch Multi-Section Home Content (Trending, Recent, Shorts, Music, Gaming, Tech, Feed)
// Displays randomized videos on EVERY refresh!
export async function fetchHomeSections() {
  const [trending, recent, shorts, music, gaming, tech, feed] = await Promise.all([
    getSectionVideos('trending', 8),
    getSectionVideos('recent', 8),
    getSectionVideos('shorts', 8),
    getSectionVideos('music', 8),
    getSectionVideos('gaming', 8),
    getSectionVideos('tech', 8),
    getSectionVideos('feed', 16),
  ]);

  return {
    trending,
    recent,
    shorts,
    music,
    gaming,
    tech,
    feed,
    hasMore: true,
  };
}

// Search query modifiers for unlimited paginated results
const SEARCH_MODIFIERS = [
  '',
  'popular',
  'video',
  'trending',
  'official',
  'hd',
  'clips',
  'new',
  'best',
  'highlights',
  'live',
  'full',
  'top',
  'moments',
  'viral',
  'compilation',
  'music',
  'gameplay',
  'review',
  'channel',
];

// Fetch Paginated YouTube Videos (Search results or Category browsing)
// Supports UNLIMITED infinite loading for Home, Search, Shorts, and Up Next
export async function fetchYouTubeVideos({ query = '', category = 'All', page = 1, limit = 12 }) {
  const isSearch = Boolean(query && query.trim());

  // If user searched for a specific term, dynamically generate query variants for unlimited pages
  if (isSearch) {
    const searchKey = query.trim();
    const modIdx1 = ((page - 1) * 2) % SEARCH_MODIFIERS.length;
    const modIdx2 = ((page - 1) * 2 + 1) % SEARCH_MODIFIERS.length;
    
    const q1 = page === 1 ? searchKey : (SEARCH_MODIFIERS[modIdx1] ? `${searchKey} ${SEARCH_MODIFIERS[modIdx1]}` : searchKey);
    const q2 = `${searchKey} ${SEARCH_MODIFIERS[modIdx2] || 'video'}`;
    const queryList = q1 === q2 ? [q1] : [q1, q2];

    const results = await Promise.all(
      queryList.map((q) => searchAndFormatQuery(q, category))
    );

    const pageVideos = [];
    const seen = new Set();
    for (const list of results) {
      for (const v of list) {
        const id = v.videoId || v._id;
        if (id && !seen.has(id)) {
          seen.add(id);
          pageVideos.push(v);
        }
      }
    }

    // If still need more to fill limit, fetch base searchKey
    if (pageVideos.length < limit && page > 1) {
      const fallbackList = await searchAndFormatQuery(searchKey, category);
      for (const v of fallbackList) {
        const id = v.videoId || v._id;
        if (id && !seen.has(id)) {
          seen.add(id);
          pageVideos.push(v);
        }
        if (pageVideos.length >= limit) break;
      }
    }

    const paginatedVideos = pageVideos.slice(0, limit);
    const total = 9999; // Unlimited virtual catalog
    const totalPages = 999;
    // Always hasMore for infinite scroll
    const hasMore = true;

    return {
      videos: paginatedVideos,
      total,
      page: Number(page),
      totalPages,
      hasMore,
    };
  }

  // Strictly isolated category queries - no cross-contamination between categories!
  const catKey = category || 'All';
  const queryList = CATEGORY_QUERIES[catKey] || CATEGORY_QUERIES.All;

  // On page 1: pick 2 random queries from this category for fresh random content on refresh
  // On page > 1: select deterministic query pairs so pagination doesn't repeat page 1
  let chosenQueries;
  if (page === 1) {
    chosenQueries = pickRandomItems(queryList, 2);
  } else {
    const cycle = Math.floor((page * 2 - 2) / queryList.length);
    const q1Raw = queryList[(page * 2 - 2) % queryList.length];
    const q2Raw = queryList[(page * 2 - 1) % queryList.length];
    const modifier = cycle > 0 ? ` ${SEARCH_MODIFIERS[cycle % SEARCH_MODIFIERS.length]}` : '';
    const q1 = `${q1Raw}${modifier}`.trim();
    const q2 = `${q2Raw}${modifier}`.trim();
    chosenQueries = q1 === q2 ? [q1] : [q1, q2];
  }

  const queryResults = await Promise.all(
    chosenQueries.map((q) => searchAndFormatQuery(q, catKey))
  );

  // Collect strictly deduplicated videos for this category
  const pageVideos = [];
  const seenIds = new Set();
  for (const list of queryResults) {
    for (const v of list) {
      const id = v.videoId || v._id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        pageVideos.push(v);
      }
    }
  }

  // If pool has fewer than limit, fetch another query from this category only
  if (pageVideos.length < limit && queryList.length > chosenQueries.length) {
    const remainingQueries = queryList.filter((q) => !chosenQueries.includes(q));
    if (remainingQueries.length > 0) {
      const extraResults = await searchAndFormatQuery(remainingQueries[0], catKey);
      for (const v of extraResults) {
        const id = v.videoId || v._id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          pageVideos.push(v);
        }
        if (pageVideos.length >= limit) break;
      }
    }
  }

  const resultVideos = page === 1 ? shuffleArray(pageVideos).slice(0, limit) : pageVideos.slice(0, limit);
  const total = 9999;
  const totalPages = 999;
  // Unlimited endless loading across all categories
  const hasMore = true;

  return {
    videos: resultVideos,
    total,
    page: Number(page),
    totalPages,
    hasMore,
  };
}

// Fetch single video details + genuinely related videos
export async function fetchYouTubeVideoById(videoId) {
  let video = videoMap.get(videoId);

  // If not in cache or if it only has the short search snippet, fetch full details with complete description
  if (!video || !video.hasFullDetails) {
    try {
      let details = null;
      try {
        details = await ytSearch({ videoId });
      } catch (e) {
        const searchRes = await ytSearch(videoId);
        if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
          details = searchRes.videos[0];
        }
      }

      if (details) {
        const viewsCount = details.views || (video && video.views) || 100000;
        const estimatedLikes = Math.max(240, Math.floor(viewsCount * 0.052));
        const estimatedSubs = Math.max(120000, Math.floor(viewsCount * 1.8));

        video = {
          _id: details.videoId || videoId,
          videoId: details.videoId || videoId,
          title: details.title || (video && video.title) || 'YouTube Video',
          description: details.description || (video && video.description) || '',
          thumbnailUrl:
            details.image ||
            details.thumbnail ||
            (video && video.thumbnailUrl) ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: details.timestamp || (video && video.duration) || '0:00',
          channelName: details.author?.name || (video && video.channelName) || 'YouTube Channel',
          channelAvatar:
            (video && video.channelAvatar) ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              details.author?.name || 'YT'
            )}&background=cc0000&color=fff&size=100`,
          subscriberCount: `${formatCompactNumber(estimatedSubs)} subscribers`,
          likes: `${formatCompactNumber(estimatedLikes)}`,
          views: `${formatCompactNumber(viewsCount)} views`,
          uploadDate: details.ago || details.uploadDate || (video && video.uploadDate) || 'Recently',
          videoUrl: details.url || `https://www.youtube.com/watch?v=${videoId}`,
          tags: details.genre ? [details.genre] : ['YouTube', 'Video'],
          hasFullDetails: true,
        };

        videoMap.set(videoId, video);
      }
    } catch (err) {
      console.error('Error fetching single video from YouTube:', err.message);
    }
  }

  // Fallback if not available
  if (!video) {
    video = {
      _id: videoId,
      videoId: videoId,
      title: 'YouTube Video',
      description: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: '0:00',
      channelName: 'YouTube Creator',
      channelAvatar: 'https://ui-avatars.com/api/?name=YT&background=cc0000&color=fff&size=100',
      subscriberCount: '',
      likes: '',
      views: '',
      uploadDate: '',
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      tags: ['YouTube'],
    };
    videoMap.set(videoId, video);
  }

  // Related videos
  let related = [];
  try {
    const cleanTitle = (video.title || '')
      .replace(/[|•\-[\]()_#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const searchWords = cleanTitle.split(' ').slice(0, 7).join(' ');
    const primaryQuery = video.channelName ? `${searchWords} ${video.channelName}` : searchWords;

    const relatedResults = await fetchYouTubeVideos({ query: primaryQuery, limit: 18 });
    if (relatedResults.videos && relatedResults.videos.length > 0) {
      related = relatedResults.videos.filter((v) => v.videoId !== videoId);
    }

    if (related.length < 10 && video.channelName) {
      const channelResults = await fetchYouTubeVideos({ query: video.channelName, limit: 12 });
      const seen = new Set(related.map((v) => v.videoId));
      seen.add(videoId);
      for (const item of channelResults.videos) {
        if (!seen.has(item.videoId)) {
          seen.add(item.videoId);
          related.push(item);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching genuinely related videos:', err);
  }

  if (related.length === 0) {
    related = Array.from(videoMap.values()).filter((v) => v.videoId !== videoId);
  }

  return { video, related: related.slice(0, 16) };
}

// In-memory cache for comments (5 minutes TTL)
const commentsCache = new Map();
const COMMENTS_CACHE_TTL = 5 * 60 * 1000;
let cachedInnertubeKey = null;

function extractCommentsPayload(nextJson) {
  let totalCount = '0';
  let comments = [];
  let nextContinuationToken = null;
  let topSortToken = null;
  let newestSortToken = null;

  for (const ep of nextJson?.onResponseReceivedEndpoints || []) {
    const cmd = ep.reloadContinuationItemsCommand || ep.appendContinuationItemsAction;
    for (const item of cmd?.continuationItems || []) {
      if (item.commentsHeaderRenderer?.countText) {
        totalCount =
          item.commentsHeaderRenderer.countText.runs?.map((r) => r.text).join('') || '0';
      }
      const menu = item.commentsHeaderRenderer?.sortMenu?.sortFilterSubMenuRenderer?.subMenuItems;
      if (menu) {
        topSortToken = menu[0]?.serviceEndpoint?.continuationCommand?.token || null;
        newestSortToken = menu[1]?.serviceEndpoint?.continuationCommand?.token || null;
      }
      const t = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (t) {
        nextContinuationToken = t;
      }
    }
  }

  // Extract comments from mutations
  const mutations = nextJson.frameworkUpdates?.entityBatchUpdate?.mutations || [];
  for (const m of mutations) {
    if (m.payload?.commentEntityPayload) {
      const c = m.payload.commentEntityPayload;
      const author = c.author?.displayName || 'User';
      const avatar = c.author?.avatarThumbnailUrl || '';
      const text = c.properties?.content?.content || '';
      const time = c.properties?.publishedTime || '';
      const likes = c.toolbar?.likeCountNotliked || '0';
      if (text) {
        comments.push({
          id: c.properties?.commentId || Math.random().toString(36).slice(2),
          author,
          avatar,
          text,
          time,
          likes,
          isUserComment: false,
        });
      }
    }
  }

  // Fallback parsing for legacy commentThreadRenderer
  if (comments.length === 0) {
    for (const ep of nextJson?.onResponseReceivedEndpoints || []) {
      const cmd = ep.reloadContinuationItemsCommand || ep.appendContinuationItemsAction;
      for (const item of cmd?.continuationItems || []) {
        const r = item.commentThreadRenderer?.comment?.commentRenderer;
        if (r) {
          comments.push({
            id: r.commentId,
            author: r.authorText?.simpleText || 'User',
            avatar: r.authorThumbnail?.thumbnails?.[0]?.url || '',
            text: r.contentText?.runs?.map((x) => x.text).join('') || '',
            time: r.publishedTimeText?.runs?.[0]?.text || '',
            likes: r.voteCount?.simpleText || '0',
            isUserComment: false,
          });
        }
      }
    }
  }

  return { totalCount, comments, nextContinuationToken, topSortToken, newestSortToken };
}

export async function fetchVideoComments(videoId, { continuation = null, sortBy = 'top' } = {}) {
  if (!videoId) return { totalCount: '0', comments: [], hasMore: false };

  // Cache check for initial requests without continuation
  const cacheKey = `${videoId}_${sortBy}`;
  if (!continuation) {
    const cached = commentsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < COMMENTS_CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    let key = cachedInnertubeKey;
    let targetToken = continuation;

    if (!key || !targetToken) {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) {
        return { totalCount: '0', comments: [], hasMore: false };
      }

      const html = await res.text();
      const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      key = keyMatch ? keyMatch[1] : null;
      if (key) cachedInnertubeKey = key;

      let initialToken = null;
      const initialDataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
      if (initialDataMatch) {
        try {
          const data = JSON.parse(initialDataMatch[1]);
          const sections =
            data?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
          for (const section of sections) {
            if (section.itemSectionRenderer?.targetId === 'comments-section') {
              const contents = section.itemSectionRenderer?.contents || [];
              for (const item of contents) {
                if (
                  item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
                ) {
                  initialToken =
                    item.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
                  break;
                }
              }
            }
          }
        } catch (_) {}
      }

      if (!key || !initialToken) {
        return { totalCount: '0', comments: [], hasMore: false };
      }

      if (!targetToken) {
        targetToken = initialToken;
      }
    }

    const nextRes = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'US',
          },
        },
        continuation: targetToken,
      }),
    });

    if (!nextRes.ok) {
      return { totalCount: '0', comments: [], hasMore: false };
    }

    const nextJson = await nextRes.json();
    let parsed = extractCommentsPayload(nextJson);

    // If initial fetch requested newest comments and newestSortToken is available, fetch newest
    if (!continuation && sortBy === 'newest' && parsed.newestSortToken) {
      const newestRes = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          context: {
            client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' },
          },
          continuation: parsed.newestSortToken,
        }),
      });
      if (newestRes.ok) {
        const newestJson = await newestRes.json();
        const newestParsed = extractCommentsPayload(newestJson);
        newestParsed.totalCount = parsed.totalCount;
        parsed = newestParsed;
      }
    }

    // On initial load, fetch 1 extra continuation batch so ~40 comments display right away
    if (!continuation && parsed.nextContinuationToken) {
      try {
        const batch2Res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: JSON.stringify({
            context: {
              client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' },
            },
            continuation: parsed.nextContinuationToken,
          }),
        });
        if (batch2Res.ok) {
          const batch2Json = await batch2Res.json();
          const batch2Parsed = extractCommentsPayload(batch2Json);
          parsed.comments = [...parsed.comments, ...batch2Parsed.comments];
          parsed.nextContinuationToken =
            batch2Parsed.nextContinuationToken || parsed.nextContinuationToken;
        }
      } catch (_) {}
    }

    const payload = {
      totalCount: parsed.totalCount,
      comments: parsed.comments,
      nextContinuationToken: parsed.nextContinuationToken,
      hasMore: Boolean(parsed.nextContinuationToken),
    };

    if (!continuation) {
      commentsCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    }

    return payload;
  } catch (err) {
    console.error('Error in fetchVideoComments:', err.message);
    return { totalCount: '0', comments: [], hasMore: false };
  }
}
