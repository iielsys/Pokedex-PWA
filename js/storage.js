/**
 * storage.js
 * Persistencia exclusiva en localStorage.
 *
 * Estructura guardada (clave "pokemonCapturados"):
 * [
 *   {
 *     id: 25,
 *     name: "pikachu",
 *     image: "https://.../official-artwork/25.png",
 *     sprite: "https://.../sprites/pokemon/25.png",
 *     types: ["electric"],
 *     height: 0.4,
 *     weight: 6,
 *     abilities: ["static", "lightning-rod"],
 *     stats: [{ name: "hp", value: 35 }, ...],
 *     flavor: "...",
 *     capturedAt: "2026-11-03T19:15:00.000Z"
 *   }
 * ]
 *
 * La colección se guarda completa (no solo el ID) para que la Pokédex
 * siga mostrando la información sin conexión a Internet.
 */

import { POKEMON_NAMES, TOTAL_POKEMON } from './data.js';

export const STORAGE_KEY = 'pokemonCapturados';
const BACKUP_KEY = 'pokemonCapturados_respaldo';

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

function isValidId(id) {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_POKEMON;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim() !== '');
}

function normalizeStats(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((stat) => stat && typeof stat.name === 'string' && Number.isFinite(Number(stat.value)))
    .map((stat) => ({ name: stat.name, value: Number(stat.value) }));
}

/**
 * Normaliza una entrada recuperada de localStorage. Devuelve null si el
 * registro es inválido (así una colección corrupta nunca rompe la app).
 */
function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const id = Number(entry.id);
  if (!isValidId(id)) return null;

  const capturedAt = new Date(entry.capturedAt ?? '');
  return {
    id,
    name: typeof entry.name === 'string' && entry.name ? entry.name : POKEMON_NAMES[id - 1],
    image: typeof entry.image === 'string' ? entry.image : '',
    sprite: typeof entry.sprite === 'string' ? entry.sprite : (typeof entry.image === 'string' ? entry.image : ''),
    types: toStringArray(entry.types),
    height: Number.isFinite(Number(entry.height)) ? Number(entry.height) : null,
    weight: Number.isFinite(Number(entry.weight)) ? Number(entry.weight) : null,
    abilities: toStringArray(entry.abilities),
    stats: normalizeStats(entry.stats),
    flavor: typeof entry.flavor === 'string' ? entry.flavor : '',
    capturedAt: Number.isNaN(capturedAt.getTime())
      ? new Date().toISOString()
      : capturedAt.toISOString(),
  };
}

/** Recupera y sanea la colección guardada. */
export function loadCollection() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('No fue posible leer localStorage.', error);
    return [];
  }

  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('La colección guardada estaba dañada. Se creó un respaldo.', error);
    try {
      localStorage.setItem(`${BACKUP_KEY}_${Date.now()}`, raw);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Sin espacio o sin permisos: se ignora, la app sigue funcionando. */
    }
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const seen = new Set();
  const collection = [];

  for (const entry of parsed) {
    const normalized = normalizeEntry(entry);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    collection.push(normalized);
  }

  return collection.sort((a, b) => a.id - b.id);
}

/** Guarda la colección completa. Lanza StorageError si el navegador lo impide. */
export function saveCollection(collection) {
  const safeCollection = Array.isArray(collection) ? collection : [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeCollection));
  } catch (error) {
    throw new StorageError(
      'No fue posible guardar la colección en este dispositivo.',
      error,
    );
  }
  return safeCollection;
}

export function isCaptured(id) {
  return loadCollection().some((pokemon) => pokemon.id === Number(id));
}

/**
 * Agrega un Pokémon a la colección evitando duplicados.
 * Devuelve { added, collection, pokemon }.
 */
export function addCaptured(pokemon) {
  const collection = loadCollection();
  const normalized = normalizeEntry({ ...pokemon, capturedAt: new Date().toISOString() });

  if (!normalized) {
    throw new StorageError('El Pokémon recibido no es válido.');
  }

  const existing = collection.find((item) => item.id === normalized.id);
  if (existing) {
    return { added: false, collection, pokemon: existing };
  }

  const nextCollection = [...collection, normalized].sort((a, b) => a.id - b.id);
  saveCollection(nextCollection);
  return { added: true, collection: nextCollection, pokemon: normalized };
}

/** Elimina un Pokémon capturado. */
export function removeCaptured(id) {
  const nextCollection = loadCollection().filter((item) => item.id !== Number(id));
  saveCollection(nextCollection);
  return nextCollection;
}

/** Borra la colección completa. */
export function resetCollection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageError('No fue posible borrar la colección.', error);
  }
  return [];
}
