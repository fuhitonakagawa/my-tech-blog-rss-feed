import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { themeInitScript, themeToggleScript } from '../src/site/_includes/components/scripts';

/** 保存設定・OS設定・保存失敗を持つブラウザー境界を作る。 */
const createBrowser = (stored: string | null, dark: boolean, blocked = false) => {
  const dataset: Record<string, string> = {};
  const attributes = new Map<string, string>();
  const button = Object.assign(new EventTarget(), {
    setAttribute: (key: string, value: string): void => {
      attributes.set(key, value);
    },
  });
  const media = Object.assign(new EventTarget(), { matches: dark });
  let preference = stored;
  const context = {
    document: { documentElement: { dataset }, querySelector: () => button },
    window: { matchMedia: () => media },
    localStorage: {
      getItem: (): string | null => {
        if (blocked) throw new Error('保存領域を使用できません');
        return preference;
      },
      setItem: (_key: string, value: string): void => {
        if (blocked) throw new Error('保存領域を使用できません');
        preference = value;
      },
    },
  };
  runInNewContext(`${themeInitScript}\n${themeToggleScript}`, context);
  return { dataset, attributes, button, media, preference: () => preference };
};

describe('テーマ選択', () => {
  it.each(['dark', 'light'])('保存した%sをOSより優先する', (theme) => {
    const browser = createBrowser(theme, theme !== 'dark');
    expect(browser.dataset.theme).toBe(theme);
    expect(browser.attributes.get('aria-pressed')).toBe(String(theme === 'dark'));
  });
  it('OSと同じテーマへ戻すと、その後のOS変更に追従する', () => {
    const browser = createBrowser(null, true);
    expect(browser.attributes.get('aria-pressed')).toBe('true');
    browser.button.dispatchEvent(new Event('click'));
    expect(browser.preference()).toBe('light');
    expect(browser.attributes.get('aria-pressed')).toBe('false');
    browser.button.dispatchEvent(new Event('click'));
    expect(browser.preference()).toBe('auto');
    expect(browser.dataset.theme).toBeUndefined();
    browser.media.matches = false;
    browser.media.dispatchEvent(new Event('change'));
    expect(browser.attributes.get('aria-pressed')).toBe('false');
  });
  it('明示的な選択中はOSが変わってもテーマを保つ', () => {
    const browser = createBrowser('dark', false);
    browser.media.dispatchEvent(new Event('change'));
    expect(browser.attributes.get('aria-pressed')).toBe('true');
  });
  it('保存領域を使えなくても切替できる', () => {
    const browser = createBrowser(null, false, true);
    browser.button.dispatchEvent(new Event('click'));
    expect(browser.dataset.theme).toBe('dark');
    expect(browser.attributes.get('aria-pressed')).toBe('true');
  });
  it('不正な保存値はOS設定に従う', () => {
    const browser = createBrowser('invalid', true);
    expect(browser.dataset.theme).toBeUndefined();
    expect(browser.attributes.get('aria-pressed')).toBe('true');
  });
});
