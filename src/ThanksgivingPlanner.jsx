// ThanksgivingPlanner.jsx
import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Edit2 } from 'lucide-react';
import Database from '@replit/database';


//const db = new Database();
const API_URL = '/api';  // This will be the base URL for our API

const ThanksgivingPlanner = () => {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDish, setNewDish] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Load initial data
  useEffect(() => {
    const loadDishes = async () => {
      try {
        const response = await fetch(`${API_URL}/dishes`);
        const storedDishes = await response.json();
        if (storedDishes.length === 0) {
          // Initial default dishes if database is empty
          const defaultDishes = [
            { id: 1, name: 'Turkey', assignedTo: '', status: 'unassigned' },
            { id: 2, name: 'Stuffing', assignedTo: '', status: 'unassigned' },
            { id: 3, name: 'Mashed Potatoes', assignedTo: '', status: 'unassigned' },
            { id: 4, name: 'Green Bean Casserole', assignedTo: '', status: 'unassigned' },
            { id: 5, name: 'Cranberry Sauce', assignedTo: '', status: 'unassigned' },
            { id: 6, name: 'Pumpkin Pie', assignedTo: '', status: 'unassigned' }
          ];
          await saveDishes(defaultDishes);
          setDishes(defaultDishes);
        } else {
          setDishes(storedDishes);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading dishes:', error);
        setLoading(false);
      }
    };

    loadDishes();
  }, []);


  // Save dishes to database whenever they change
  const saveDishes = async (updatedDishes) => {
    try {
      const response = await fetch(`${API_URL}/dishes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedDishes),
      });
      const savedDishes = await response.json();
      setDishes(savedDishes);
    } catch (error) {
      console.error('Error saving dishes:', error);
    }
  };

  const addDish = async () => {
    if (newDish.trim()) {
      const newDishes = [
        ...dishes,
        {
          id: Date.now(), // Use timestamp as ID for uniqueness
          name: newDish.trim(),
          assignedTo: '',
          status: 'unassigned'
        }
      ];
      await saveDishes(newDishes);
      setNewDish('');
    }
  };

  const startEdit = (dish) => {
    setEditingId(dish.id);
    setEditName(dish.name);
  };

  const saveEdit = async () => {
    if (editName.trim()) {
      const newDishes = dishes.map(dish =>
        dish.id === editingId ? { ...dish, name: editName.trim() } : dish
      );
      await saveDishes(newDishes);
      setEditingId(null);
      setEditName('');
    }
  };

  const assignDish = async (id, name) => {
    const newDishes = dishes.map(dish =>
      dish.id === id ? { ...dish, assignedTo: name, status: 'pending' } : dish
    );
    await saveDishes(newDishes);
  };

  const confirmDish = async (id) => {
    const newDishes = dishes.map(dish =>
      dish.id === id ? { ...dish, status: 'confirmed' } : dish
    );
    await saveDishes(newDishes);
  };

  const declineDish = async (id) => {
    const newDishes = dishes.map(dish =>
      dish.id === id ? { ...dish, assignedTo: '', status: 'unassigned' } : dish
    );
    await saveDishes(newDishes);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        Loading dishes...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">CaMeLot Thanksgiving Dinner Planner</h2>

      {/* Add new dish */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDish}
          onChange={(e) => setNewDish(e.target.value)}
          placeholder="Add a new dish..."
          className="flex-1 p-2 border rounded"
          onKeyPress={(e) => e.key === 'Enter' && addDish()}
        />
        <button
          onClick={addDish}
          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Dish list */}
      <div className="space-y-2">
        {dishes.map(dish => (
          <div key={dish.id} className="flex items-center gap-2 p-3 border rounded bg-white">
            {editingId === dish.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 p-1 border rounded"
                onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                autoFocus
              />
            ) : (
              <div className="flex-1 font-medium">{dish.name}</div>
            )}

            {dish.status === 'unassigned' && (
              <input
                type="text"
                placeholder="Assign to..."
                className="p-1 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value) {
                    assignDish(dish.id, e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            )}

            {dish.status === 'pending' && (
              <>
                <span className="text-gray-600">{dish.assignedTo}</span>
                <button
                  onClick={() => confirmDish(dish.id)}
                  className="p-1 text-green-600 hover:text-green-700"
                  title="Confirm"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => declineDish(dish.id)}
                  className="p-1 text-red-600 hover:text-red-700"
                  title="Decline"
                >
                  <X size={20} />
                </button>
              </>
            )}

            {dish.status === 'confirmed' && (
              <>
                <span className="text-green-600 font-medium">{dish.assignedTo} ✓</span>
                <button
                  onClick={() => declineDish(dish.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove assignment"
                >
                  <X size={20} />
                </button>
              </>
            )}

            {editingId === dish.id ? (
              <button
                onClick={saveEdit}
                className="p-1 text-blue-600 hover:text-blue-700"
              >
                <Check size={20} />
              </button>
            ) : (
              <button
                onClick={() => startEdit(dish)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <Edit2 size={20} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThanksgivingPlanner;