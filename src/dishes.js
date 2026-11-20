// Pure helpers for slicing the dish list into views.

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

export const categoryOf = (dish) =>
  CATEGORIES.includes(dish.category) ? dish.category : guessCategory(dish.name);

export const isPie = (dish) => /\bpies?\b/i.test(dish.name);

export const isUnclaimed = (dish) => dish.status === 'unassigned' || !dish.assignedTo;

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
