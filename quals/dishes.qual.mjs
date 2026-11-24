// The dish helpers in src/dishes.js, which decide every view: the category a
// dish is filed under, what counts as a pie, as unclaimed, as someone's dish.
// Categories are named through CATEGORIES (and the guess for a name nothing
// matches), never spelled out, so renaming one doesn't break these quals.
import assert from 'node:assert/strict';
import {
  CATEGORIES, guessCategory, categoryOf, isPie, isUnclaimed, peopleOf, isBringing, allPeople, groupByCategory,
  listProblems,
} from '../src/dishes.js';
import { FIXTURE, rer } from './app.mjs';

const [MAIN, SIDE, DESSERT, BEVERAGE] = CATEGORIES;
const OTHER = guessCategory('Qwzx');  // the category for names nothing matches

const same = (actual, expected, replicata, expectata) =>
  assert.deepEqual(actual, expected, rer(replicata, expectata, `got ${JSON.stringify(actual)}`));

assert.ok(CATEGORIES.includes(OTHER), rer(
  'guessCategory("Qwzx"), a name that matches no rule', 'one of CATEGORIES, so a guess is always a real category',
  `${JSON.stringify(OTHER)}, not in ${JSON.stringify(CATEGORIES)}`));
assert.equal(new Set([MAIN, SIDE, DESSERT, BEVERAGE, OTHER]).size, 5, rer(
  'take CATEGORIES[0..3] as main, side, dessert, beverage and the no-match guess as other',
  'five different categories', `${JSON.stringify([MAIN, SIDE, DESSERT, BEVERAGE, OTHER])}`));

// guessCategory: one name per word each rule knows, in assorted capitalization.
const GUESSES = {
  [DESSERT]: ['Pumpkin pie', 'Mince PIES', 'Carrot cake', 'Cakes', 'Sugar cookies', 'Cookie', 'Gingerbread',
    'Brownies', 'Brownie', 'Lemon tart', 'Tarts', 'Bread pudding', 'Ice cream', 'Dessert platter'],
  [BEVERAGE]: ['Wine', 'beer', 'Punch', 'Hot cider', 'Manhattans', 'Manhattan', 'Cocktails', 'Cocktail', 'Drinks',
    'Drink', 'Orange juice', 'Coffee', 'Tea', 'SODA', 'Champagne'],
  [MAIN]: ['Turkey', 'turkey breast', 'Ham', 'Roast beef', 'Vegan entree', 'Vegan entrée', 'Main course'],
  [SIDE]: ['Stuffing', 'Potato', 'Mashed potatoes', 'Green bean casserole', 'Rolls', 'Dinner roll', 'Yams',
    'Candied yam', 'Salad', 'Vegetables', 'Veggie tray', 'Green beans', 'Corn', 'Butternut squash',
    'Brussels sprouts', 'Roasted vegetables'],
  [OTHER]: ['Napkins', 'Folding chairs', 'Ice', 'Plates & cups'],
};
for (const [category, names] of Object.entries(GUESSES)) {
  for (const name of names) {
    same(guessCategory(name), category, `guessCategory(${JSON.stringify(name)})`, JSON.stringify(category));
  }
}

// First match wins, so "Sweet potato pie" is a dessert, not a side (the rule's own example).
same(guessCategory('Sweet potato pie'), DESSERT, 'guessCategory("Sweet potato pie")',
  'dessert: the dessert rule comes before the side rule');

// Rules match whole words, and turkey, ham and roast only at the start of the name.
for (const [name, not] of [['Pineapple slices', DESSERT], ['Pierogi', DESSERT], ['Steak', BEVERAGE],
  ['Hamburger sliders', MAIN], ['Roasted vegetables', MAIN], ['Apple turkey candy', MAIN]]) {
  assert.notEqual(guessCategory(name), not, rer(`guessCategory(${JSON.stringify(name)})`,
    `not ${JSON.stringify(not)}: no rule word stands alone in it (or not at its start)`, JSON.stringify(not)));
}

