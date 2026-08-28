import type { Dispatcher } from 'undici';

declare global {
  /**
   * Node の `fetch` は undici 実装のため `dispatcher` を受け取るが、
   * DOM 由来の `RequestInit` にはその定義がないので補う
   */
  interface RequestInit {
    dispatcher?: Dispatcher;
  }
}
