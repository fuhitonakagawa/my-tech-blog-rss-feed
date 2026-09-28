// テーマの切替とOS設定への追従を制御する。
const themeToggleButton = document.querySelector('.ui-theme-toggle');

if (themeToggleButton) {
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const isDarkTheme = () => {
    const explicitTheme = document.documentElement.dataset.theme;
    if (explicitTheme === 'dark' || explicitTheme === 'light') {
      return explicitTheme === 'dark';
    }
    return darkMediaQuery.matches;
  };

  const syncPressedState = () => {
    themeToggleButton.setAttribute('aria-pressed', String(isDarkTheme()));
  };

  syncPressedState();

  themeToggleButton.addEventListener('click', () => {
    const nextTheme = isDarkTheme() ? 'light' : 'dark';
    const systemTheme = darkMediaQuery.matches ? 'dark' : 'light';
    const storedTheme = nextTheme === systemTheme ? 'auto' : nextTheme;
    if (storedTheme === 'auto') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = storedTheme;
    }
    try {
      localStorage.setItem('theme', storedTheme);
    } catch {}
    syncPressedState();
  });

  darkMediaQuery.addEventListener('change', syncPressedState);
}
