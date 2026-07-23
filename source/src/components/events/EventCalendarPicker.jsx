import { useState } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const QUICK_PRESETS = [
  {
    label: 'This Week',
    getRange: () => {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      return { start, end: endOfWeek(new Date(), { weekStartsOn: 1 }) };
    }
  },
  {
    label: 'This Weekend',
    getRange: () => {
      const friday = addDays(startOfWeek(addWeeks(new Date(), 0), { weekStartsOn: 1 }), 4);
      return { start: friday, end: addDays(friday, 2) };
    }
  },
  {
    label: 'Next Week',
    getRange: () => {
      const start = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
      return { start, end: endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }) };
    }
  },
  {
    label: 'Next Weekend',
    getRange: () => {
      const friday = addDays(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 4);
      return { start: friday, end: addDays(friday, 2) };
    }
  },
];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const startDay = startOfWeek(first, { weekStartsOn: 1 });
  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(startDay, i));
  }
  return days;
}

export default function EventCalendarPicker({ onClose, onSelectDate }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState(today);

  const days = getDaysInMonth(viewYear, viewMonth);
  const monthLabel = format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy');

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-3xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-base">Pick a Date</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {QUICK_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { onSelectDate(p.getRange().start); }}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-primary hover:text-white hover:border-primary transition-all font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Month Nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day, i) => {
            const inMonth = day.getMonth() === viewMonth;
            const isSel = isSameDay(day, selected);
            const isTod = isToday(day);
            return (
              <button
                key={i}
                onClick={() => { setSelected(day); onSelectDate(day); }}
                className={`h-9 w-full flex items-center justify-center text-sm rounded-full transition-all
                  ${!inMonth ? 'opacity-25' : ''}
                  ${isSel ? 'bg-primary text-white font-bold' : isTod ? 'border border-primary text-primary font-semibold' : 'hover:bg-muted'}
                `}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}