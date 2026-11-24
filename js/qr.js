/**
 * qr.js
 * Lectura y validación de códigos QR de la Pokédex.
 *
 * Formato aceptado: pokemon:{id}  (por ejemplo "pokemon:25").
 * La lectura se realiza únicamente con la cámara, usando html5-qrcode
 * cargada localmente en vendor/.
 */

import { TOTAL_POKEMON } from './data.js';

const QR_PREFIX = 'pokemon:';
const QR_PATTERN = /^pokemon:(\d{1,3})$/i;

/** Valida el contenido de un QR y extrae el ID del Pokémon. */
export function parsePokemonQr(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };

  const text = raw.trim();
  if (!text) return { ok: false, reason: 'empty' };

  if (!text.toLowerCase().startsWith(QR_PREFIX)) {
    return { ok: false, reason: 'prefix' };
  }

  const match = text.match(QR_PATTERN);
  if (!match) return { ok: false, reason: 'format' };

  const id = Number(match[1]);
  if (!Number.isInteger(id) || id < 1 || id > TOTAL_POKEMON) {
    return { ok: false, reason: 'range' };
  }

  return { ok: true, id };
}

export function qrErrorMessage(reason) {
  switch (reason) {
    case 'range':
      return `Ese código no corresponde a un Pokémon de la primera generación (001–${String(TOTAL_POKEMON).padStart(3, '0')}).`;
    case 'empty':
      return 'No se detectó ningún código. Intenta de nuevo.';
    case 'prefix':
    case 'format':
    default:
      return 'Este código QR no pertenece a la Pokédex.';
  }
}

export class ScannerError extends Error {
  /**
   * @param {string} message
   * @param {'insecure'|'permission'|'nodevice'|'busy'|'unsupported'|'generic'} kind
   */
  constructor(message, kind = 'generic') {
    super(message);
    this.name = 'ScannerError';
    this.kind = kind;
  }
}

export function scannerErrorMessage(error) {
  if (error instanceof ScannerError) return error.message;
  return 'No fue posible iniciar la cámara.';
}

function mapCameraError(error) {
  const name = error?.name || '';
  const message = String(error?.message || '');

  if (!window.isSecureContext) {
    return new ScannerError(
      'La cámara requiere HTTPS. Abre la app desde localhost o un sitio seguro (por ejemplo GitHub Pages).',
      'insecure',
    );
  }
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission|denied/i.test(message)) {
    return new ScannerError(
      'No se otorgó permiso para usar la cámara. Habilítalo en los ajustes del navegador e intenta de nuevo.',
      'permission',
    );
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return new ScannerError(
      'No se encontró una cámara disponible en este dispositivo.',
      'nodevice',
    );
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || /in use|busy|could not start/i.test(message)) {
    return new ScannerError(
      'La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.',
      'busy',
    );
  }
  if (name === 'AbortError') {
    return new ScannerError('La cámara se detuvo antes de iniciar.', 'generic');
  }
  return new ScannerError(
    'No fue posible iniciar la cámara. Revisa los permisos e intenta de nuevo.',
    'generic',
  );
}

function getLib() {
  return window.Html5Qrcode || null;
}

function getFormats() {
  const formats = window.Html5QrcodeSupportedFormats;
  return formats ? [formats.QR_CODE] : undefined;
}

/**
 * Controlador de la cámara. Mantiene una sola instancia de html5-qrcode y
 * expone operaciones sencillas para la interfaz.
 */
export class QrScanner {
  constructor(elementId) {
    this.elementId = elementId;
    this.instance = null;
    this.running = false;
    this.facing = 'environment';
    this.torchOn = false;
    this.videoPaused = false;
  }

  static isSupported() {
    return Boolean(
      getLib() &&
      window.isSecureContext &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function',
    );
  }

  async start(onDecoded) {
    const Lib = getLib();
    if (!Lib) {
      throw new ScannerError(
        'La librería de lectura QR no se cargó. Recarga la página.',
        'unsupported',
      );
    }
    if (!window.isSecureContext) {
      throw new ScannerError(
        'La cámara requiere HTTPS. Abre la app desde localhost o un sitio seguro.',
        'insecure',
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ScannerError(
        'Este navegador no puede acceder a la cámara. Usa un navegador compatible.',
        'unsupported',
      );
    }

    await this.stop();

    const element = document.getElementById(this.elementId);
    if (!element) {
      throw new ScannerError('No se encontró el área de la cámara.', 'generic');
    }
    element.innerHTML = '';

    try {
      this.instance = new Lib(this.elementId, {
        verbose: false,
        formatsToSupport: getFormats(),
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });

      await this.instance.start(
        { facingMode: this.facing },
        {
          fps: 12,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.74);
            const safeSize = Math.max(180, size);
            return { width: safeSize, height: safeSize };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (typeof onDecoded === 'function') onDecoded(decodedText);
        },
        () => {
          /* Los fallos de lectura por frame son normales: se ignoran. */
        },
      );

      this.running = true;
      this.torchOn = false;
      this.videoPaused = false;
      return true;
    } catch (error) {
      await this.stop();
      throw mapCameraError(error);
    }
  }

  async stop() {
    const instance = this.instance;
    this.instance = null;
    this.running = false;
    this.videoPaused = false;
    this.torchOn = false;

    if (!instance) return;

    try {
      await instance.stop();
    } catch {
      /* La cámara pudo haberse detenido sola. */
    }
    try {
      instance.clear();
    } catch {
      /* El contenedor pudo eliminarse junto con el Bottom Sheet. */
    }
  }

  async pause() {
    if (!this.instance || !this.running || this.videoPaused) return;
    try {
      await this.instance.pause(true);
      this.videoPaused = true;
    } catch {
      /* Si no se puede pausar, basta con detener el procesamiento. */
    }
  }

  async resume() {
    if (!this.instance || !this.running || !this.videoPaused) return;
    try {
      await this.instance.resume();
      this.videoPaused = false;
    } catch {
      /* Se ignora: el escáner seguirá recibiendo frames si el video corre. */
    }
  }

  supportsTorch() {
    if (!this.instance || !this.running) return false;
    try {
      const capabilities = this.instance.getRunningTrackCapabilities?.() || {};
      return capabilities.torch === true;
    } catch {
      return false;
    }
  }

  async toggleTorch() {
    if (!this.instance || !this.running) return false;
    const nextValue = !this.torchOn;
    try {
      await this.instance.applyVideoConstraints({
        advanced: [{ torch: nextValue }],
      });
      this.torchOn = nextValue;
      return nextValue;
    } catch {
      throw new ScannerError('Este dispositivo no permite controlar la linterna.', 'generic');
    }
  }

  async flip(onDecoded) {
    const nextFacing = this.facing === 'environment' ? 'user' : 'environment';
    this.facing = nextFacing;
    try {
      await this.start(onDecoded);
      return this.facing;
    } catch (error) {
      // Si la cámara alternativa no existe, se intenta volver a la anterior.
      this.facing = nextFacing === 'environment' ? 'user' : 'environment';
      try {
        await this.start(onDecoded);
      } catch {
        /* Se propaga el error original, que describe mejor el problema. */
      }
      throw error;
    }
  }
}
