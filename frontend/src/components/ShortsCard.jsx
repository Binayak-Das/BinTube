import React from 'react';
import { ShortsIcon } from './Icons.jsx';

export default function ShortsCard({
  video,
  onSelectVideo,
}) {
  const vId = video.videoId || video._id;

  return (
    <div
      className="shorts-card"
      onClick={() => onSelectVideo && onSelectVideo(video)}
      title={video.title}
    >
      <div className="shorts-thumb-box">
        <img
          src={video.thumbnailUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`}
          alt={video.title}
          className="shorts-img"
          loading="lazy"
        />
        <div className="shorts-badge">
          <ShortsIcon size={16} />
          <span>Shorts</span>
        </div>

        {/* Bottom Title & Views */}
        <div className="shorts-info">
          <h4 className="shorts-title" title={video.title}>
            {video.title}
          </h4>
          <span className="shorts-views">{video.views}</span>
        </div>
      </div>
    </div>
  );
}
