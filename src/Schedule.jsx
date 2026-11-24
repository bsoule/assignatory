// Schedule.jsx
import React from 'react';
import Card from './Card';
import scheduleText from './schedule.txt?raw';  // the schedule itself: edit that file
import { parseSchedule } from './parseSchedule';

const items = parseSchedule(scheduleText);

const Schedule = () => (
  <Card title="Schedule for the day">
    {items.length === 0 ? (
      <p className="px-4 py-3 text-ink/70">The schedule isn’t posted yet.</p>
    ) : (
      <ul className="divide-y-2 divide-dashed divide-ink/15">
        {items.map((item, index) => (
          <li key={index} data-qual="schedule-item" className="flex gap-4 px-4 py-3 text-lg leading-snug">
            {item.time && <span data-qual="time" className="w-28 shrink-0 font-semibold">{item.time}</span>}
            <span data-qual="what">{item.what}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

export default Schedule;
