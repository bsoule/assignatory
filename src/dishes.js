// Pure helpers for slicing the dish list into views.
// Also listProblems and API_URL, which server.js imports too (the Dockerfile copies this file next to server.js).

// Where the server serves the dish list, and where the page asks for it. The
// v1 is the API's version: bump it with any change that a page loaded before
// it would get wrong. The server then serves nothing at the old URL (a 404),
// so such a page can neither load nor save, and says to reload.
export const API_URL = '/api/v1';  // This will be the base URL for our API

export const CATEGORIES = ['Main', 'Side / Veg', 'Dessert', 'Beverage', 'Other'];

// Used when a dish has no category yet (older entries, or "Auto" when adding).
// First match wins, so "Sweet potato pie" is a dessert, not a side.
const GUESSES = [
  ['Dessert', /\b(pies?|cakes?|cookies?|gingerbread|brownies?|tarts?|pudding|ice cream|dessert)\b/i],
  ['Beverage', /\b(wine|beer|punch|cider|manhattans?|cocktails?|drinks?|juice|coffee|tea|soda|champagne)\b/i],
  ['Main', /^(turkey|ham|roast)\b|\b(entr[eé]e|main)\b/i],
  ['Side / Veg', /\b(stuffing|potato(es)?|casserole|rolls?|yams?|salad|veg\w*|beans?|corn|squash|sprouts)\b/i],
];

export const guessCategory = (name) =>
  (GUESSES.find(([, pattern]) => pattern.test(name)) || ['Other'])[0];

// A dish's own category, or for an older dish that has none, the guess.
// (listProblems refuses a category that isn't in CATEGORIES.)
export const categoryOf = (dish) => dish.category ?? guessCategory(dish.name);

export const isPie = (dish) => /\bpies?\b/i.test(dish.name);

// Unassigned is exactly when nobody is named: listProblems makes sure.
export const isUnclaimed = (dish) => dish.status === 'unassigned';

// "Erica & Stephen" counts for both Erica and Stephen.
export const peopleOf = (dish) =>
  (dish.assignedTo || '')
    .split(/\s*(?:&|,|\+|\band\b)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

export const isBringing = (dish, person) =>
  !isUnclaimed(dish) && peopleOf(dish).some((name) => sameName(name, person));

// Everyone who has been assigned something, each name once, alphabetical.
export const allPeople = (dishes) => {
  const people = [];
  dishes
    .filter((dish) => !isUnclaimed(dish))
    .flatMap(peopleOf)
    .forEach((name) => {
      if (!people.some((known) => sameName(known, name))) people.push(name);
    });
  return people.sort((a, b) => a.localeCompare(b));
};

export const groupByCategory = (dishes) =>
  CATEGORIES.map((category) => ({
    category,
    dishes: dishes.filter((dish) => categoryOf(dish) === category),
  })).filter((group) => group.dishes.length > 0);

// A dish's status: nobody yet, someone asked but not confirmed, or confirmed.
const STATUSES = ['unassigned', 'pending', 'confirmed'];
const FIELDS = ['id', 'name', 'category', 'notes', 'assignedTo', 'status'];
const trimmed = (text) => typeof text === 'string' && text === text.trim();

// What every dish must be, as [rule, test]: the shapes the app has always
// saved. (Dishes from its first version have no category or notes.)
const DISH_RULES = [
  ['be an object', (dish) => typeof dish === 'object' && dish !== null && !Array.isArray(dish)],
  [`have no fields but ${FIELDS.join(', ')}`, (dish) => Object.keys(Object(dish)).every((key) => FIELDS.includes(key))],
  ['have a whole-number id', (dish) => Number.isSafeInteger(dish?.id)],
  ['have a name, with no spaces at either end', (dish) => trimmed(dish?.name) && dish.name !== ''],
  [`have no category or one of ${CATEGORIES.join(', ')}`,
    (dish) => !('category' in Object(dish)) || CATEGORIES.includes(dish.category)],
  ['have no notes, or notes with no spaces at either end', (dish) => !('notes' in Object(dish)) || trimmed(dish.notes)],
  ['have an assignedTo with no spaces at either end', (dish) => trimmed(dish?.assignedTo)],
  [`have a status of ${STATUSES.join(', ')}`, (dish) => STATUSES.includes(dish?.status)],
  ['be unassigned exactly when nobody is named', (dish) => (dish?.status === 'unassigned') === (dish?.assignedTo === '')],
];

// Whether a dish (now, or undefined if it's gone) is the same in every field as
// it was, whatever order its fields are in. A change to a dish is refused when
// someone else changed the dish since the page showed it.
export const sameDish = (now, was) => now !== undefined && FIELDS.every((field) => now[field] === was[field]);

// Everything wrong with a dish list, a sentence each; none for a list the app
// could have saved. The server refuses a list with problems and the page
// won't show one: anti-Postel, fail loudly rather than guess.
export const listProblems = (list) => (Array.isArray(list)
  ? [
    ...list.flatMap((dish, i) => DISH_RULES.filter(([, ok]) => !ok(dish))
      .map(([rule]) => `Dish ${i} (${JSON.stringify(dish)}) should ${rule}.`)),
    ...list.map((dish) => dish?.id).filter((id, i, ids) => id !== undefined && ids.indexOf(id) !== i)
      .map((id) => `More than one dish has the id ${id}.`),
  ]
  : [`A dish list should be an array, not ${JSON.stringify(list)}.`]);
