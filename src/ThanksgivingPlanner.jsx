// ThanksgivingPlanner.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Check, Edit2, HelpCircle, Clock } from 'lucide-react';
import Card from './Card';
import HelpDialog from './HelpDialog';
import Schedule from './Schedule';
import {
  CATEGORIES,
  guessCategory,
  categoryOf,
  isPie,
  isUnclaimed,
  isBringing,
  allPeople,
  groupByCategory,
  listProblems,
} from './dishes';

const API_URL = '/api';  // This will be the base URL for our API

// Initial default dishes if database is empty
const DEFAULT_DISHES = [
  { id: 1, name: 'Turkey', assignedTo: '', status: 'unassigned' },
  { id: 2, name: 'Stuffing', assignedTo: '', status: 'unassigned' },
  { id: 3, name: 'Mashed Potatoes', assignedTo: '', status: 'unassigned' },
  { id: 4, name: 'Green Bean Casserole', assignedTo: '', status: 'unassigned' },
  { id: 5, name: 'Cranberry Sauce', assignedTo: '', status: 'unassigned' },
  { id: 6, name: 'Pumpkin Pie', assignedTo: '', status: 'unassigned' }
];

const VIEWS = [
  { id: 'all', label: 'Everything' },
  { id: 'mine', label: 'Mine' },
  { id: 'pies', label: 'Pies' },
  { id: 'unclaimed', label: 'Unclaimed' },
  // Not a view of the dish list, so its pill looks different: green, with a clock.
  { id: 'schedule', label: 'Schedule', aside: true },
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The URL hash for a route: #pies, #mine/Bee. Only the Mine view names a person.
const routeHash = ({ view, who }) => (view === 'mine' && who ? `mine/${encodeURIComponent(who)}` : view);

// Alert copy for a link whose part after the # isn't a view this page has.
const BAD_ROUTE = `Oops, the URL got mangled so we're just showing everything...`;

// The view lives in the URL (#pies, #mine/Bee) so a link can point straight at one.
// A hash the app wouldn't have written (routeHash) isn't guessed at: it shows the
// whole list under an alert (route.problem).
const readRoute = () => {
  const hash = window.location.hash.slice(1) || 'all';
  try {
    const [view, who = ''] = hash.split('/').map(decodeURIComponent);
    if (VIEWS.some((v) => v.id === view) && routeHash({ view, who }) === hash) return { view, who, problem: '' };
  } catch { /* a garbled %-escape: not a hash the app writes */ }
  return { view: 'all', who: '', problem: BAD_ROUTE };
};

const goTo = (view, who) => {
  window.location.hash = routeHash({ view, who });
};

// Small things this browser remembers between visits.
const ME_KEY = 'tgdinner.me';              // who you picked in the "Mine" view
const SEEN_HELP_KEY = 'tgdinner.seenHelp';  // set once the instructions have been dismissed
const recall = (key) => {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
};
const remember = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private window: fine */ }
};

// The dish list in a response, or a throw if the response failed or holds a
// list the app couldn't have saved (listProblems in dishes.js).
const listFrom = async (response) => {
  const dishes = await response.json();
  const problems = listProblems(dishes);
  if (!response.ok || problems.length > 0) throw new Error(`Bad response (${response.status}): ${problems.join(' ')}`);
  return dishes;
};

const fetchDishes = async () => listFrom(await fetch(`${API_URL}/dishes`));

