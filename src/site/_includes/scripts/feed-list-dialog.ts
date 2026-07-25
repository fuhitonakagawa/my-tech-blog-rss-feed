const elemFeedListDialog = document.getElementById('feed-list-dialog');
const elemFeedListButton = document.querySelector('.ui-feed-list-button');
const elemFeedListPanel = elemFeedListDialog?.querySelector('.ui-feed-list-dialog__panel');
let elemFeedListLastFocused = document.activeElement;

const getFeedListFocusableElements = () => {
  if (!elemFeedListDialog) {
    return [];
  }

  return Array.from(
    elemFeedListDialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  );
};

const closeFeedListDialog = () => {
  if (!elemFeedListDialog || !(elemFeedListButton instanceof HTMLButtonElement)) {
    return;
  }

  elemFeedListDialog.hidden = true;
  document.body.classList.remove('ui-modal-open');
  elemFeedListButton.setAttribute('aria-expanded', 'false');

  if (elemFeedListLastFocused instanceof HTMLElement) {
    elemFeedListLastFocused.focus();
  }
};

const openFeedListDialog = () => {
  if (!elemFeedListDialog || !(elemFeedListButton instanceof HTMLButtonElement)) {
    return;
  }

  elemFeedListLastFocused = document.activeElement;
  elemFeedListDialog.hidden = false;
  document.body.classList.add('ui-modal-open');
  elemFeedListButton.setAttribute('aria-expanded', 'true');

  if (elemFeedListPanel instanceof HTMLElement) {
    elemFeedListPanel.focus();
  }
};

if (elemFeedListDialog && elemFeedListButton) {
  elemFeedListButton.addEventListener('click', openFeedListDialog);

  for (const elemClose of elemFeedListDialog.querySelectorAll('[data-feed-list-dialog-close]')) {
    elemClose.addEventListener('click', closeFeedListDialog);
  }

  elemFeedListDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeFeedListDialog();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const elemFocusable = getFeedListFocusableElements();
    const elemFirst = elemFocusable[0];
    const elemLast = elemFocusable[elemFocusable.length - 1];

    if (!(elemFirst instanceof HTMLElement) || !(elemLast instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === elemFeedListPanel) {
      event.preventDefault();
      elemLast.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === elemFirst) {
      event.preventDefault();
      elemLast.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === elemLast) {
      event.preventDefault();
      elemFirst.focus();
    }
  });
}
