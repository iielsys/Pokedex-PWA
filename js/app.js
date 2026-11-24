/**
 * app.js
 * Orquestador de la Pokédex: conecta la interfaz, el escáner, PokéAPI,
 * localStorage y la PWA. La lógica está dividida en funciones pequeñas para
 * que el flujo sea fácil de seguir:
 *
 *   leerQR() -> validarQR() -> buscarPokemon() -> confirmarCaptura()
 *            -> guardarPokemon() -> renderizarPokedex() -> mostrarToast()
 */

import {
  formatName,
  emojiForTypes,
  TOTAL_POKEMON,
} from './data.js';
import * as storage from './storage.js';
import { apiErrorMessage, getPokemon } from './api.js';
import {
  QrScanner,
  parsePokemonQr,
  qrErrorMessage,
  scannerErrorMessage,
} from './qr.js';
import * as ui from './ui.js';

const state = {
  collection: [],
  filter: 'all',
  query: '',
  view: 'pokedex',
  sheet: null,
  scanner: null,
  scanBusy: false,
  pending: null,
  pendingId: null,
};

let installPrompt = null;
let installToastShown = false;
let updating = false;
let lastDecoded = { text: '', time: 0 };

/* =========================================================================
   Arranque
   ========================================================================= */

function init() {
  state.collection = storage.loadCollection();

  ui.initUI({
    onNavigate: navigate,
    onScan: openScanner,
    onCardClick: handleCardClick,
    onSearch: handleSearch,
    onFilter: handleFilter,
    onResetRequest: requestReset,
    onRetry: handleRetry,
  });

  ui.renderAll(state);
  ui.showView('pokedex');
  ui.setOffline(!navigator.onLine);

  window.addEventListener('online', () => {
    ui.setOffline(false);
    ui.toast('Conexión restablecida. ¡Ya puedes descubrir Pokémon!', 'success');
  });

  window.addEventListener('offline', () => {
    ui.setOffline(true);
    ui.toast('Sin conexión. Tu colección sigue disponible.', 'warning');
  });

  // Sincroniza la colección si se modifica en otra pestaña.
  window.addEventListener('storage', (event) => {
    if (event.key === storage.STORAGE_KEY) {
      state.collection = storage.loadCollection();
      ui.renderAll(state);
    }
  });

  bindInstallPrompt();
  registerServiceWorker();

  // Atajo del manifest: ./index.html?scan=1 abre el escáner directamente.
  if (new URLSearchParams(window.location.search).get('scan') === '1') {
    setTimeout(() => void openScanner(), 500);
  }
}

/* =========================================================================
   Navegación y renderizado
   ========================================================================= */

function navigate(view) {
  if (!['pokedex', 'progress', 'about'].includes(view)) return;
  state.view = view;
  if (ui.isSheetOpen()) ui.closeSheet();
  ui.showView(view);
  if (view === 'progress') ui.renderProgress(state.collection);
}

function handleSearch(query) {
  state.query = query;
  ui.renderPokedex(state);
}

function handleFilter(filter) {
  if (!['all', 'captured', 'missing'].includes(filter)) return;
  state.filter = filter;
  ui.renderPokedex(state);
}

function handleRetry() {
  ui.hidePokedexError();
  ui.renderAll(state);
  ui.toast('Pokédex actualizada.', 'info');
}

function handleCardClick(id) {
  const pokemon = state.collection.find((item) => item.id === id);
  if (!pokemon) {
    ui.toast('Este Pokémon aún no ha sido descubierto. Escanea su código QR.', 'info');
    return;
  }
  ui.openPokemonDetail(pokemon);
}

function requestReset() {
  if (state.collection.length === 0) {
    ui.toast('Tu Pokédex ya está vacía.', 'info');
    return;
  }

  ui.confirmDialog({
    title: '¿REINICIAR COLECCIÓN?',
    message: `Se borrarán los ${state.collection.length} Pokémon guardados en este dispositivo. Esta acción no se puede deshacer.`,
    confirmLabel: 'Borrar todo',
    cancelLabel: 'Conservar',
    danger: true,
    onConfirm: () => {
      try {
        state.collection = storage.resetCollection();
        ui.renderAll(state);
        ui.toast('Colección reiniciada. Tu Pokédex está vacía.', 'info');
      } catch (error) {
        console.error(error);
        ui.toast('No fue posible borrar la colección.', 'error');
      }
    },
  });
}

/* =========================================================================
   Escáner
   ========================================================================= */

