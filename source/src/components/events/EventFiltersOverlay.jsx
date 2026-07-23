import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CAPACITY_OPTIONS = [
  { label: '1–50', min: 0, max: 50 },
  { label: '50–100', min: 50, max: 100 },
  { label: '100+', min: 100, max: 999 },
];

const TIME_PRESETS = [
  { label: 'Morning', from: 5, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 21 },
  { label: 'Night', from: 21, to: 24 },
];

export default function EventFiltersOverlay({ filters, onApply, onClose, availableCities, sports }) {
  const [local, setLocal] = useState({ ...filters });

  const toggleSport = (s) => {
    setLocal(f => ({
      ...f,
      sports: f.sports.includes(s) ? f.sports.filter(x => x !== s) : [...f.sports, s]
    }));
  };

  const toggleCity = (c) => {
    setLocal(f => ({
      ...f,
      cities: f.cities.includes(c) ? f.cities.filter(x => x !== c) : [...f.cities, c]
    }));
  };

  const setCapacity = (opt) => {
    setLocal(f => ({ ...f, capacityMin: opt.min, capacityMax: opt.max }));
  };

  const setTimePreset = (p) => {
    setLocal(f => ({ ...f, timeFrom: p.from, timeTo: p.to }));
  };

  const clearAll = () => {
    setLocal({ sports: [], cities: [], timeFrom: 0, timeTo: 24, capacityMin: 0, capacityMax: 999 });
  };

  const activeCapacity = CAPACITY_OPTIONS.find(o => o.min === local.capacityMin && o.max === local.capacityMax);
  const activeTime = TIME_PRESETS.find(p => p.from === local.timeFrom && p.to === local.timeTo);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sticky top-0 bg-card pt-4 pb-3 px-5 border-b border-border/50 z-10">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base">Filters</h2>
            <div className="flex items-center gap-2">
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
              <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 space-y-6">
          {/* Sport */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity Type</h3>
            <div className="flex flex-wrap gap-2">
              {sports.map(s => {
                const active = local.sports.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSport(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active ? 'bg-primary text-white border-primary' : 'border-border bg-muted hover:border-primary/40'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 inline mr-1" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Time of Day</h3>
            <div className="grid grid-cols-4 gap-2">
              {TIME_PRESETS.map(p => {
                const active = activeTime?.label === p.label;
                return (
                  <button
                    key={p.label}
                    onClick={() => setTimePreset(p)}
                    className={`py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                      active ? 'bg-primary text-white border-primary' : 'border-border bg-muted hover:border-primary/40'
                    }`}
                  >
                    <div>{p.label}</div>
                    <div className={`text-[10px] mt-0.5 ${active ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {p.from}:00–{p.to}:00
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Group Size</h3>
            <div className="flex gap-2">
              {CAPACITY_OPTIONS.map(opt => {
                const active = activeCapacity?.label === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setCapacity(opt)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                      active ? 'bg-primary text-white border-primary' : 'border-border bg-muted hover:border-primary/40'
                    }`}
                  >
                    {opt.label} spots
                  </button>
                );
              })}
            </div>
          </div>

          {/* City */}
          {availableCities.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Location</h3>
              <div className="flex flex-wrap gap-2">
                {availableCities.map(city => {
                  const active = local.cities.includes(city);
                  return (
                    <button
                      key={city}
                      onClick={() => toggleCity(city)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active ? 'bg-primary text-white border-primary' : 'border-border bg-muted hover:border-primary/40'
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button className="w-full rounded-full" onClick={() => onApply(local)}>
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}