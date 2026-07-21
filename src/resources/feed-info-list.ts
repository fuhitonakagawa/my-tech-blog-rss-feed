type ValidUrl = `${'http' | 'https'}://${string}.${string}`;

type FeedInfoTuple = [label: string, url: ValidUrl];

export interface FeedInfo {
  label: string;
  url: ValidUrl;
  sectionId: string;
}

/**
 * フィードのセクション。セクションごとに専用ページ（/rss/<id>/）と
 * まとめフィード（/rss/<id>/feeds/atom.xml など）を配信する
 */
export interface FeedSection {
  /** URLスラッグ。英小文字・数字・ハイフンのみ */
  id: string;
  /** ナビゲーションや見出しに使う表示名 */
  title: string;
  feedInfoList: FeedInfo[];
}

const SECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const createFeedSection = (id: string, title: string, feedInfoTuples: FeedInfoTuple[]): FeedSection => {
  if (!SECTION_ID_PATTERN.test(id)) {
    throw new Error(`セクションID「${id}」はURLスラッグとして不正です（英小文字・数字・ハイフンのみ）`);
  }

  const feedInfoList: FeedInfo[] = [];

  for (const [label, url] of feedInfoTuples) {
    feedInfoList.push({
      label,
      url,
      sectionId: id,
    });
  }

  return {
    id,
    title,
    feedInfoList,
  };
};

/**
 * セクションごとのフィード情報一覧。
 * ラベル・URLはセクションをまたいで重複するとバリデーションエラーになるので別の値を設定してください
 * （同一フィードを複数セクションに所属させることはできない）
 */
