/**
 * ui.js
 * Todo lo relacionado con el DOM: renderizado de vistas, tarjetas, fichas,
 * toasts, bottom sheets, modales y estados de la interfaz.
 */

import {
  BASE_POKEMON,
  MILESTONES,
  STAT_INFO,
  STAT_ORDER,
  TOTAL_POKEMON,
  emojiForTypes,
  formatDateTime,
  formatId,
  formatName,
  typeColor,
  typeEmoji,
  typeLabel,
} from './data.js';

const POKEBALL_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffffff"/><path d="M3 12a9 9 0 0 1 18 0z" fill="#e94343"/><path d="M3 12h18" stroke="#20232b" stroke-width="2"/><circle cx="12" cy="12" r="9" fill="none" stroke="#20232b" stroke-width="2"/><circle cx="12" cy="12" r="3.1" fill="#ffffff" stroke="#20232b" stroke-width="2"/></svg>`,
)}`;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const els = {};

let currentSheet = null;
let currentModal = null;

/* =========================================================================
   Utilidades
   ========================================================================= */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function icon(name, className = 'h-4 w-4') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function mainType(pokemon) {
  return pokemon?.types?.[0] || 'normal';
}

function typeChips(types = [], large = false) {
  return types
    .map((type) => {
      const color = typeColor(type);
      return `<span class="type-chip${large ? ' type-chip--lg' : ''}" style="--chip:${color}">${escapeHtml(typeLabel(type))}</span>`;
    })
    .join('');
}

function spriteUrl(pokemon) {
  return pokemon?.sprite || pokemon?.image || '';
}

/** Sprite animado de Pokémon Negro/Blanco, con respaldo del sprite de PokéAPI. */
function spriteAttributes(pokemon) {
  const id = Number(pokemon?.id);
  const animated =
    Number.isFinite(id) && id > 0
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`
      : '';
  const fallback = spriteUrl(pokemon);
  const src = animated || fallback;
  const fallbackAttr =
    fallback && fallback !== src ? ` data-sprite-fallback="${escapeHtml(fallback)}"` : '';
  return `src="${escapeHtml(src)}"${fallbackAttr}`;
}

/* =========================================================================
   Inicialización y eventos globales
   ========================================================================= */

