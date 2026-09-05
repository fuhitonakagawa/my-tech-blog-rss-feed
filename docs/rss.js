(() => {
  const normalize = text =>
    (text ?? '').replace(/\s+/g, ' ').trim();

  const isVisible = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  };

  // #zenn-feed のようなチャンネル名を持つ末端要素を探す
  const channelElements = [...document.querySelectorAll('body *')]
    .filter(element => {
      const text = normalize(element.textContent);

      return (
        element.children.length === 0 &&
        /^#[a-zA-Z0-9_-]+$/.test(text) &&
        isVisible(element)
      );
    });

  const feeds = channelElements
    .map(channelElement => {
      const channel = normalize(channelElement.textContent);
      let container = channelElement.parentElement;

      // チャンネル名とフィード名を含む最小の親要素を探す
      for (let depth = 0; container && depth < 10; depth++) {
        const text = normalize(container.innerText);

        const links = [...container.querySelectorAll('a[href]')]
          .filter(link => {
            const linkText = normalize(link.textContent);

            return (
              linkText &&
              !linkText.startsWith('#') &&
              ![
                '閉じる',
                '無効にする',
                '削除する',
                '設定を編集する'
              ].includes(linkText) &&
              isVisible(link)
            );
          });

        // 一覧の1行程度の大きさに限定
        if (links.length > 0 && text.length < 500) {
          const feedLink = links[0];

          return {
            name: normalize(feedLink.textContent),
            url: feedLink.href,
            channel
          };
        }

        container = container.parentElement;
      }

      return null;
    })
    .filter(Boolean);

  // 重複除去
  const uniqueFeeds = [
    ...new Map(
      feeds.map(feed => [
        `${feed.name}|${feed.channel}|${feed.url}`,
        feed
      ])
    ).values()
  ];

  console.table(uniqueFeeds);

  const tsv = [
    'フィード名\tRSS URL\t投稿先',
    ...uniqueFeeds.map(
      feed => `${feed.name}\t${feed.url}\t${feed.channel}`
    )
  ].join('\n');

  navigator.clipboard.writeText(tsv)
    .then(() => {
      console.log(
        `${uniqueFeeds.length}件をクリップボードにコピーしました`
      );
    })
    .catch(error => {
      console.warn('クリップボードへのコピーに失敗しました', error);
      console.log(tsv);
    });

  return uniqueFeeds;
})();