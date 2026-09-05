copy(
  [
    'フィード名\tRSS URL\t投稿先',
    ...$_.map(x => `${x.name}\t${x.url}\t${x.channel}`)
  ].join('\n')
)