export function initUI(handlers = {}) {
  els.screen = $('#device-screen');
  els.viewRoot = $('#view-root');
  els.fab = $('#fab');
  els.searchInput = $('#search-input');
  els.searchClear = $('#search-clear');
  els.grid = $('#pokedex-grid');
  els.results = $('#pokedex-results');
  els.empty = $('#pokedex-empty');
  els.loading = $('#pokedex-loading');
  els.error = $('#pokedex-error');
  els.errorMessage = $('#pokedex-error-message');
  els.noResults = $('#pokedex-noresults');
  els.noResultsTitle = $('#noresults-title');
  els.noResultsText = $('#noresults-text');
  els.counter = $('#header-counter');
  els.capturedLabel = $('#captured-label');
  els.missingLabel = $('#missing-label');
  els.onlineDot = $('#online-dot');
  els.offlineBanner = $('#offline-banner');
  els.toastRoot = $('#toast-root');
  els.sheetRoot = $('#sheet-root');
  els.modalRoot = $('#modal-root');
  els.views = {
    pokedex: $('#view-pokedex'),
    progress: $('#view-progress'),
    about: $('#view-about'),
  };
  els.navButtons = $$('[data-nav]');
  els.filters = $$('[data-filter]');
  els.filterButtons = els.filters;

  els.progressRing = $('#progress-ring');
  els.progressRingFill = $('#progress-ring-fill');
  els.progressPercent = $('#progress-percent');
  els.progressCount = $('#progress-count');
  els.progressMessage = $('#progress-message');
  els.statCaptured = $('#stat-captured');
  els.statMissing = $('#stat-missing');
  els.statPercent = $('#stat-percent');
  els.progressFraction = $('#progress-fraction');
  els.progressBar = $('#progress-bar');
  els.progressBarFill = $('#progress-bar-fill');
  els.typeBreakdown = $('#type-breakdown');
  els.typeCount = $('#type-count');
  els.milestones = $('#milestones');
  els.recentList = $('#recent-list');

  // Navegación inferior
  els.navButtons.forEach((button) => {
    button.addEventListener('click', () => handlers.onNavigate?.(button.dataset.nav));
  });

  // Acción principal
  els.fab?.addEventListener('click', () => handlers.onScan?.());

  // Acciones con data-action
  document.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const { action } = actionEl.dataset;
    if (action === 'open-scanner') handlers.onScan?.();
    if (action === 'retry') handlers.onRetry?.();
    if (action === 'reset-collection') handlers.onResetRequest?.();
  });

  // Buscador
  els.searchInput?.addEventListener('input', (event) => {
    const value = event.target.value;
    els.searchClear?.classList.toggle('hidden', !value);
    handlers.onSearch?.(value);
  });

  els.searchClear?.addEventListener('click', () => {
    if (els.searchInput) els.searchInput.value = '';
    els.searchClear?.classList.add('hidden');
    handlers.onSearch?.('');
    els.searchInput?.focus();
  });

  // Filtros
  els.filters.forEach((button) => {
    button.addEventListener('click', () => handlers.onFilter?.(button.dataset.filter));
  });

  // Tarjetas de la Pokédex
  els.grid?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-id]');
    if (!card) return;
    handlers.onCardClick?.(Number(card.dataset.id));
  });

  // Últimas capturas
  els.recentList?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-detail-id]');
    if (!item) return;
    handlers.onCardClick?.(Number(item.dataset.detailId));
  });

  // Imágenes rotas: se sustituyen por una Pokéball
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.spriteFallback) {
        const fallback = img.dataset.spriteFallback;
        delete img.dataset.spriteFallback;
        img.src = fallback;
        return;
      }
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      img.src = POKEBALL_PLACEHOLDER;
      img.style.opacity = '0.45';
      img.style.filter = 'grayscale(1)';
    },
    true,
  );

  // Cerrar hojas con Escape
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (currentModal) closeModal();
    else if (currentSheet) closeSheet();
  });
}

/* =========================================================================
   Vistas
   ========================================================================= */

