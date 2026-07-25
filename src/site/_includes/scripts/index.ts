const elemCopyButtons = document.querySelectorAll('.feed-url-copy-button');
const elemActiveNavLink = document.querySelector('.ui-section-nav__link--active');

elemActiveNavLink?.scrollIntoView({
  block: 'nearest',
  inline: 'center',
});

// biome-ignore lint/complexity/noForEach: This is intentional
elemCopyButtons.forEach((elemCopyButton) => {
  elemCopyButton.addEventListener('click', () => {
    const copyValue = elemCopyButton instanceof HTMLButtonElement ? elemCopyButton.dataset.copyValue : undefined;
    if (!copyValue) {
      throw new Error('コピー対象が見つかりません');
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(copyValue);
    } else {
      const elemTextarea = document.createElement('textarea');
      elemTextarea.value = copyValue;
      document.body.appendChild(elemTextarea);
      elemTextarea.select();
      document.execCommand('copy');
      elemTextarea.remove();
    }

    elemCopyButton.classList.add('active');

    elemCopyButton.innerHTML = 'コピーしました！';
    window.setTimeout(() => {
      elemCopyButton.innerHTML = 'コピー';
      elemCopyButton.classList.remove('active');
    }, 1000);
  });
});
