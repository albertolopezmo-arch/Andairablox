export const STORE_ITEMS = [
  { id: 'video-bloopers', kind: 'video', title: 'Tomas falsas de LQSA', description: 'Desbloquea este vídeo y vuelve a verlo cuando quieras.', price: 300, accent: 'yellow' }
];

function createNode(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export async function mountStore(container, { getOwned, buyItem, balance, onPurchased = () => {}, openVideo = () => {} }) {
  container.replaceChildren();
  let status = createNode('p', 'Cargando tus compras…', 'store-status');
  status.setAttribute('role', 'status');
  container.append(status);
  let owned;
  try {
    owned = new Set(await getOwned());
  } catch (error) {
    status.textContent = error.message || 'No se pudo cargar la tienda. Comprueba la conexión y el SQL de la Tienda.';
    return;
  }

  container.replaceChildren();
  const intro = createNode('section', undefined, 'store-intro');
  const balanceLabel = createNode('strong', `${new Intl.NumberFormat('es-ES').format(balance())} monedas`, 'store-balance');
  status = createNode('p', 'Canjea el vídeo con monedas. Una vez desbloqueado, podrás verlo cuando quieras.', 'store-status');
  status.setAttribute('role', 'status');
  intro.append(balanceLabel, status);

  const grid = createNode('div', undefined, 'store-grid');
  const item = STORE_ITEMS[0];
  const draw = () => {
    grid.replaceChildren();
    const card = createNode('article', undefined, 'store-card store-video-card');
    card.dataset.itemId = item.id;
    const art = createNode('div', undefined, 'store-art store-art-video');
    art.setAttribute('aria-hidden', 'true');
    art.append(createNode('span', '▶', 'store-video-play'), createNode('small', 'VÍDEO EXCLUSIVO', 'store-art-label'));
    const body = createNode('div', undefined, 'store-card-body');
    body.append(createNode('h2', item.title), createNode('p', item.description));
    if (owned.has(item.id)) {
      const view = createNode('button', '▶ VER VÍDEO', 'daily-next store-buy');
      view.type = 'button';
      view.addEventListener('click', openVideo);
      body.append(view);
    } else {
      const buy = createNode('button', `CANJEAR · ${item.price} MONEDAS`, 'daily-next store-buy');
      buy.type = 'button';
      buy.addEventListener('click', async () => {
        buy.disabled = true;
        buy.textContent = 'PROCESANDO…';
        try {
          await buyItem(item.id);
          owned.add(item.id);
          draw();
          status.textContent = 'Vídeo desbloqueado. Ya puedes verlo cuando quieras.';
          try {
            await onPurchased();
            balanceLabel.textContent = `${new Intl.NumberFormat('es-ES').format(balance())} monedas`;
          } catch {
            status.textContent = 'Canje guardado. El saldo puede tardar un momento en actualizarse.';
          }
        } catch (error) {
          status.textContent = error.message || 'No se pudo completar el canje.';
          buy.disabled = false;
          buy.textContent = `CANJEAR · ${item.price} MONEDAS`;
        }
      });
      body.append(buy);
    }
    card.append(art, body);
    grid.append(card);
  };
  intro.append(createNode('p', 'El acceso queda guardado en tu cuenta y no tendrás que volver a pagar.', 'store-note'));
  container.append(intro, grid);
  draw();
}