export function showView(name) {
  Object.entries(els.views).forEach(([key, element]) => {
    element?.classList.toggle('hidden', key !== name);
  });

  els.navButtons.forEach((button) => {
    const isActive = button.dataset.nav === name;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (els.viewRoot) els.viewRoot.scrollTop = 0;
  document.title = 'Pokédex PWA - DGB LCHA';
}

export function setOffline(isOffline) {
  els.offlineBanner?.classList.toggle('hidden', !isOffline);
  els.onlineDot?.classList.toggle('is-offline', isOffline);
  if (els.onlineDot) {
    els.onlineDot.title = isOffline ? 'Sin conexión' : 'En línea';
    els.onlineDot.setAttribute('aria-label', isOffline ? 'Sin conexión' : 'En línea');
  }
}

export function renderAll(state) {
  renderPokedex(state);
  renderProgress(state.collection);
}

export function renderPokedex({ collection, filter, query }) {
  const captured = new Map(collection.map((pokemon) => [pokemon.id, pokemon]));
  const trimmedQuery = String(query ?? '').trim().toLowerCase();

  els.counter.textContent = `${collection.length} / ${TOTAL_POKEMON}`;
  els.capturedLabel.textContent = `${collection.length} capturado${collection.length === 1 ? '' : 's'}`;
  els.missingLabel.textContent = `${TOTAL_POKEMON - collection.length} por descubrir`;

  els.loading?.classList.add('hidden');

  // Sincroniza el estado visual de los filtros.
  els.filters.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  let visible = BASE_POKEMON;

  if (filter === 'captured') visible = visible.filter((pokemon) => captured.has(pokemon.id));
  if (filter === 'missing') visible = visible.filter((pokemon) => !captured.has(pokemon.id));

  if (trimmedQuery) {
    visible = visible.filter((pokemon) => {
      const registered = captured.get(pokemon.id);
      return (
        formatId(pokemon.id).toLowerCase().includes(trimmedQuery) ||
        String(pokemon.id) === trimmedQuery ||
        (registered ? formatName(registered.name).toLowerCase().includes(trimmedQuery) : false)
      );
    });
  }

  const isEmptyCollection = collection.length === 0;
  const showEmpty = isEmptyCollection && !trimmedQuery && filter === 'all';
  const showNoResults =
    !showEmpty && visible.length === 0 && (Boolean(trimmedQuery) || filter !== 'all');

  els.empty?.classList.toggle('hidden', !showEmpty);
  els.noResults?.classList.toggle('hidden', !showNoResults);
  els.grid?.classList.toggle('hidden', showEmpty || showNoResults);

  if (showEmpty) {
    els.grid.innerHTML = '';
    els.results.textContent = '';
    return;
  }

  if (showNoResults) {
    if (trimmedQuery) {
      els.noResultsTitle.textContent = 'Sin resultados';
      els.noResultsText.textContent = `No encontramos Pokémon para “${trimmedQuery}”. Prueba con otro nombre o número.`;
    } else if (filter === 'captured') {
      els.noResultsTitle.textContent = 'Aún no hay capturas';
      els.noResultsText.textContent = 'Escanea un código QR para descubrir tu primer Pokémon.';
    } else {
      els.noResultsTitle.textContent = '¡Pokédex completa!';
      els.noResultsText.textContent = 'Ya capturaste a los 151 Pokémon de la primera generación.';
    }
  }

  if (trimmedQuery) {
    els.results.textContent = `${visible.length} resultado${visible.length === 1 ? '' : 's'} para “${trimmedQuery}”`;
  } else if (filter === 'captured') {
    els.results.textContent = `${collection.length} Pokémon capturado${collection.length === 1 ? '' : 's'}`;
  } else if (filter === 'missing') {
    els.results.textContent = `${TOTAL_POKEMON - collection.length} Pokémon por descubrir`;
  } else {
    els.results.textContent = 'Pokédex de la primera generación · #001 – #151';
  }

  els.grid.innerHTML = visible
    .map((base) => {
      const registered = captured.get(base.id);
      return registered ? capturedCard(registered) : lockedCard(base.id);
    })
    .join('');
}

export function showPokedexError(message) {
  els.errorMessage.textContent = message;
  els.error?.classList.remove('hidden');
}

export function hidePokedexError() {
  els.error?.classList.add('hidden');
}

/* =========================================================================
   Tarjetas
   ========================================================================= */

function capturedCard(pokemon) {
  const type = mainType(pokemon);
  const name = formatName(pokemon.name);
  return `
    <button type="button" class="poke-card is-captured" data-id="${pokemon.id}" style="--type-color:${typeColor(type)}" aria-label="Ver la ficha de ${escapeHtml(name)}">
      <span class="card-number">N.º ${String(pokemon.id).padStart(3, '0')}</span>
      <span class="card-arrow" aria-hidden="true">↗</span>
      <span class="sprite-wrap">
        <img class="poke-card__sprite" ${spriteAttributes(pokemon)} alt="${escapeHtml(name)}" loading="lazy" decoding="async" />
      </span>
      <span class="card-info">
        <span class="poke-card__name">${escapeHtml(name)}</span>
        <span class="poke-card__types">${typeChips(pokemon.types)}</span>
      </span>
    </button>
  `;
}

function lockedCard(id) {
  return `
    <button type="button" class="poke-card is-locked" data-id="${id}" aria-label="Pokémon no descubierto, número ${id}">
      <span class="card-number">N.º ${String(id).padStart(3, '0')}</span>
      <span class="poke-card__silhouette" aria-hidden="true">?</span>
      <span class="locked-label">No descubierto</span>
    </button>
  `;
}

/* =========================================================================
   Progreso
   ========================================================================= */

const PROGRESS_MESSAGES = [
  [0, 'Escanea un código QR para comenzar tu colección.'],
  [1, '¡Tu aventura ha comenzado! Cada código QR es un nuevo descubrimiento.'],
  [10, '¡Buen inicio! Cada código QR es un nuevo descubrimiento.'],
  [25, 'Vas por buen camino. ¡Sigue escaneando!'],
  [50, '¡Mitad de la Pokédex! Ya eres todo un entrenador.'],
  [100, '¡Impresionante! Solo queda un tercio del camino.'],
  [150, '¡Casi lo logras! Falta muy poco para completarla.'],
  [151, '¡Felicitaciones! Completaste los 151 Pokémon. 🏆'],
];

function progressMessage(count) {
  let message = PROGRESS_MESSAGES[0][1];
  for (const [threshold, text] of PROGRESS_MESSAGES) {
    if (count >= threshold) message = text;
  }
  return message;
}

export function renderProgress(collection) {
  const count = collection.length;
  const missing = TOTAL_POKEMON - count;
  const percent = (count / TOTAL_POKEMON) * 100;
  const percentLabel = `${percent.toFixed(1)}%`;

  els.progressRingFill?.style.setProperty('stroke-dashoffset', String(100 - percent));
  els.progressPercent.textContent = percentLabel;
  els.progressCount.textContent = String(count);
  els.progressMessage.textContent = progressMessage(count);
  els.statCaptured.textContent = String(count);
  els.statMissing.textContent = String(missing);
  els.statPercent.textContent = percent.toFixed(0) + '%';
  els.progressFraction.textContent = `${count} / ${TOTAL_POKEMON}`;
  els.progressBarFill.style.width = `${percent}%`;
  els.progressBar.setAttribute('aria-valuenow', String(count));

  // Tipos
  const typeCounts = new Map();
  collection.forEach((pokemon) => {
    (pokemon.types ?? []).forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    });
  });

  els.typeCount.textContent = `${typeCounts.size} tipo${typeCounts.size === 1 ? '' : 's'}`;

  if (typeCounts.size === 0) {
    els.typeBreakdown.innerHTML =
      '<p class="text-xs muted-text">Aún no hay tipos registrados.</p>';
  } else {
    const rows = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(...rows.map(([, value]) => value));
    els.typeBreakdown.innerHTML = rows
      .map(([type, value]) => {
        const width = Math.max(8, Math.round((value / max) * 100));
        return `
          <div class="type-row" style="--chip:${typeColor(type)}">
            <span class="type-row__name"><i class="type-row__dot"></i>${escapeHtml(typeLabel(type))}</span>
            <span class="type-row__track"><span class="type-row__bar" style="width:${width}%"></span></span>
            <span class="type-row__count">${value}</span>
          </div>
        `;
      })
      .join('');
  }

  // Hitos
  els.milestones.innerHTML = MILESTONES.map((milestone) => {
    const done = count >= milestone;
    return `
      <div class="milestone ${done ? 'is-done' : ''}">
        <span class="milestone__icon">${icon(done ? 'check' : 'lock', 'h-3 w-3')}</span>
        <span class="milestone__value">${milestone}</span>
      </div>
    `;
  }).join('');

  // Últimas capturas
  const recent = [...collection]
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
    .slice(0, 5);

  if (recent.length === 0) {
    els.recentList.innerHTML =
      '<p class="text-xs muted-text">Todavía no has capturado ningún Pokémon.</p>';
  } else {
    els.recentList.innerHTML = recent
      .map((pokemon) => {
        const type = mainType(pokemon);
        return `
          <button type="button" class="recent-item w-full text-left" data-detail-id="${pokemon.id}" style="--chip:${typeColor(type)}">
            <span class="recent-item__img">
              <img ${spriteAttributes(pokemon)} alt="${escapeHtml(formatName(pokemon.name))}" loading="lazy" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="recent-item__name block truncate">${escapeHtml(formatName(pokemon.name))}</span>
              <span class="recent-item__meta block">${formatId(pokemon.id)} · ${escapeHtml(typeLabel(type))}</span>
            </span>
            <span class="text-[9px] muted-text">${formatDateTime(pokemon.capturedAt)}</span>
            <span class="muted-text">${icon('chevron', 'h-3.5 w-3.5')}</span>
          </button>
        `;
      })
      .join('');
  }
}

