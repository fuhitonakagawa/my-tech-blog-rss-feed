export interface SlackSource {
  rssUrl: string;
  json: string;
  rssPath: string;
  language?: string;
}

export interface SlackArticle {
  key: string;
  guid: string;
  url: string;
  title: string;
  summary: string;
  image: string | null;
  creator: string | null;
  tags: string[];
  originalPublishedAt: string;
  firstSeenAt: string;
}

export interface SeenArticle {
  guid: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SlackFeedHistory {
  title: string;
  language: string;
  link: string;
  lastIssuedAt: string;
  items: SlackArticle[];
  seen: Record<string, SeenArticle>;
  ambiguousGuids?: Record<string, string>;
}

export interface SlackFeedState {
  schemaVersion: 1;
  updatedAt: string;
  feeds: Record<string, SlackFeedHistory>;
}
