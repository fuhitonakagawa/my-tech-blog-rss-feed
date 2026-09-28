// 初期表示は保存されたテーマを優先し、未指定ならOSの設定に従う。
try {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme === 'light' || storedTheme === 'dark') {
    document.documentElement.dataset.theme = storedTheme;
  }
} catch {}
