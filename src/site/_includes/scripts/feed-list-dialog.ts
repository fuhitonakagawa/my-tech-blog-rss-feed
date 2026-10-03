const elemFeedListDialog = document.getElementById('feed-list-dialog');
const elemFeedListButton = document.querySelector('.ui-feed-list-button');

if (elemFeedListDialog instanceof HTMLDialogElement && elemFeedListButton instanceof HTMLButtonElement) {
  elemFeedListButton.addEventListener('click', () => {
    elemFeedListDialog.showModal();
    document.body.classList.add('ui-modal-open');
    elemFeedListButton.setAttribute('aria-expanded', 'true');
  });

  elemFeedListDialog.querySelector('.ui-feed-list-dialog__close')?.addEventListener('click', () => {
    elemFeedListDialog.close();
  });

  elemFeedListDialog.addEventListener('click', (event) => {
    if (event.target !== elemFeedListDialog) return;
    const rect = elemFeedListDialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      elemFeedListDialog.close();
    }
  });

  elemFeedListDialog.addEventListener('close', () => {
    document.body.classList.remove('ui-modal-open');
    elemFeedListButton.setAttribute('aria-expanded', 'false');
    elemFeedListButton.focus();
  });
}
