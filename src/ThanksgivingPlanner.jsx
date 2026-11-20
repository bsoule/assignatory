// ThanksgivingPlanner.jsx
import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Edit2 } from 'lucide-react';
import {
  CATEGORIES,
  guessCategory,
  categoryOf,
  isPie,
  isUnclaimed,
  isBringing,
  allPeople,
  groupByCategory,
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
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The view lives in the URL (#pies, #mine/Bee) so a link can point straight at one.
const readRoute = () => {
  try {
    const [view, who = ''] = window.location.hash.slice(1).split('/').map(decodeURIComponent);
    return { view: VIEWS.some((v) => v.id === view) ? view : 'all', who };
  } catch {
    return { view: 'all', who: '' };
  }
};

const goTo = (view, who) => {
  window.location.hash = who ? `${view}/${encodeURIComponent(who)}` : view;
};

// Remember who you are between visits, for the "Mine" view.
const ME_KEY = 'tgdinner.me';
const recallMe = () => {
  try { return localStorage.getItem(ME_KEY) || ''; } catch { return ''; }
};
const rememberMe = (name) => {
  try { localStorage.setItem(ME_KEY, name); } catch { /* private window: fine */ }
};

const fetchDishes = async () => {
  const response = await fetch(`${API_URL}/dishes`);
  const dishes = await response.json();
  if (!response.ok || !Array.isArray(dishes)) throw new Error(`Bad response (${response.status})`);
  return dishes;
};

const postDishes = async (dishes) => {
  const response = await fetch(`${API_URL}/dishes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dishes),
  });
  const saved = await response.json();
  if (!response.ok || !Array.isArray(saved)) throw new Error(`Bad response (${response.status})`);
  return saved;
};

const DishRow = ({ dish, showCategory, editing, setEditing, saveEdit, assign, confirm, release }) => {
  if (editing && editing.id === dish.id) {
    const set = (fields) => setEditing({ ...editing, ...fields });
    const onKeyDown = (e) => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') setEditing(null);
    };
    return (
      <div className="flex flex-wrap items-center gap-2 p-3 border rounded bg-white">
        <input
          type="text"
          aria-label="Dish name"
          value={editing.name}
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-[10rem] p-1 border rounded"
          autoFocus
        />
        <select
          aria-label="Category"
          value={editing.category}
          onChange={(e) => set({ category: e.target.value })}
          className="p-1 border rounded bg-white"
        >
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <input
          type="text"
          aria-label="Notes"
          placeholder="Notes (optional)"
          value={editing.notes}
          onChange={(e) => set({ notes: e.target.value })}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-[10rem] p-1 border rounded"
        />
        <button onClick={saveEdit} className="p-1 text-blue-600 hover:text-blue-700" title="Save">
          <Check size={20} />
        </button>
        <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border rounded bg-white">
      <div className="flex-1 min-w-[8rem]">
        <div className="font-medium">{dish.name}</div>
        {dish.notes && <div className="text-sm text-gray-500">{dish.notes}</div>}
        {showCategory && <div className="text-xs uppercase tracking-wide text-gray-400">{categoryOf(dish)}</div>}
      </div>

      {/* Kept together so that on a narrow screen they wrap as one group */}
      <div className="flex items-center gap-2 ml-auto">
        {isUnclaimed(dish) ? (
          <input
            type="text"
            aria-label={`Who is bringing ${dish.name}?`}
            placeholder="Assign to..."
            list="people"
            className="p-1 border rounded w-36"
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
            <span className="text-green-600 font-medium">{dish.assignedTo} ✓</span>
            <button
              onClick={() => release(dish.id)}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Remove assignment"
            >
              <X size={20} />
            </button>
          </>
        ) : (
          <>
            <span className="text-gray-600">{dish.assignedTo}</span>
            <button
              onClick={() => confirm(dish.id)}
              className="p-1 text-green-600 hover:text-green-700"
              title="Confirm"
            >
              <Check size={20} />
            </button>
            <button
              onClick={() => release(dish.id)}
              className="p-1 text-red-600 hover:text-red-700"
              title="Decline"
            >
              <X size={20} />
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
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Edit"
        >
          <Edit2 size={20} />
        </button>
      </div>
    </div>
  );
};

const ThanksgivingPlanner = () => {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(readRoute);
  const [me, setMe] = useState(recallMe);
  const [newDish, setNewDish] = useState('');
  const [newCategory, setNewCategory] = useState('');  // '' means guess from the name
  const [editing, setEditing] = useState(null);

  // Load the list, and reload it whenever this tab comes back into view
  useEffect(() => {
    const loadDishes = async () => {
      try {
        const storedDishes = await fetchDishes();
        setDishes(storedDishes.length === 0 ? await postDishes(DEFAULT_DISHES) : storedDishes);
        setError('');
      } catch (err) {
        console.error('Error loading dishes:', err);
        setError("Couldn't load the dish list. Try reloading the page.");
      }
      setLoading(false);
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchDishes().then(setDishes).catch(() => {});
    };

    loadDishes();
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
      <div className="max-w-2xl mx-auto p-6 text-center">
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
  const counts = { all: dishes.length, mine: person ? mine.length : null, pies: pies.length, unclaimed: unclaimed.length };

  const pickPerson = (name) => {
    setMe(name);
    rememberMe(name);
    goTo('mine', name);
  };

  const list = (items, showCategory) => (
    <div className="space-y-2">
      {items.map((dish) => (
        <DishRow key={dish.id} dish={dish} showCategory={showCategory} {...rowActions} />
      ))}
    </div>
  );
  const note = (text) => <p className="text-gray-600">{text}</p>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Thanksgiving Dinner Planner (2026 edition)</h2>

      {error && (
        <div role="alert" className="p-3 border border-red-300 rounded bg-red-50 text-red-800">{error}</div>
      )}

      {/* Add new dish */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newDish}
          onChange={(e) => setNewDish(e.target.value)}
          placeholder="Add a new dish..."
          className="flex-1 min-w-[7rem] p-2 border rounded"
          onKeyDown={(e) => e.key === 'Enter' && addDish()}
        />
        <select
          aria-label="Category for the new dish"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="p-2 border rounded bg-white"
        >
          <option value="">Category: auto</option>
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <button
          onClick={addDish}
          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
          title="Add dish"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Views */}
      <nav aria-label="Views" className="flex flex-wrap gap-2">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => goTo(id, id === 'mine' ? person : '')}
            aria-pressed={route.view === id}
            className={`px-3 py-1 rounded-full border text-sm ${
              route.view === id
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {label}{counts[id] !== null && ` (${counts[id]})`}
          </button>
        ))}
      </nav>

      {route.view === 'all' && groupByCategory(dishes).map((group) => (
        <section key={group.category} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{group.category}</h3>
          {list(group.dishes, false)}
        </section>
      ))}

      {route.view === 'mine' && (
        <section className="space-y-4">
          <label className="flex flex-wrap items-center gap-2">
            <span>Who are you?</span>
            <select
              value={person}
              onChange={(e) => pickPerson(e.target.value)}
              className="p-2 border rounded bg-white"
            >
              <option value="">Pick a name...</option>
              {(people.includes(person) || !person ? people : [...people, person]).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          {!person && note('Pick your name to see what you’re bringing. Names appear here once they’re assigned a dish.')}
          {person && mine.length === 0 && note(`Nothing is assigned to ${person} yet.`)}
          {mine.length > 0 && note(`${person} is bringing ${plural(mine.length, 'dish', 'dishes')}:`)}
          {list(mine, true)}
        </section>
      )}

      {route.view === 'pies' && (
        <section className="space-y-4">
          {pies.length === 0
            ? note('No pies yet. Any dish with “pie” in its name shows up here.')
            : note(`${plural(pies.length, 'pie', 'pies')} so far, ${pies.filter(isUnclaimed).length} still unclaimed.`)}
          {list(pies, false)}
        </section>
      )}

      {route.view === 'unclaimed' && (
        <section className="space-y-4">
          {unclaimed.length === 0 && note('Every dish has someone bringing it.')}
          {list(unclaimed, true)}
        </section>
      )}

      <datalist id="people">
        {people.map((name) => <option key={name} value={name} />)}
      </datalist>
    </div>
  );
};

export default ThanksgivingPlanner;