/* =========================================================================
   Toasts
   ========================================================================= */

const TOAST_ICONS = {
  success: 'check-circle',
  error: 'alert',
  warning: 'alert',
  info: 'info',
};

export function toast(message, type = 'success', options = {}) {
  if (!els.toastRoot) return null;

  const duration = options.duration ?? 3600;
  while (els.toastRoot.children.length >= 3) {
    els.toastRoot.firstElementChild?.remove();
  }

  const element = document.createElement('div');
  element.className = `toast toast--${type}`;
  element.setAttribute('role', type === 'error' ? 'alert' : 'status');
  element.innerHTML = `
    <span class="toast__icon">${icon(TOAST_ICONS[type] ?? 'info', 'h-4 w-4')}</span>
    <span class="toast__msg">${escapeHtml(message)}</span>
    ${options.action ? `<button type="button" class="toast__action">${escapeHtml(options.action.label)}</button>` : ''}
  `;

  let timer = null;
  const dismiss = () => {
    if (!element.isConnected) return;
    clearTimeout(timer);
    element.classList.remove('is-visible');
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 260);
  };

  options.action?.onClick &&
    element.querySelector('.toast__action')?.addEventListener('click', () => {
      options.action.onClick();
      dismiss();
    });

  els.toastRoot.appendChild(element);
  requestAnimationFrame(() => element.classList.add('is-visible'));

  if (duration > 0) timer = setTimeout(dismiss, duration);

  return { dismiss };
}

