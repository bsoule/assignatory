// Turns the day's schedule (src/schedule.txt) into the rows the Schedule view shows.

// A line that starts with a time ("4:30 Dinner", "2pm - Appetizers", "2:00-4:00 Games")
// gets the time in its own column; any other line is shown as written.
const TIME = String.raw`(?:\d{1,2}:\d{2}(?:\s*[ap]\.?m\b\.?)?|\d{1,2}\s*[ap]\.?m\b\.?|noon|midnight)`;
const TIMED_LINE = new RegExp(String.raw`^(${TIME}(?:\s*[-–—]\s*${TIME})?)\s*[-–—:]?\s+(.+)$`, 'i');

export const parseSchedule = (text) => text
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const match = line.match(TIMED_LINE);
    return match ? { time: match[1], what: match[2] } : { time: '', what: line };
  });