async function openScanner() {
  state.scanBusy = false;
  state.pending = null;
  state.pendingId = null;

  const sheet = ui.openSheet({
    title: 'ESCÁNER QR',
    subtitle: 'Apunta al código del Pokémon',
    variant: 'full',
    body: ui.scannerTemplate(),
    onClose: cleanupScanner,
  });

  if (!sheet) return;

  state.sheet = sheet;
  wireScanner(sheet);
  await startCamera(sheet);
}

function cleanupScanner() {
  const scanner = state.scanner;
  state.scanner = null;
  state.sheet = null;
  state.pending = null;
  state.scanBusy = false;
  if (scanner) void scanner.stop();
}

function scannerRoot() {
  return state.sheet?.root ?? null;
}

function wireScanner(sheet) {
  const root = sheet.root;

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-scanner-action]');
    if (!target) return;
    const { scannerAction } = target.dataset;

    switch (scannerAction) {
      case 'torch':
        void toggleTorch(root);
        break;
      case 'flip':
        void flipCamera(root);
        break;
      case 'confirm-capture':
        confirmCapture();
        break;
      case 'cancel-capture':
        resumeScanning(root);
        break;
      case 'resume-scan':
        resumeScanning(root);
        break;
      case 'retry-camera':
        void startCamera(sheet);
        break;
      case 'retry-capture':
        retryCapture(root);
        break;
      case 'view-duplicate':
        openDuplicate(Number(target.dataset.id));
        break;
      default:
        break;
    }
  });
}

async function startCamera(sheet) {
  const root = sheet.root;
  await state.scanner?.stop();

  const scanner = new QrScanner('qr-reader');
  state.scanner = scanner;

  ui.scannerHideOverlay(root);
  ui.scannerSetHint(root, 'Iniciando cámara…');
  ui.scannerSetCameraControls(root, { torch: false, flip: true });

  try {
    await scanner.start((text) => onQrDecoded(text));

    if (state.scanner !== scanner || !state.sheet) {
      await scanner.stop();
      return;
    }

    ui.scannerSetHint(root, 'Apunta al código QR del Pokémon');
    ui.scannerSetCameraControls(root, {
      torch: scanner.supportsTorch(),
      flip: true,
    });
  } catch (error) {
    console.warn('Cámara:', error);
    ui.scannerSetHint(root, '');
    ui.scannerError(root, {
      title:
        error.kind === 'permission'
          ? 'Permiso de cámara requerido'
          : 'No se pudo abrir la cámara',
      message: scannerErrorMessage(error),
      retryAction: ['permission', 'busy', 'generic'].includes(error.kind)
        ? 'retry-camera'
        : null,
      showCamera: false,
    });
  }
}

function onQrDecoded(text) {
  if (state.scanBusy || !state.sheet) return;

  // Evita procesar el mismo código repetidamente mientras sigue frente a la cámara.
  const now = Date.now();
  if (text === lastDecoded.text && now - lastDecoded.time < 3500) return;
  lastDecoded = { text, time: now };

  const result = parsePokemonQr(text);
  const root = scannerRoot();
  if (!root) return;

  ui.scannerFlash(root);

  if (!result.ok) {
    state.scanBusy = true;
    vibrate([40, 60, 40]);
    ui.toast(qrErrorMessage(result.reason), 'error', { duration: 2400 });
    setTimeout(() => {
      state.scanBusy = false;
    }, 1400);
    return;
  }

  vibrate(50);
  void requestCapture(result.id);
}

async function requestCapture(id) {
  if (state.scanBusy || !state.sheet) return;

  const root = scannerRoot();
  const scanner = state.scanner;
  const existing = state.collection.find((pokemon) => pokemon.id === id);

  state.scanBusy = true;
  state.pendingId = id;
  state.pending = null;
  ui.scannerSetHint(root, '');

  await scanner?.pause();

  // 1. Nunca se permite duplicar un Pokémon ya registrado.
  if (existing) {
    ui.scannerDuplicate(root, existing);
    return;
  }

  // 2. Se consulta PokéAPI y se muestra la información antes de confirmar.
  ui.scannerLoading(root);

  try {
    const pokemon = await getPokemon(id);
    if (!state.sheet || state.pendingId !== id) return;
    state.pending = pokemon;
    ui.scannerPreview(root, pokemon);
  } catch (error) {
    if (!state.sheet) return;
    console.warn('PokéAPI:', error);
    const message = apiErrorMessage(error);
    ui.toast(message, 'error', { duration: 4200 });
    ui.scannerError(root, {
      title: 'No se pudo consultar la información',
      message,
      retryAction: navigator.onLine ? 'retry-capture' : null,
      showCamera: true,
    });
  }
}