const postDishes = async (dishes) => listFrom(await fetch(`${API_URL}/dishes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dishes),
}));

// Hooks for the quals (quals/app.mjs), which find elements by these and never
// by words or looks: data-dish={id} on each dish's row, data-view={id} on each
// view's button, and data-qual="..." on each control a qual uses.
const DishRow = ({ dish, showCategory, editing, setEditing, saveEdit, assign, confirm, release }) => {
  if (editing && editing.id === dish.id) {
    const set = (fields) => setEditing({ ...editing, ...fields });
    const onKeyDown = (e) => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') setEditing(null);
    };
    return (
      <li data-dish={dish.id} className="flex flex-wrap items-center gap-2 bg-white px-4 py-3">
        <input
          type="text"
          aria-label="Dish name"
          data-qual="edit-name"
          value={editing.name}
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={onKeyDown}
          className="field min-w-[8rem] flex-1 py-1.5"
          autoFocus
        />
        <select
          aria-label="Category"
          data-qual="edit-category"
          value={editing.category}
          onChange={(e) => set({ category: e.target.value })}
          className="field py-1.5"
        >
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <input
          type="text"
          aria-label="Notes"
          data-qual="edit-notes"
          placeholder="Notes (optional)"
          value={editing.notes}
          onChange={(e) => set({ notes: e.target.value })}
          onKeyDown={onKeyDown}
          className="field min-w-[8rem] flex-1 py-1.5"
        />
        <button onClick={saveEdit} data-qual="save" className="round-button bg-leaf" title="Save">
          <Check size={18} strokeWidth={3} />
        </button>
        <button onClick={() => setEditing(null)} data-qual="cancel" className="ghost-button" title="Cancel">
          <X size={18} strokeWidth={2.5} />
        </button>
      </li>
    );
  }

  return (
    <li data-dish={dish.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-[7rem] flex-1">
        <div className="text-lg font-medium leading-snug">{dish.name}</div>
        {dish.notes && <div className="text-sm text-ink/70">{dish.notes}</div>}
        {showCategory && (
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/70">{categoryOf(dish)}</div>
        )}
      </div>

      {/* Kept together so that on a narrow screen they wrap as one group */}
      <div className="ml-auto flex items-center gap-2">
        {isUnclaimed(dish) ? (
          <input
            type="text"
            aria-label={`Who is bringing ${dish.name}?`}
            data-qual="assign"
            placeholder="Assign to..."
            list="people"
            className="field w-36 py-1.5 text-sm"
            onKeyDown={(e) => {
              const name = e.target.value.trim();
              if (e.key === 'Enter' && name) {
                assign(dish.id, name);
                e.target.value = '';
              }
            }}
          />
        ) : dish.status === 'confirmed' ? (
          <>
            <span data-qual="assignee" className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-leaf px-3 py-0.5 font-medium">
              {dish.assignedTo}
              <Check size={16} strokeWidth={3} role="img" aria-label="confirmed" />
            </span>
            <button onClick={() => release(dish.id)} data-qual="release" className="ghost-button" title="Remove assignment">
              <X size={18} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <>
            {/* Dashed outline: asked, but not confirmed yet */}
            <span data-qual="assignee" className="rounded-full border-2 border-dashed border-ink/60 px-3 py-0.5 font-medium">
              {dish.assignedTo}
            </span>
            <button onClick={() => confirm(dish.id)} data-qual="confirm" className="round-button bg-cream hover:bg-leaf active:bg-leaf" title="Confirm">
              <Check size={18} strokeWidth={3} />
            </button>
            <button onClick={() => release(dish.id)} data-qual="decline" className="round-button bg-cream hover:bg-tomato active:bg-tomato" title="Decline">
              <X size={18} strokeWidth={3} />
            </button>
          </>
        )}

        <button
          onClick={() => setEditing({
            id: dish.id,
            name: dish.name,
            category: categoryOf(dish),
            notes: dish.notes || '',
          })}
          data-qual="edit"
          className="ghost-button"
          title="Edit"
        >
          <Edit2 size={18} />
        </button>
      </div>
    </li>
  );
};

const ThanksgivingPlanner = () => {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(readRoute);
  const [me, setMe] = useState(() => recall(ME_KEY));
  // The instructions open by themselves on a first visit.
  const [helpOpen, setHelpOpen] = useState(() => !recall(SEEN_HELP_KEY));
  const helpButton = useRef(null);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    remember(SEEN_HELP_KEY, '1');
    helpButton.current?.focus();
  }, []);
  const [newDish, setNewDish] = useState('');
  const [newCategory, setNewCategory] = useState('');  // '' means guess from the name
  const [editing, setEditing] = useState(null);

  // Load the list, and reload it whenever this tab comes back into view
  useEffect(() => {
    // Shows the list that `latest` gets, or the alert if it can't get one.
    const loadDishes = async (latest) => {
      try {
        setDishes(await latest());
        setError('');
      } catch (err) {
        console.error('Error loading dishes:', err);
        setError("Couldn't load the dish list. Try reloading the page.");
      }
      setLoading(false);
    };
    // The first load seeds an empty list with the default dishes; a refresh never does.
    const seeded = async () => {
      const storedDishes = await fetchDishes();
      return storedDishes.length === 0 ? postDishes(DEFAULT_DISHES) : storedDishes;
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') loadDishes(fetchDishes);
    };

    loadDishes(seeded);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Apply each change to the latest saved list rather than this tab's copy, so a
  // tab left open for days can't overwrite what everyone else has done since.
  const change = async (update) => {
    try {
      setDishes(await postDishes(update(await fetchDishes())));
      setError('');
      return true;
    } catch (err) {
      console.error('Error saving dishes:', err);
      setError("Couldn't save that change. Check your connection and try again.");
      return false;
    }
  };

  const updateDish = (id, fields) =>
    change((latest) => latest.map((dish) => (dish.id === id ? { ...dish, ...fields } : dish)));

  const addDish = async () => {
    const name = newDish.trim();
    if (!name) return;
    const dish = {
      id: Date.now(), // Use timestamp as ID for uniqueness
      name,
      category: newCategory || guessCategory(name),
      notes: '',
      assignedTo: '',
      status: 'unassigned',
    };
    if (await change((latest) => [...latest, dish])) {
      setNewDish('');
      setNewCategory('');
    }
  };

  const saveEdit = async () => {
    const name = editing.name.trim();
    if (!name) return;
    const fields = { name, category: editing.category, notes: editing.notes.trim() };
    if (await updateDish(editing.id, fields)) setEditing(null);
  };

  const rowActions = {
    editing,
    setEditing,
    saveEdit,
    assign: (id, name) => updateDish(id, { assignedTo: name, status: 'pending' }),
    confirm: (id) => updateDish(id, { status: 'confirmed' }),
    release: (id) => updateDish(id, { assignedTo: '', status: 'unassigned' }),
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-lg">
        Loading dishes...
      </div>
    );
  }

  const people = allPeople(dishes);
  const typedPerson = route.who || me;
  // Match the name however it was capitalised in the list, if it's there.
  const person = people.find((name) => name.toLowerCase() === typedPerson.toLowerCase()) || typedPerson;
  const pies = dishes.filter(isPie);
  const unclaimed = dishes.filter(isUnclaimed);
  const mine = person ? dishes.filter((dish) => isBringing(dish, person)) : [];
  const counts = { all: dishes.length, mine: person ? mine.length : null, pies: pies.length, unclaimed: unclaimed.length, schedule: null };

  const pickPerson = (name) => {
    setMe(name);
    remember(ME_KEY, name);
    goTo('mine', name);
  };

  const list = (items, showCategory) => (
    <ul className="divide-y-2 divide-dashed divide-ink/15">
      {items.map((dish) => (
        <DishRow key={dish.id} dish={dish} showCategory={showCategory} {...rowActions} />
      ))}
    </ul>
  );
  const note = (text) => <p className="px-4 py-3 text-ink/70">{text}</p>;

  return (
    <>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex items-center gap-4">
          {/* Cropped to the badge and clipped round, so none of the image's own background shows */}
          <img src="/gobble.png" alt="" width="96" height="96" className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
          <div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Thanksgiving Dinner Planner</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="rounded-full border-2 border-ink bg-cream px-3 text-sm font-medium">2026 edition</p>
              <button
                ref={helpButton}
                onClick={() => setHelpOpen(true)}
                data-qual="help"
                className="tab gap-1 bg-cream px-2.5 py-0 text-sm hover:bg-white active:bg-white"
              >
                <HelpCircle size={16} strokeWidth={2.5} />
                How it works
              </button>
            </div>
          </div>
        </header>

        {[route.problem, error].filter(Boolean).map((message) => (
          <div key={message} role="alert" className="card flex items-center gap-3 px-4 py-3 font-medium">
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-tomato font-bold"
            >
              !
            </span>
            <span>{message}</span>
          </div>
        ))}

        {/* Add new dish */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="New dish"
            data-qual="new-dish"
            value={newDish}
            onChange={(e) => setNewDish(e.target.value)}
            placeholder="Add a new dish..."
            className="field min-w-[7rem] flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addDish()}
          />
          <select
            aria-label="Category for the new dish"
            data-qual="new-category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="field"
          >
            <option value="">Category: auto</option>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <button
            onClick={addDish}
            data-qual="add"
            className="round-button h-11 w-11 bg-tomato shadow-ground-sm active:shadow-none"
            title="Add dish"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>

        {/* Views */}
        <nav aria-label="Views" className="flex flex-wrap gap-2">
          {VIEWS.map(({ id, label, aside }) => {
            const active = route.view === id;
            const idle = aside ? 'bg-leaf hover:bg-leaf/80 active:bg-leaf/80' : 'bg-cream hover:bg-white active:bg-white';
            return (
              <button
                key={id}
                data-view={id}
                onClick={() => goTo(id, person)}
                aria-pressed={active}
                className={`tab ${active ? 'bg-ink text-cream' : idle}`}
              >
                {aside && <Clock size={16} strokeWidth={2.5} />}
                {label}
                {counts[id] !== null && (
                  <span data-qual="count" className={`rounded-full px-2 text-sm ${active ? 'bg-cream text-ink' : 'bg-sand'}`}>
                    {counts[id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {route.view === 'all' && groupByCategory(dishes).map((group) => (
          <Card key={group.category} title={group.category} aside={group.dishes.length}>
            {list(group.dishes, false)}
          </Card>
        ))}

        {route.view === 'mine' && (
          <>
            <label className="flex flex-wrap items-center gap-2 text-lg font-medium">
              <span>Who are you?</span>
              <select
                value={person}
                onChange={(e) => pickPerson(e.target.value)}
                data-qual="me"
                className="field text-base font-normal"
              >
                <option value="">Pick a name...</option>
                {(people.includes(person) || !person ? people : [...people, person]).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <Card title={mine.length > 0 && `${person} is bringing ${plural(mine.length, 'dish', 'dishes')}`}>
              {!person && note('Pick your name to see what you’re bringing. Names appear here once they’re assigned a dish.')}
              {person && mine.length === 0 && note(`Nothing is assigned to ${person} yet.`)}
              {mine.length > 0 && list(mine, true)}
            </Card>
          </>
        )}

        {route.view === 'pies' && (
          <Card
            title={pies.length > 0 && `${plural(pies.length, 'pie', 'pies')} so far`}
            aside={pies.length > 0 ? `${pies.filter(isUnclaimed).length} unclaimed` : null}
          >
            {pies.length === 0
              ? note('No pies yet. Any dish with “pie” in its name shows up here.')
              : list(pies, false)}
          </Card>
        )}

        {route.view === 'unclaimed' && (
          <Card title={unclaimed.length > 0 && `${plural(unclaimed.length, 'dish needs', 'dishes need')} someone`}>
            {unclaimed.length === 0
              ? note('Every dish has someone bringing it.')
              : list(unclaimed, true)}
          </Card>
        )}

        {route.view === 'schedule' && <Schedule />}

        <datalist id="people">
          {people.map((name) => <option key={name} value={name} />)}
        </datalist>
      </div>

      {/* Outside the spaced column so it can cover the whole screen */}
      {helpOpen && <HelpDialog onClose={closeHelp} />}
    </>
  );
};

export default ThanksgivingPlanner;
