/**
 * api.js
 * Consumo de PokéAPI (https://pokeapi.co/api/v2/pokemon/{id}).
 * Normaliza la respuesta para que la interfaz no dependa de la forma exacta
 * del JSON y clasifica los errores para poder mostrar mensajes claros.
 */

import { TOTAL_POKEMON } from './data.js';

const API_BASE = 'https://pokeapi.co/api/v2';
const DEFAULT_TIMEOUT = 12000;
const SPECIES_TIMEOUT = 7000;

export class PokeApiError extends Error {
  /**
   * @param {string} message Mensaje legible para el usuario.
   * @param {'offline'|'timeout'|'notfound'|'server'|'network'|'invalid'|'range'} kind
   * @param {number} [status]
   */
  constructor(message, kind, status = 0) {
    super(message);
    this.name = 'PokeApiError';
    this.kind = kind;
    this.status = status;
  }
}

async function fetchJson(url, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      mode: 'cors',
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new PokeApiError('Ese Pokémon no existe en la PokéAPI.', 'notfound', 404);
      }
      throw new PokeApiError(
        'La PokéAPI respondió con un error. Intenta de nuevo.',
        'server',
        response.status,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof PokeApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new PokeApiError('La PokéAPI tardó demasiado en responder.', 'timeout');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new PokeApiError('No hay conexión a Internet.', 'offline');
    }
    throw new PokeApiError(
      'No fue posible consultar la información del Pokémon.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }
}

function pickArtwork(data) {
  return (
    data?.sprites?.other?.['official-artwork']?.front_default ||
    data?.sprites?.other?.home?.front_default ||
    data?.sprites?.front_default ||
    ''
  );
}

function cleanFlavor(text) {
  return String(text || '')
    .replace(/[\n\f\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function fetchSpanishFlavor(speciesUrl) {
  if (!speciesUrl) return '';
  try {
    const species = await fetchJson(speciesUrl, SPECIES_TIMEOUT);
    const entries = Array.isArray(species?.flavor_text_entries)
      ? species.flavor_text_entries
      : [];
    const spanish = entries.find(
      (entry) => entry?.language?.name === 'es' && entry?.flavor_text,
    );
    const english = entries.find(
      (entry) => entry?.language?.name === 'en' && entry?.flavor_text,
    );
    return cleanFlavor(spanish?.flavor_text || english?.flavor_text || '');
  } catch {
    return '';
  }
}

/**
 * Consulta un Pokémon por ID y devuelve un objeto listo para guardar.
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function getPokemon(id) {
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId < 1 || numericId > TOTAL_POKEMON) {
    throw new PokeApiError(
      `Solamente existen Pokémon entre #001 y #${String(TOTAL_POKEMON).padStart(3, '0')}.`,
      'range',
    );
  }

  const data = await fetchJson(`${API_BASE}/pokemon/${numericId}`);
  const flavor = await fetchSpanishFlavor(data?.species?.url);

  const types = Array.isArray(data?.types)
    ? data.types
        .sort((a, b) => a.slot - b.slot)
        .map((entry) => entry?.type?.name)
        .filter(Boolean)
    : [];

  const abilities = Array.isArray(data?.abilities)
    ? data.abilities
        .sort((a, b) => a.slot - b.slot)
        .map((entry) => entry?.ability?.name)
        .filter(Boolean)
    : [];

  const stats = Array.isArray(data?.stats)
    ? data.stats
        .map((entry) => ({
          name: entry?.stat?.name,
          value: Number(entry?.base_stat),
        }))
        .filter((stat) => stat.name && Number.isFinite(stat.value))
    : [];

  const image = pickArtwork(data);

  return {
    id: data.id ?? numericId,
    name: data.name ?? `pokemon-${numericId}`,
    image,
    sprite: data?.sprites?.front_default || image,
    types,
    height: Number.isFinite(Number(data?.height)) ? Number(data.height) / 10 : null,
    weight: Number.isFinite(Number(data?.weight)) ? Number(data.weight) / 10 : null,
    abilities,
    stats,
    flavor,
    capturedAt: new Date().toISOString(),
  };
}

/** Devuelve un mensaje de toast adecuado para cada tipo de error. */
export function apiErrorMessage(error) {
  if (error instanceof PokeApiError) {
    switch (error.kind) {
      case 'offline':
        return 'Sin conexión. Conéctate a Internet para descubrir Pokémon.';
      case 'timeout':
        return 'La PokéAPI tardó demasiado en responder. Intenta de nuevo.';
      case 'notfound':
      case 'range':
        return 'Ese Pokémon no pertenece a la primera generación.';
      case 'server':
        return 'La PokéAPI no está disponible en este momento.';
      default:
        return 'No fue posible consultar la información del Pokémon.';
    }
  }
  return 'No fue posible consultar la información del Pokémon.';
}
