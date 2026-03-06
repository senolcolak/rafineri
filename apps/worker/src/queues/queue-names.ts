// Queue names (cannot contain ':')
export const QUEUE_NAMES = {
  HN_INGEST: 'hn-ingest',
  REDDIT_INGEST: 'reddit-ingest',
  STORY_CLUSTER: 'story-cluster',
  STORY_SCORE: 'story-score',
  STORY_THUMBNAIL: 'story-thumbnail',
  THUMBNAIL_REFRESH: 'thumbnail-refresh',
  APPROVAL: 'approval',
} as const;
