// Schedule.jsx
import React from 'react';
import Card from './Card';
import scheduleText from './schedule.txt?raw';  // the schedule itself: edit that file

// A line that starts with a time ("4:30 Dinner", "2pm - Appetizers", "2:00-4:00 Games")
// gets the time in its own column; any other line is shown as written.
const TIME = String.raw`(?:\d{1,2}:\d{2}\s*(?:[ap]\.?m\b\.?)?|\d{1,2}\s*[ap]\.?m\b\.?|noon|midnight)`;
const TIMED_LINE = new RegExp(String.raw`^(${TIME}(?:\s*[-–—]\s*${TIME})?)\s*[-–—:]?\s+(.+)$`, 'i');

const items = scheduleText
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const match = line.match(TIMED_LINE);
    return match ? { time: match[1], what: match[2] } : { time: '', what: line };
  });

const Schedule = () => (
  <Card title="Schedule for the day">
    {items.length === 0 ? (
      <p className="px-4 py-3 text-ink/70">The schedule isn’t posted yet.</p>
    ) : (
      <ul className="divide-y-2 divide-dashed divide-ink/15">
        {items.map((item, index) => (
          <li key={index} className="flex gap-4 px-4 py-3 text-lg leading-snug">
            {item.time && <span className="w-28 shrink-0 font-semibold">{item.time}</span>}
            <span>{item.what}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

export default Schedule;