/* =========================================================================
   Bottom Sheets
   ========================================================================= */

export function openSheet({
  title,
  subtitle = '',
  body = '',
  variant = 'default',
  onClose = null,
} = {}) {
  if (!els.sheetRoot) return null;
  if (currentSheet) closeSheet({ immediate: true });

  els.sheetRoot.innerHTML = `
    <div class="sheet-backdrop" data-sheet-backdrop></div>
    <div class="sheet-panel${variant === 'full' ? ' sheet-panel--full' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      ${variant === 'full' ? '' : '<div class="sheet-handle"></div>'}
      <div class="sheet-header">
        <div class="min-w-0 flex-1">
          <p class="sheet-title" id="sheet-title">${escapeHtml(title)}</p>
          ${subtitle ? `<p class="sheet-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="sheet-close" data-sheet-close aria-label="Cerrar">${icon('close', 'h-4 w-4')}</button>
      </div>
      <div class="sheet-body">${body}</div>
    </div>
  `;

  els.sheetRoot.classList.remove('hidden');
  els.viewRoot?.classList.add('scroll-locked');

  const panel = $('.sheet-panel', els.sheetRoot);
  const backdrop = $('.sheet-backdrop', els.sheetRoot);
  const close = () => closeSheet();

  backdrop.addEventListener('click', close);
  $('[data-sheet-close]', els.sheetRoot).addEventListener('click', close);

  currentSheet = { root: els.sheetRoot, panel, onClose, close };

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  });

  setTimeout(() => {
    $('.sheet-close', els.sheetRoot)?.focus({ preventScroll: true });
  }, 80);

  return {
    root: els.sheetRoot,
    body: $('.sheet-body', els.sheetRoot),
    panel,
    close,
  };
}

export function closeSheet({ immediate = false } = {}) {
  if (!currentSheet) return;
  const sheet = currentSheet;
  currentSheet = null;

  try {
    sheet.onClose?.();
  } catch (error) {
    console.error('Error al cerrar el panel:', error);
  }

  els.viewRoot?.classList.remove('scroll-locked');
  const backdrop = $('.sheet-backdrop', sheet.root);
  backdrop?.classList.remove('is-open');
  sheet.panel.classList.remove('is-open');

  const cleanup = () => {
    if (currentSheet) return;
    if (sheet.root) {
      sheet.root.innerHTML = '';
      sheet.root.classList.add('hidden');
    }
  };

  if (immediate) cleanup();
  else setTimeout(cleanup, 300);
}

export function isSheetOpen() {
  return Boolean(currentSheet);
}

/* =========================================================================
   Modal de confirmación
   ========================================================================= */

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
}) {
  if (!els.modalRoot) return;

  els.modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <p class="text-[12px] font-bold leading-relaxed accent-text" id="modal-title">${escapeHtml(title)}</p>
      <p class="mt-3 text-xs leading-relaxed ink-text">${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn-ghost" data-modal-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  els.modalRoot.classList.remove('hidden');
  const panel = $('.modal-panel', els.modalRoot);
  const backdrop = $('.modal-backdrop', els.modalRoot);

  currentModal = { root: els.modalRoot, panel };

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  });

  $('[data-modal-cancel]', els.modalRoot).addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  $('[data-modal-confirm]', els.modalRoot).addEventListener('click', () => {
    closeModal();
    onConfirm?.();
  });

  setTimeout(() => $('[data-modal-cancel]', els.modalRoot)?.focus(), 80);
}

export function closeModal() {
  if (!currentModal) return;
  const modal = currentModal;
  currentModal = null;
  $('.modal-backdrop', modal.root)?.classList.remove('is-open');
  modal.panel.classList.remove('is-open');
  setTimeout(() => {
    if (currentModal) return;
    modal.root.innerHTML = '';
    modal.root.classList.add('hidden');
  }, 240);
}

export function isModalOpen() {
  return Boolean(currentModal);
}

/* =========================================================================
   Escáner QR: plantilla y estados
   ========================================================================= */

export function scannerTemplate() {
  return `
    <div class="scanner">
      <div class="scanner__viewport">
        <div id="qr-reader" class="scanner__reader"></div>
        <div class="scan-frame" aria-hidden="true">
          <i class="corner tl"></i>
          <i class="corner tr"></i>
          <i class="corner bl"></i>
          <i class="corner br"></i>
          <span class="scan-line"></span>
        </div>
        <p class="scanner__hint" id="scanner-hint">Iniciando cámara…</p>
        <div id="scanner-overlay" class="scanner-overlay hidden"></div>
      </div>

      <div class="scanner__panel">
        <div class="scanner__actions">
          <button type="button" class="circle-btn" id="scanner-torch" data-scanner-action="torch" aria-label="Encender linterna" hidden>
            ${icon('bolt', 'h-5 w-5')}
          </button>
          <button type="button" class="circle-btn" data-scanner-action="flip" aria-label="Cambiar cámara">
            ${icon('flip', 'h-5 w-5')}
          </button>
        </div>

        <p class="scanner-tips">
          Coloca el código dentro del marco.<br />
          Formato válido: <span class="accent-text">pokemon:25</span>
        </p>
      </div>
    </div>
  `;
}

export function scannerSetHint(root, text) {
  const hint = $('#scanner-hint', root);
  if (hint) {
    hint.textContent = text;
    hint.classList.toggle('hidden', !text);
  }
}

export function scannerSetCameraControls(root, { torch = false, flip = true } = {}) {
  const torchButton = $('#scanner-torch', root);
  if (torchButton) torchButton.hidden = !torch;
  const flipButton = $('[data-scanner-action="flip"]', root);
  if (flipButton) flipButton.disabled = !flip;
}

export function scannerToggleTorchState(root, isOn) {
  const torchButton = $('#scanner-torch', root);
  torchButton?.classList.toggle('is-active', isOn);
  torchButton?.setAttribute('aria-label', isOn ? 'Apagar linterna' : 'Encender linterna');
}

export function scannerShowOverlay(root, html) {
  const overlay = $('#scanner-overlay', root);
  if (!overlay) return;
  overlay.innerHTML = `<div class="scanner-overlay__inner">${html}</div>`;
  overlay.classList.remove('hidden');
}

export function scannerHideOverlay(root) {
  const overlay = $('#scanner-overlay', root);
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

export function scannerLoading(root, message = 'Consultando Pokédex…', detail = 'Buscando información en PokéAPI…') {
  scannerShowOverlay(
    root,
    `
      <div class="spinner"></div>
      <p class="overlay-title">${escapeHtml(message)}</p>
      <p class="overlay-text">${escapeHtml(detail)}</p>
    `,
  );
}

export function scannerError(root, { title, message, retryAction = null, showCamera = true }) {
  const actions = [];
  if (retryAction) {
    actions.push(`<button type="button" class="btn-primary" data-scanner-action="${retryAction}">Reintentar</button>`);
  }
  if (showCamera) {
    actions.push(`<button type="button" class="btn-ghost" data-scanner-action="resume-scan">Volver a la cámara</button>`);
  }

  scannerShowOverlay(
    root,
    `
      <div class="overlay-icon" style="color:#fb7185">${icon('alert', 'h-6 w-6')}</div>
      <p class="overlay-title">${escapeHtml(title)}</p>
      <p class="overlay-text">${escapeHtml(message)}</p>
      <div class="overlay-actions">${actions.join('')}</div>
    `,
  );
}

export function scannerPreview(root, pokemon) {
  const type = mainType(pokemon);
  scannerShowOverlay(
    root,
    `
      <div class="capture-card" style="--type-color:${typeColor(type)}">
        <p class="text-[9px] font-bold uppercase tracking-[0.2em] accent-text">Pokémon detectado</p>
        <img ${spriteAttributes(pokemon)} alt="${escapeHtml(formatName(pokemon.name))}" />
        <p class="capture-card__name">${escapeHtml(formatName(pokemon.name))}</p>
        <p class="capture-card__meta">${formatId(pokemon.id)} · ${escapeHtml(typeLabel(type))}</p>
        <div class="capture-card__types">${typeChips(pokemon.types, true)}</div>
        <div class="capture-meta-grid">
          <div><span>Altura</span><strong>${pokemon.height ?? '—'} m</strong></div>
          <div><span>Peso</span><strong>${pokemon.weight ?? '—'} kg</strong></div>
        </div>
        <div class="capture-actions">
          <button type="button" class="btn-ghost" data-scanner-action="cancel-capture">Cancelar</button>
          <button type="button" class="btn-primary" data-scanner-action="confirm-capture">
            ${icon('check', 'h-4 w-4')}
            Capturar
          </button>
        </div>
      </div>
      <p class="overlay-text">Confirma para registrar a ${escapeHtml(formatName(pokemon.name))} en tu Pokédex.</p>
    `,
  );
}

export function scannerDuplicate(root, pokemon) {
  const type = mainType(pokemon);
  scannerShowOverlay(
    root,
    `
      <div class="overlay-icon" style="color:#fbbf24;--type-color:${typeColor(type)}">
        ${icon('pokeball', 'h-7 w-7')}
      </div>
      <p class="overlay-title">${escapeHtml(formatName(pokemon.name))} ya está registrado</p>
      <p class="overlay-text">
        Este Pokémon ya se encuentra en tu Pokédex. No se agregará dos veces.
        <br /><span class="muted-text">Capturado el ${escapeHtml(formatDateTime(pokemon.capturedAt))}</span>
      </p>
      <div class="overlay-actions">
        <button type="button" class="btn-secondary" data-scanner-action="view-duplicate" data-id="${pokemon.id}">Ver ficha</button>
        <button type="button" class="btn-ghost" data-scanner-action="resume-scan">Seguir escaneando</button>
      </div>
    `,
  );
}

export function scannerFlash(root) {
  const viewport = $('.scanner__viewport', root);
  if (!viewport) return;
  viewport.classList.remove('scan-flash');
  void viewport.offsetWidth;
  viewport.classList.add('scan-flash');
  setTimeout(() => viewport.classList.remove('scan-flash'), 450);
}

/* =========================================================================
   Ficha de detalle
   ========================================================================= */

export function openPokemonDetail(pokemon) {
  const type = mainType(pokemon);
  const statsByName = new Map((pokemon.stats ?? []).map((stat) => [stat.name, stat.value]));
  const stats = STAT_ORDER.filter((name) => statsByName.has(name));

  const statsHtml = stats.length
    ? stats
        .map((name) => {
          const value = statsByName.get(name) ?? 0;
          const width = Math.min(100, Math.round((value / 180) * 100));
          return `
            <div class="stat-row">
              <span class="stat-row__label">${escapeHtml(STAT_INFO[name]?.short ?? name)}</span>
              <span class="stat-row__track"><span class="stat-row__fill" style="width:${width}%"></span></span>
              <span class="stat-row__value">${value}</span>
            </div>
          `;
        })
        .join('')
    : '<p class="text-xs muted-text">Sin estadísticas disponibles.</p>';

  const abilitiesHtml = (pokemon.abilities ?? []).length
    ? pokemon.abilities
        .map((ability) => `<span class="ability-chip">${escapeHtml(formatName(ability))}</span>`)
        .join('')
    : '<span class="text-xs muted-text">Sin habilidades registradas.</span>';

  const body = `
    <div class="detail-hero" style="--type-color:${typeColor(type)}">
      <p class="detail-hero__num">${formatId(pokemon.id)}</p>
      <img class="detail-hero__sprite" ${spriteAttributes(pokemon)} alt="${escapeHtml(formatName(pokemon.name))}" />
      <h2 class="detail-hero__name">${escapeHtml(formatName(pokemon.name))}</h2>
      <div class="detail-hero__types">${typeChips(pokemon.types, true)}</div>
      <div class="detail-facts">
        <div class="detail-fact">
          <span class="detail-fact__label">Altura</span>
          <span class="detail-fact__value">${pokemon.height ?? '—'} m</span>
        </div>
        <div class="detail-fact">
          <span class="detail-fact__label">Peso</span>
          <span class="detail-fact__value">${pokemon.weight ?? '—'} kg</span>
        </div>
        <div class="detail-fact">
          <span class="detail-fact__label">Tipos</span>
          <span class="detail-fact__value">${(pokemon.types ?? []).length}</span>
        </div>
      </div>
    </div>

    ${
      pokemon.flavor
        ? `<div class="detail-section">
             <p class="detail-section__title">${icon('info', 'h-3.5 w-3.5')} Descripción de la Pokédex</p>
             <p class="flavor-text">“${escapeHtml(pokemon.flavor)}”</p>
           </div>`
        : ''
    }

    <div class="detail-section">
      <p class="detail-section__title">${icon('sparkles', 'h-3.5 w-3.5')} Habilidades</p>
      <div class="ability-list">${abilitiesHtml}</div>
    </div>

    <div class="detail-section">
      <p class="detail-section__title">${icon('chart', 'h-3.5 w-3.5')} Estadísticas base</p>
      <div class="stats-list">${statsHtml}</div>
    </div>

    <div class="detail-section">
      <div class="detail-captured">
        ${icon('check-circle', 'h-4 w-4')}
        Capturado el ${escapeHtml(formatDateTime(pokemon.capturedAt))}
      </div>
    </div>

    <div class="detail-footer">
      <button type="button" class="btn-ghost w-full" data-close-detail>Cerrar ficha</button>
    </div>
  `;

  const sheet = openSheet({
    title: 'FICHA POKÉDEX',
    subtitle: `${formatId(pokemon.id)} · ${formatName(pokemon.name)}`,
    body,
  });

  $('[data-close-detail]', sheet.root)?.addEventListener('click', sheet.close);
  return sheet;
}