export const FEED_SECTION_LIST: FeedSection[] = [
  createFeedSection('zenn', 'Zenn', [
    // ['フィード名', 'RSS/AtomフィードのURL'],
    ['Zennのトレンド', 'https://zenn.dev/feed'],
  ]),
  createFeedSection('qiita', 'Qiita', [['Qiita - 人気の記事', 'https://qiita.com/popular-items/feed']]),
  createFeedSection('hatena', 'はてブ', [
    ['はてなブックマーク - 人気エントリー - テクノロジー', 'https://b.hatena.ne.jp/hotentry/it.rss'],
  ]),
  createFeedSection('menthas', 'Menthas', [['Menthas #all', 'https://menthas.com/all/rss']]),
  createFeedSection('publickey', 'Publickey', [['Publickey', 'https://www.publickey1.jp/atom.xml']]),
  createFeedSection('infoq', 'InfoQ', [['InfoQ - ニュース', 'https://feed.infoq.com/jp/news/']]),
  createFeedSection('thinkit', 'Think IT', [['Think IT', 'https://thinkit.co.jp/rss.xml']]),
  createFeedSection('itmedia', 'ITmedia', [
    ['ITmedia 総合記事一覧', 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml'],
  ]),
  createFeedSection('techcrunch', 'TechCrunch', [['TechCrunch', 'https://techcrunch.com/feed/']]),
  createFeedSection('hacker-news', 'Hacker News', [
    ['Hacker News - Japanese', 'https://hevinxx.github.io/hn-summary-and-translate/rss-ja.xml'],
  ]),
  createFeedSection('developersio', 'DevelopersIO', [['DevelopersIO', 'http://dev.classmethod.jp/feed/']]),
  createFeedSection('company-tech-blog', '企業テックブログ', [
    ['企業テックブログRSS', 'https://yamadashy.github.io/tech-blog-rss-feed/feeds/rss.xml'],
  ]),
  createFeedSection('ai-news', 'AI情報', [
    ['AI情報RSS', 'https://karaage0703.github.io/tech-blog-rss-feed/feeds/rss.xml'],
  ]),
  createFeedSection('jp-tech-blog', '国内テックブログ', [
    ['メルカリエンジニアリングブログ', 'https://engineering.mercari.com/blog/feed.xml'],
    ['さくらのナレッジ', 'http://knowledge.sakura.ad.jp/feed/'],
    ['インフラエンジニアway - Powered by HEARTBEATS', 'http://heartbeats.jp/hbblog/atom.xml'],
    ['DSAS開発者の部屋', 'http://dsas.blog.klab.org/index.rdf'],
    ['CARTA TECH BLOG', 'http://techlog.voyagegroup.com/rss'],
    ['Google Developers Japan', 'http://feeds.feedburner.com/GoogleJapanDeveloperRelationsBlog?format=xml'],
    ['LINEヤフー Tech Blog', 'https://engineering.linecorp.com/ja/feed/'],
    ['LINEヤフー Tech Blog (旧Yahoo! JAPAN)', 'http://techblog.yahoo.co.jp/atom.xml'],
    ['DeNA Engineering', 'https://engineer.dena.com/index.xml'],
    ['GREE Engineering', 'http://labs.gree.jp/blog/feed/'],
    ['CyberAgent Developers Blog', 'https://developers.cyberagent.co.jp/blog/feed/'],
    ['クックパッド開発者ブログ', 'http://techlife.cookpad.com/rss'],
    ['Hatena Developer Blog', 'http://developer.hatenastaff.com/rss'],
    ['MIXI DEVELOPERS', 'https://medium.com/feed/mixi-developers'],
    ["FLINTERS Engineer's Blog", 'http://labs.septeni.co.jp/rss'],
    ['Nulab (Japanese)', 'http://nulab-inc.com/ja/feed/'],
    ['GMO Developers', 'https://developers.gmo.jp/feed/'],
    ['TECHSCORE BLOG', 'http://www.techscore.com/blog/feed/'],
    ['Wantedly Engineer Blog', 'http://engineer.wantedly.com/feed'],
  ]),
  createFeedSection('ai', 'AI', [
    ['OpenAI News', 'https://openai.com/news/rss.xml'],
    ['The latest research from Google', 'https://research.google/blog/rss/'],
    ['Google AI Blog', 'https://blog.google/technology/ai/rss/'],
    ['Google DeepMind News', 'https://deepmind.google/blog/rss.xml'],
    ['Engineering at Meta', 'https://engineering.fb.com/feed/'],
    ['Microsoft Research', 'https://www.microsoft.com/en-us/research/feed/'],
    ['Apple Machine Learning Research', 'https://machinelearning.apple.com/rss.xml'],
    ['NVIDIA Technical Blog', 'https://developer.nvidia.com/blog/feed/'],
    ['Hugging Face - Blog', 'https://huggingface.co/blog/feed.xml'],
    ['The Berkeley Artificial Intelligence Research Blog', 'https://bair.berkeley.edu/blog/feed.xml'],
  ]),
  createFeedSection('engineering', 'Engineering', [
    ['Netflix TechBlog', 'https://netflixtechblog.com/feed'],
    ["The latest from GitHub's engineering team - The GitHub Blog", 'https://github.blog/engineering/feed/'],
    ['Airbnb Engineering & Data Science', 'https://airbnb.tech/feed/'],
    ['Engineering at Slack', 'https://slack.engineering/feed/'],
    ['The Cloudflare Blog', 'https://blog.cloudflare.com/rss/'],
    ['Spotify Engineering', 'https://engineering.atspotify.com/feed/'],
    ['Dropbox Tech Blog', 'https://dropbox.tech/feed'],
    ['Pinterest Engineering Blog', 'https://medium.com/feed/pinterest-engineering'],
    ['Stripe Blog', 'https://stripe.com/blog/feed.rss'],
    ['Discord Blog', 'https://discord.com/blog/rss.xml'],
    ['Etsy Engineering | Code as Craft', 'https://www.etsy.com/codeascraft/rss'],
    ['tech-at-instacart', 'https://tech.instacart.com/feed'],
    ['RedditEng', 'https://www.reddit.com/r/RedditEng/.rss'],
    ['Salesforce Engineering Blog', 'https://engineering.salesforce.com/feed/'],
    ['Inside Atlassian', 'https://www.atlassian.com/engineering/feed'],
    ['Yelp Engineering and Product Blog', 'https://engineeringblog.yelp.com/feed.xml'],
  ]),
  createFeedSection('platform', 'Platform', [
    ['Kubernetes Blog', 'https://kubernetes.io/feed.xml'],
    ['Docker', 'https://www.docker.com/blog/feed/'],
    ['GitLab', 'https://about.gitlab.com/atom.xml'],
    ['Vercel News', 'https://vercel.com/atom'],
    ['developer.chrome.com: Blog', 'https://developer.chrome.com/static/blog/feed.xml'],
    ['Mozilla Hacks – the Web developer blog', 'https://hacks.mozilla.org/feed/'],
    ['WebKit', 'https://webkit.org/feed/'],
    ['Latest News - Apple Developer', 'https://developer.apple.com/news/rss/news.rss'],
    ['The TensorFlow Blog', 'https://blog.tensorflow.org/feeds/posts/default?alt=rss'],
    ['Release notes from pytorch', 'https://github.com/pytorch/pytorch/releases.atom'],
    ['Datadog | Engineering blog', 'https://www.datadoghq.com/blog/engineering/index.xml'],
    ['Grafana Labs blog on Grafana Labs', 'https://grafana.com/blog/index.xml'],
    ['Elastic Blog - Elasticsearch, Kibana, and ELK Stack', 'https://www.elastic.co/blog/feed'],
    ['HashiCorp Blog', 'https://www.hashicorp.com/blog/feed.xml'],
    ['Blog RSS Feed | Snyk', 'https://snyk.io/blog/feed/'],
  ]),
  createFeedSection('programming', 'Programming', [
    ['Node.js Blog', 'https://nodejs.org/en/feed/blog.xml'],
    ['React Blog', 'https://react.dev/rss.xml'],
    ['Python Insider', 'https://blog.python.org/rss.xml'],
    ['Rust Blog', 'https://blog.rust-lang.org/feed.xml'],
    ['The Go Blog', 'https://go.dev/blog/feed.atom'],
  ]),
  createFeedSection('db', 'Database', [
    ['MongoDB | Blog', 'https://www.mongodb.com/blog/rss'],
    ['PostgreSQL news', 'https://www.postgresql.org/news.rss'],
    ['mysql', 'https://blogs.oracle.com/mysql/rss'],
    ['Blog — Neon Docs', 'https://neon.com/blog/rss.xml'],
    ['Changelog — Neon Docs', 'https://neon.com/docs/changelog/rss.xml'],
    ['Supabase Blog', 'https://supabase.com/rss.xml'],
    ['Redis Blog', 'https://redis.io/blog/feed/'],
    ['ClickHouse Blog', 'https://clickhouse.com/rss.xml'],
    ['DuckDB', 'https://www.duckdb.org/feed.xml'],
    ['Databricks', 'https://www.databricks.com/feed'],
    ['Qdrant - Vector Search Engine', 'https://qdrant.tech/index.xml'],
    ['Qdrant Articles on Qdrant - Vector Search Engine', 'https://qdrant.tech/articles/index.xml'],
    ['Weaviate Blog', 'https://weaviate.io/blog/rss.xml'],
    ['Release notes from milvus', 'https://github.com/milvus-io/milvus/releases.atom'],
  ]),
  createFeedSection('aws', 'AWS', [
    ['AWS Architecture Blog', 'https://aws.amazon.com/blogs/architecture/feed'],
    ['Amazon Web Services ブログ', 'https://aws.amazon.com/jp/blogs/news/feed/'],
    ['AWS News Blog', 'https://aws.amazon.com/blogs/aws/feed/'],
    ['Artificial Intelligence', 'https://aws.amazon.com/blogs/machine-learning/feed/'],
    ['AWS Big Data Blog', 'https://aws.amazon.com/blogs/big-data/feed/'],
    ['Containers', 'https://aws.amazon.com/blogs/containers/feed/'],
    ['AWS Security Blog', 'https://aws.amazon.com/blogs/security/feed/'],
    ['AWS Database Blog', 'https://aws.amazon.com/blogs/database/feed/'],
    ['Networking & Content Delivery', 'https://aws.amazon.com/blogs/networking-and-content-delivery/feed/'],
    ['AWS DevOps & Developer Productivity Blog', 'https://aws.amazon.com/blogs/devops/feed/'],
    ['AWS Compute Blog', 'https://aws.amazon.com/blogs/compute/feed/'],
    ['AWS Cloud Operations Blog', 'https://aws.amazon.com/blogs/mt/feed/'],
    ['AWS Insights', 'https://aws.amazon.com/blogs/aws-insights/feed/'],
    ['AWS Executive in Residence Blog', 'https://aws.amazon.com/blogs/enterprise-strategy/feed/'],
    ['AWS Cloud Financial Management', 'https://aws.amazon.com/blogs/aws-cloud-financial-management/feed/'],
    ['AWS Storage Blog', 'https://aws.amazon.com/blogs/storage/feed/'],
    ['AWS HPC Blog', 'https://aws.amazon.com/blogs/hpc/feed/'],
    ['AWS Developer Tools Blog', 'https://aws.amazon.com/blogs/developer/feed/'],
    ['Front-End Web & Mobile', 'https://aws.amazon.com/blogs/mobile/feed/'],
    ['Integration & Automation', 'https://aws.amazon.com/blogs/infrastructure-and-automation/feed/'],
    ['AWS Messaging Blog', 'https://aws.amazon.com/blogs/messaging-and-targeting/feed/'],
    ['Desktop and Application Streaming', 'https://aws.amazon.com/blogs/desktop-and-application-streaming/feed/'],
    ['AWS Contact Center', 'https://aws.amazon.com/blogs/contact-center/feed/'],
    ['AWS Open Source Blog', 'https://aws.amazon.com/blogs/opensource/feed/'],
    ['.NET on AWS Blog', 'https://aws.amazon.com/blogs/dotnet/feed/'],
    ['IBM & Red Hat on AWS', 'https://aws.amazon.com/blogs/ibm-redhat/feed/'],
    ['AWS Business Intelligence Blog', 'https://aws.amazon.com/blogs/business-intelligence/feed/'],
    ['Business Productivity', 'https://aws.amazon.com/blogs/business-productivity/feed/'],
    ['The Internet of Things on AWS – Official Blog', 'https://aws.amazon.com/blogs/iot/feed/'],
    ['AWS Robotics Blog', 'https://aws.amazon.com/blogs/robotics/feed/'],
    ['AWS Quantum Technologies Blog', 'https://aws.amazon.com/blogs/quantum-computing/feed/'],
    ['AWS Physical AI Blog', 'https://aws.amazon.com/blogs/spatial/feed/'],
    ['Migration & Modernization', 'https://aws.amazon.com/blogs/migration-and-modernization/feed/'],
    ['Microsoft Workloads on AWS', 'https://aws.amazon.com/blogs/modernizing-with-aws/feed/'],
    ['AWS for SAP', 'https://aws.amazon.com/blogs/awsforsap/feed/'],
    ['AWS Partner Network (APN) Blog', 'https://aws.amazon.com/blogs/apn/feed/'],
    ['AWS Marketplace', 'https://aws.amazon.com/blogs/awsmarketplace/feed/'],
    ['AWS Smart Business Blog', 'https://aws.amazon.com/blogs/smb/feed/'],
    ['AWS for Industries', 'https://aws.amazon.com/blogs/industries/feed/'],
    ['AWS Public Sector Blog', 'https://aws.amazon.com/blogs/publicsector/feed/'],
    ['AWS Startups Blog', 'https://aws.amazon.com/blogs/startups/feed/'],
    ['Amazon Supply Chain and Logistics', 'https://aws.amazon.com/blogs/supply-chain/feed/'],
    ['AWS for Games Blog', 'https://aws.amazon.com/blogs/gametech/feed/'],
    ['AWS for M&E Blog', 'https://aws.amazon.com/blogs/media/feed/'],
    ['AWS Training and Certification Blog', 'https://aws.amazon.com/blogs/training-and-certification/feed/'],
  ]),
  createFeedSection('google-cloud', 'Google Cloud', [
    ['Google Cloud', 'https://cloudblog.withgoogle.com/products/gcp/rss'],
  ]),
  createFeedSection('azure', 'Azure', [
    ['Azure service updates', 'https://www.microsoft.com/releasecommunications/api/v2/azure/rss'],
    ['Microsoft Azure Blog', 'https://azure.microsoft.com/en-us/blog/feed/'],
    ['Microsoft for Developers', 'https://devblogs.microsoft.com/feed/'],
  ]),
  createFeedSection('security', 'セキュリティ', [
    ['IPAセキュリティセンター:重要なセキュリティ情報', 'https://www.ipa.go.jp/security/rss/alert.rdf'],
    ['JPCERT/CC RSS Feed', 'https://www.jpcert.or.jp/rss/jpcert.rdf'],
    ['piyolog', 'https://piyolog.hatenadiary.jp/rss'],
    ['セキュリティのアレ', 'https://www.tsujileaks.com/?feed=podcast'],
    ['徳丸浩の日記', 'https://blog.tokumaru.org/feeds/posts/default'],
    ['サイバーセキュリティ・情報漏洩ニュース – サイバーセキュリティ.com', 'https://cybersecurity-jp.com/news/feed'],
    ['Security NEXT', 'https://www.security-next.com/feed'],
    ['AI Security Daily Digest', 'https://futabato.github.io/rss/feed.xml'],
    ['JVNRSS Feed - Update Entry', 'https://jvn.jp/rss/jvn.rdf'],
    ['JVNDB RSS Feed - New Entry', 'https://jvndb.jvn.jp/ja/rss/jvndb_new.rdf'],
    ['ITmedia NEWS セキュリティ 最新記事一覧', 'https://rss.itmedia.co.jp/rss/2.0/news_security.xml'],
    ['ITmedia エンタープライズ「セキュリティ」 最新記事一覧', 'https://rss.itmedia.co.jp/rss/2.0/ep_snews.xml'],
    ['セキュリティ － TechTargetジャパン 最新記事一覧', 'https://rss.itmedia.co.jp/rss/2.0/tt_security.xml'],
    ['＠IT Security&Trustフォーラム 最新記事一覧', 'https://rss.itmedia.co.jp/rss/2.0/ait_security.xml'],
    ['ScanNetSecurity', 'https://scan.netsecurity.ne.jp/rss/index.rdf'],
    ['The latest security news for developers - The GitHub Blog', 'https://github.blog/security/feed/'],
    ['Microsoft Security Blog', 'https://www.microsoft.com/en-us/security/blog/feed/'],
    ['The Trail of Bits Blog', 'https://blog.trailofbits.com/feed/'],
  ]),
  createFeedSection('security-advisory', 'Security Advisory', [
    ['Security Advisory for JavaScript packages hosted at npmjs.com', 'https://azu.github.io/github-advisory-database-rss/npm.rss'],
    ['Security Advisory for Github Actions', 'https://azu.github.io/github-advisory-database-rss/actions.rss'],
    ['Security Advisory for Python packages hosted at PyPI.org', 'https://azu.github.io/github-advisory-database-rss/pip.rss'],
  ]),
  createFeedSection('speakerdeck', 'Speaker Deck', [
    ['Business - Speaker Deck', 'https://speakerdeck.com/c/business.atom'],
    ['Design - Speaker Deck', 'https://speakerdeck.com/c/design.atom'],
    ['Education - Speaker Deck', 'https://speakerdeck.com/c/education.atom'],
    ['How-to & DIY - Speaker Deck', 'https://speakerdeck.com/c/how-to-diy.atom'],
    ['Marketing & SEO - Speaker Deck', 'https://speakerdeck.com/c/marketing-and-seo.atom'],
    ['Programming - Speaker Deck', 'https://speakerdeck.com/c/programming.atom'],
    ['Research - Speaker Deck', 'https://speakerdeck.com/c/research.atom'],
    ['Science - Speaker Deck', 'https://speakerdeck.com/c/science.atom'],
    ['Storyboards - Speaker Deck', 'https://speakerdeck.com/c/storyboards.atom'],
    ['Technology - Speaker Deck', 'https://speakerdeck.com/c/technology.atom'],
    ['Featured Decks - Speaker Deck', 'https://speakerdeck.com/p/featured.atom'],
  ]),
  createFeedSection('tech-book', '技術書', [
    ["O'Reilly Japan - New & Upcomming", 'https://www.oreilly.co.jp/catalog/soon.xml'],
    ['gihyo.jp：新刊書籍情報', 'https://gihyo.jp/book/feed/rss2'],
  ]),
];

/** 全セクションを横断したフィード情報一覧 */
export const FEED_INFO_LIST: FeedInfo[] = FEED_SECTION_LIST.flatMap((section) => section.feedInfoList);