// Every guess is a category the page has a group for.
for (const name of [...Object.values(GUESSES).flat(), 'Sweet potato pie', 'Cranberry sauce', 'Gravy', '', '???']) {
  assert.ok(CATEGORIES.includes(guessCategory(name)), rer(`guessCategory(${JSON.stringify(name)})`,
    'one of CATEGORIES', JSON.stringify(guessCategory(name))));
}

// categoryOf: a stored category wins; a missing one (older dishes) falls back to
// the guess. An unknown one can't reach it: listProblems refuses such a dish.
same(categoryOf({ name: 'Turkey', category: DESSERT }), DESSERT, 'categoryOf a Turkey stored as a dessert',
  'the stored category, even though the name says otherwise');
same(categoryOf({ name: 'Turkey' }), MAIN, 'categoryOf a Turkey with no stored category', 'the guess, main');

// isPie: "pie" or "pies" as a whole word anywhere in the name.
for (const name of ['Pumpkin pie', 'Pie of Pecan', 'PIES', 'Shepherd’s pie', 'Pie']) {
  assert.ok(isPie({ name }), rer(`isPie({name: ${JSON.stringify(name)}})`, 'true', 'false'));
}
for (const name of ['Pineapple', 'Pierogi', 'Magpie cookies', 'Cake', '']) {
  assert.ok(!isPie({ name }), rer(`isPie({name: ${JSON.stringify(name)}})`, 'false', 'true'));
}

// isUnclaimed: the status is unassigned, which listProblems makes sure is
// exactly when nobody is named. (So only those pairings are checked.)
for (const [dish, expected] of [
  [{ status: 'unassigned', assignedTo: '' }, true],
  [{ status: 'pending', assignedTo: 'Alex' }, false],
  [{ status: 'confirmed', assignedTo: 'Alex' }, false],
]) {
  same(isUnclaimed(dish), expected, `isUnclaimed(${JSON.stringify(dish)})`, String(expected));
}

// peopleOf: "Erica & Stephen" counts for both Erica and Stephen (the helper's own example).
for (const [assignedTo, people] of [
  ['Erica & Stephen', ['Erica', 'Stephen']],
  ['Erica and Stephen', ['Erica', 'Stephen']],
  ['Erica AND Stephen', ['Erica', 'Stephen']],
  ['Erica, Stephen', ['Erica', 'Stephen']],
  ['Erica+Stephen', ['Erica', 'Stephen']],
  ['Ann, Bo & Cy and Di + Ed', ['Ann', 'Bo', 'Cy', 'Di', 'Ed']],
  ['  Alex  ', ['Alex']],
  ['Alex &', ['Alex']],
  ['Andy', ['Andy']],
  ['Sandy and Andy', ['Sandy', 'Andy']],
  ['Brandon', ['Brandon']],
  ['', []],
  [undefined, []],
]) {
  same(peopleOf({ assignedTo }), people, `peopleOf({assignedTo: ${JSON.stringify(assignedTo)}})`, JSON.stringify(people));
}

// isBringing: a name in the assignment, in any capitalization, of a claimed dish.
const shared = { assignedTo: 'Jo & Kim', status: 'confirmed' };
for (const [dish, person, expected] of [
  [shared, 'Jo', true],
  [shared, 'kim', true],
  [shared, 'KIM', true],
  [shared, 'Ki', false],
  [shared, 'Jo & Kim', false],
  [{ assignedTo: 'Alex', status: 'pending' }, 'alex', true],
  [{ assignedTo: '', status: 'unassigned' }, 'Alex', false],
]) {
  same(isBringing(dish, person), expected, `isBringing(${JSON.stringify(dish)}, ${JSON.stringify(person)})`, String(expected));
}

// allPeople: everyone on a claimed dish, once each (first spelling seen), alphabetical.
same(allPeople([
  { assignedTo: 'zoe', status: 'pending' },
  { assignedTo: 'alex', status: 'pending' },
  { assignedTo: 'Alex & Sam', status: 'confirmed' },
  { assignedTo: '', status: 'unassigned' },
]), ['alex', 'Sam', 'zoe'], 'allPeople of dishes for zoe, alex, "Alex & Sam", and an unclaimed dish',
'["alex", "Sam", "zoe"]: Alex once, as first spelled; sorted ignoring case');
same(allPeople([]), [], 'allPeople([])', '[]');

