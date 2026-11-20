// Card.jsx
import React from 'react';

// A cream card with an optional green title strip.
const Card = ({ title, aside, children }) => (
  <section className="card">
    {title && (
      <h3 className="flex items-baseline justify-between gap-3 border-b-2 border-ink bg-leaf px-4 py-2 text-lg font-semibold">
        <span>{title}</span>
        {aside != null && <span className="text-sm font-medium">{aside}</span>}
      </h3>
    )}
    {children}
  </section>
);

export default Card;
