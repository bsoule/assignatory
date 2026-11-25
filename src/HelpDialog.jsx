// HelpDialog.jsx
import React, { useEffect, useRef } from 'react';
import { Plus, X, Check, List, Clock, Users } from 'lucide-react';

// A picture of one of the page's round buttons, so people know what to look for.
const Chip = ({ className, children }) => (
  <span aria-hidden="true" className={`round-button pointer-events-none ${className}`}>{children}</span>
);

const Pill = ({ children }) => (
  <span className="whitespace-nowrap rounded-full border-2 border-ink bg-cream px-2 text-base font-medium">
    {children}
  </span>
);

const Step = ({ chip, children }) => (
  <li className="flex items-start gap-3">
    {chip}
    <p className="pt-0.5 text-lg leading-snug">{children}</p>
  </li>
);

const HelpDialog = ({ onClose }) => {
  const closeButton = useRef(null);

  useEffect(() => {
    closeButton.current.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      // "Got it" is the only control in the dialog, so Tab stays on it.
      if (e.key === 'Tab') e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="card flex max-h-full w-full max-w-md flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="help-title" className="border-b-2 border-ink bg-leaf px-4 py-2 text-xl font-semibold">
          How it works
        </h2>

        <ul className="space-y-4 overflow-y-auto p-4">
          <Step chip={<Chip className="bg-tomato"><Plus size={20} strokeWidth={3} /></Chip>}>
            <strong className="font-semibold">Add a dish.</strong> Type it in the box at the top, then tap the red plus.
          </Step>
          <Step chip={<Chip className="bg-cream"><Check size={18} strokeWidth={3} /></Chip>}>
            <strong className="font-semibold">Bringing your dish?</strong> Tap the check next to your name.
          </Step>
          <Step chip={<Chip className="bg-cream"><X size={18} strokeWidth={3} /></Chip>}>
            <strong className="font-semibold">Can’t bring it, or it should be someone else’s?</strong> Tap
            the X to clear the name.
          </Step>
          <Step chip={<Chip className="bg-sand"><List size={18} strokeWidth={2.5} /></Chip>}>
            <strong className="font-semibold">See the menu.</strong> <Pill>Everything</Pill> shows the whole
            list. <Pill>Unclaimed</Pill> shows what still needs someone.
          </Step>
          <Step chip={<Chip className="bg-sand"><Clock size={18} strokeWidth={2.5} /></Chip>}>
            <strong className="font-semibold">Plan for the day.</strong> <Pill>Schedule</Pill> shows what’s
            happening when.
          </Step>
          <Step chip={<Chip className="bg-sand"><Users size={18} strokeWidth={2.5} /></Chip>}>
            <strong className="font-semibold">We’re expecting 13 people this year.</strong>
          </Step>
        </ul>

        <div className="border-t-2 border-dashed border-ink/15 px-4 py-3 text-right">
          <button ref={closeButton} onClick={onClose} data-qual="close-help" className="tab bg-ink px-5 py-1.5 text-lg text-cream">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpDialog;