// groupByCategory: groups in CATEGORIES order, empty ones left out, dishes in list order.
const dishes = [
  { id: 1, name: 'Wine' }, { id: 2, name: 'Turkey' }, { id: 3, name: 'Pumpkin pie' },
  { id: 4, name: 'Beer' }, { id: 5, name: 'Turkey breast', category: BEVERAGE },
];
same(groupByCategory(dishes).map((group) => [group.category, group.dishes.map((dish) => dish.id)]),
  [[MAIN, [2]], [DESSERT, [3]], [BEVERAGE, [1, 4, 5]]],
  'groupByCategory of Wine, Turkey, Pumpkin pie, Beer, and a Turkey breast stored as a beverage',
  'main [2], dessert [3], beverage [1, 4, 5]: CATEGORIES order, no empty side or other group, stored category wins');
same(groupByCategory([]), [], 'groupByCategory([])', '[]');

// listProblems: every shape the app has ever saved passes (the first version
// saved no category or notes); anything else gets at least one problem. The
// server refuses such lists and the page won't show them. Problems are
// sentences for developers; their words aren't pinned.
for (const [label, list] of [
  ['an empty list', []],
  ['the first version\'s dishes (no category or notes)', [
    { id: 1, name: 'Turkey', assignedTo: '', status: 'unassigned' },
    { id: 1700000000000, name: 'Pecan pie', assignedTo: 'Alex', status: 'pending' }]],
  ['a dish as today\'s app saves it', [
    { id: 1764000000000, name: 'Wine', category: BEVERAGE, notes: '', assignedTo: 'Jo & Kim', status: 'confirmed' }]],
  ['the quals\' FIXTURE', FIXTURE],
]) {
  same(listProblems(list), [], `listProblems(${label})`, 'no problems');
}
const good = { id: 7, name: 'Wine', category: BEVERAGE, notes: 'red', assignedTo: 'Alex', status: 'pending' };
const without = (field) => Object.fromEntries(Object.entries(good).filter(([key]) => key !== field));
for (const [label, list] of [
  ['an object, not a list', { dishes: [good] }],
  ['undefined (a POST with no JSON body)', undefined],
  ['a dish that is null', [null]],
  ['a dish that is a string', ['Wine']],
  ['a field the app doesn\'t have', [{ ...good, bringer: 'Alex' }]],
  ['no id', [without('id')]],
  ['an id that is a string', [{ ...good, id: '7' }]],
  ['an id that is not a whole number', [{ ...good, id: 7.5 }]],
  ['two dishes with one id', [good, { ...good, name: 'Beer' }]],
  ['no name', [without('name')]],
  ['an empty name', [{ ...good, name: '' }]],
  ['a name ending in a space', [{ ...good, name: 'Wine ' }]],
  ['a category not in CATEGORIES', [{ ...good, category: 'Appetizer' }]],
  ['notes that are a number', [{ ...good, notes: 5 }]],
  ['notes starting with a space', [{ ...good, notes: ' red' }]],
  ['no assignedTo', [without('assignedTo')]],
  ['an assignee ending in a space', [{ ...good, assignedTo: 'Alex ' }]],
  ['an assignee that is only spaces', [{ ...good, assignedTo: '   ' }]],
  ['no status', [without('status')]],
  ['a status the app doesn\'t have', [{ ...good, status: 'maybe' }]],
  ['pending with nobody named', [{ ...good, assignedTo: '' }]],
  ['confirmed with nobody named', [{ ...good, status: 'confirmed', assignedTo: '' }]],
  ['unassigned with someone named', [{ ...good, status: 'unassigned' }]],
]) {
  const problems = listProblems(list);
  assert.ok(problems.length > 0 && problems.every((p) => typeof p === 'string' && p.length > 0), rer(
    `listProblems(${label}: ${JSON.stringify(list)})`, 'at least one problem, each a sentence', JSON.stringify(problems)));
}

console.log('qual pass: dish helpers (categories, pies, unclaimed, people, grouping, list problems)');
