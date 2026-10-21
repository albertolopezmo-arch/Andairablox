const VIDEO_ID = 'hZwudljbhas';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function mountBloopers(container) {
  container.replaceChildren();
  const player = node('section', undefined, 'bloopers-player');
  const frame = node('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?playsinline=1&rel=0`;
  frame.title = 'Tomas falsas de La que se avecina';
  frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('loading', 'eager');
  player.append(frame);
  const note = node('p', 'Si el vídeo no se reproduce aquí, puedes abrirlo directamente en YouTube.', 'bloopers-note');
  const external = node('a', 'ABRIR EN YOUTUBE ↗', 'daily-next bloopers-external');
  external.href = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  external.addEventListener('click', event => {
    if (!window.QuizRewardAds?.postMessage) return;
    event.preventDefault();
    window.QuizRewardAds.postMessage(JSON.stringify({ id: `youtube-${Date.now()}`, action: 'open-url', url: external.href }));
  });
  container.append(player, note, external);
}
