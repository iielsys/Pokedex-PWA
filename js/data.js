/**
 * data.js
 * Catálogo local de la primera generación y utilidades de presentación.
 * Los nombres se usan para silenciar tarjetas bloqueadas y para formatear
 * la información que devuelve PokéAPI.
 */

export const TOTAL_POKEMON = 151;

export const POKEMON_NAMES = [
  'bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard',
  'squirtle', 'wartortle', 'blastoise', 'caterpie', 'metapod', 'butterfree',
  'weedle', 'kakuna', 'beedrill', 'pidgey', 'pidgeotto', 'pidgeot',
  'rattata', 'raticate', 'spearow', 'fearow', 'ekans', 'arbok',
  'pikachu', 'raichu', 'sandshrew', 'sandslash', 'nidoran-f', 'nidorina',
  'nidoqueen', 'nidoran-m', 'nidorino', 'nidoking', 'clefairy', 'clefable',
  'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff', 'zubat', 'golbat',
  'oddish', 'gloom', 'vileplume', 'paras', 'parasect', 'venonat',
  'venomoth', 'diglett', 'dugtrio', 'meowth', 'persian', 'psyduck',
  'golduck', 'mankey', 'primeape', 'growlithe', 'arcanine', 'poliwag',
  'poliwhirl', 'poliwrath', 'abra', 'kadabra', 'alakazam', 'machop',
  'machoke', 'machamp', 'bellsprout', 'weepinbell', 'victreebel', 'tentacool',
  'tentacruel', 'geodude', 'graveler', 'golem', 'ponyta', 'rapidash',
  'slowpoke', 'slowbro', 'magnemite', 'magneton', 'farfetchd', 'doduo',
  'dodrio', 'seel', 'dewgong', 'grimer', 'muk', 'shellder',
  'cloyster', 'gastly', 'haunter', 'gengar', 'onix', 'drowzee',
  'hypno', 'krabby', 'kingler', 'voltorb', 'electrode', 'exeggcute',
  'exeggutor', 'cubone', 'marowak', 'hitmonlee', 'hitmonchan', 'lickitung',
  'koffing', 'weezing', 'rhyhorn', 'rhydon', 'chansey', 'tangela',
  'kangaskhan', 'horsea', 'seadra', 'goldeen', 'seaking', 'staryu',
  'starmie', 'mr-mime', 'scyther', 'jynx', 'electabuzz', 'magmar',
  'pinsir', 'tauros', 'magikarp', 'gyarados', 'lapras', 'ditto',
  'eevee', 'vaporeon', 'jolteon', 'flareon', 'porygon', 'omanyte',
  'omastar', 'kabuto', 'kabutops', 'aerodactyl', 'snorlax', 'articuno',
  'zapdos', 'moltres', 'dratini', 'dragonair', 'dragonite', 'mewtwo', 'mew',
];

export const BASE_POKEMON = POKEMON_NAMES.map((name, index) => ({
  id: index + 1,
  name,
}));

/** Información de tipos: etiqueta en español, color oficial y emoji. */
export const TYPE_INFO = {
  normal:   { es: 'Normal',    color: '#A8A77A', emoji: '⭐' },
  fire:     { es: 'Fuego',     color: '#EE8130', emoji: '🔥' },
  water:    { es: 'Agua',      color: '#6390F0', emoji: '💧' },
  electric: { es: 'Eléctrico', color: '#F7D02C', emoji: '⚡' },
  grass:    { es: 'Planta',    color: '#7AC74C', emoji: '🌿' },
  ice:      { es: 'Hielo',     color: '#96D9D6', emoji: '❄️' },
  fighting: { es: 'Lucha',     color: '#C22E28', emoji: '🥊' },
  poison:   { es: 'Veneno',    color: '#A33EA1', emoji: '☠️' },
  ground:   { es: 'Tierra',    color: '#E2BF65', emoji: '⛰️' },
  flying:   { es: 'Volador',   color: '#A98FF3', emoji: '🪶' },
  psychic:  { es: 'Psíquico',  color: '#F95587', emoji: '🔮' },
  bug:      { es: 'Bicho',     color: '#A6B91A', emoji: '🐛' },
  rock:     { es: 'Roca',      color: '#B6A136', emoji: '🪨' },
  ghost:    { es: 'Fantasma',  color: '#735797', emoji: '👻' },
  dragon:   { es: 'Dragón',    color: '#6F35FC', emoji: '🐉' },
  dark:     { es: 'Siniestro', color: '#705746', emoji: '🌙' },
  steel:    { es: 'Acero',     color: '#B7B7CE', emoji: '⚙️' },
  fairy:    { es: 'Hada',      color: '#D685AD', emoji: '✨' },
};

/** Nombres en español de las estadísticas base. */
export const STAT_INFO = {
  hp: { es: 'PS', short: 'PS' },
  attack: { es: 'Ataque', short: 'ATQ' },
  defense: { es: 'Defensa', short: 'DEF' },
  'special-attack': { es: 'Ataque especial', short: 'ATQ.ESP' },
  'special-defense': { es: 'Defensa especial', short: 'DEF.ESP' },
  speed: { es: 'Velocidad', short: 'VEL' },
};

export const STAT_ORDER = [
  'hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed',
];

export const MILESTONES = [1, 10, 25, 50, 100, 151];

/** Formatea un ID como número de Pokédex: 25 -> "#025". */
export function formatId(id) {
  return `#${String(id).padStart(3, '0')}`;
}

/** Convierte "mr-mime" en "Mr Mime" para mostrarlo en la interfaz. */
export function formatName(name) {
  if (!name) return '???';
  return String(name)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function typeLabel(type) {
  return TYPE_INFO[type]?.es ?? formatName(type);
}

export function typeColor(type) {
  return TYPE_INFO[type]?.color ?? '#A8A77A';
}

export function typeEmoji(type) {
  return TYPE_INFO[type]?.emoji ?? '⭐';
}

export function emojiForTypes(types = []) {
  return types.map(typeEmoji).slice(0, 2).join('');
}

export function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida';
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