async function toggleTorch(root) {
  const scanner = state.scanner;
  if (!scanner) return;
  try {
    const isOn = await scanner.toggleTorch();
    ui.scannerToggleTorchState(root, Boolean(isOn));
  } catch (error) {
    ui.toast(scannerErrorMessage(error), 'warning');
  }
}

async function flipCamera(root) {
  const scanner = state.scanner;
  if (!scanner || state.scanBusy) return;

  state.scanBusy = true;
  ui.scannerSetHint(root, 'Cambiando cámara…');

  try {
    await scanner.flip((text) => onQrDecoded(text));
    if (state.scanner !== scanner) return;
    ui.scannerSetHint(root, 'Apunta al código QR del Pokémon');
    ui.scannerSetCameraControls(root, {
      torch: scanner.supportsTorch(),
      flip: true,
    });
    ui.scannerToggleTorchState(root, false);
  } catch (error) {
    ui.toast(scannerErrorMessage(error), 'warning');
    ui.scannerSetHint(root, 'Apunta al código QR del Pokémon');
  } finally {
    if (state.scanner === scanner) state.scanBusy = false;
  }
}

async function retryCapture(root) {
  const id = state.pendingId;
  state.scanBusy = false;
  if (!id) {
    ui.scannerHideOverlay(root);
    return;
  }
  await requestCapture(id);
}

function resumeScanning(root) {
  state.scanBusy = false;
  state.pending = null;
  state.pendingId = null;
  ui.scannerHideOverlay(root);
  ui.scannerSetHint(root, 'Apunta al código QR del Pokémon');
  void state.scanner?.resume();
}

/* =========================================================================
   Captura
   ========================================================================= */

function confirmCapture() {
  const pokemon = state.pending;
  if (!pokemon) return;

  try {
    const result = storage.addCaptured(pokemon);

    if (!result.added) {
      state.collection = result.collection;
      ui.closeSheet();
      ui.renderAll(state);
      ui.toast('Este Pokémon ya había sido capturado.', 'warning');
      return;
    }

    state.collection = result.collection;
    ui.closeSheet();
    ui.showView('pokedex');
    ui.renderAll(state);
    vibrate([60, 40, 60]);

    ui.toast(
      `¡${formatName(pokemon.name)} fue agregado a tu Pokédex! ${emojiForTypes(pokemon.types)}`,
      'success',
      { duration: 4600 },
    );
  } catch (error) {
    console.error(error);
    ui.toast(
      'No fue posible guardar el Pokémon. Revisa el espacio disponible del navegador.',
      'error',
      { duration: 5000 },
    );
  }
}

function openDuplicate(id) {
  const pokemon = state.collection.find((item) => item.id === id);
  ui.closeSheet();
  if (!pokemon) return;
  setTimeout(() => ui.openPokemonDetail(pokemon), 320);
}

/* =========================================================================
   Utilidades del dispositivo
   ========================================================================= */

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* La vibración es opcional. */
  }
}

/* =========================================================================
   PWA: Service Worker e instalación
   ========================================================================= */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!['http:', 'https:'].includes(window.location.protocol)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', {
        scope: './',
      });

      const promptUpdate = (worker) => {
        if (!worker) return;
        ui.toast('Nueva versión de la Pokédex disponible.', 'info', {
          duration: 0,
          action: {
            label: 'Actualizar',
            onClick: () => {
              updating = true;
              worker.postMessage({ type: 'SKIP_WAITING' });
            },
          },
        });
      };

      if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(newWorker);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updating) window.location.reload();
      });
    } catch (error) {
      console.warn('Service Worker no registrado:', error);
    }
  });
}

function bindInstallPrompt() {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installToastShown) return;
    installToastShown = true;

    ui.toast('Instala la Pokédex en tu dispositivo.', 'info', {
      duration: 12000,
      action: {
        label: 'Instalar',
        onClick: async () => {
          if (!installPrompt) return;
          installPrompt.prompt();
          try {
            await installPrompt.userChoice;
          } catch {
            /* El usuario pudo cancelar. */
          }
          installPrompt = null;
        },
      },
    });
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    ui.toast('¡Pokédex instalada! Ábrela desde tu pantalla de inicio.', 'success');
  });
}

/* =========================================================================
   Arranque
   ========================================================================= */

init();

// Expone información mínima de depuración sin acoplar la interfaz.
window.PokedexPWA = {
  total: TOTAL_POKEMON,
  getCollection: () => [...state.collection],
};
