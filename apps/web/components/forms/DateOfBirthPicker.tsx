"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// Three-dropdown date-of-birth picker (Year / Month / Day) instead of
// the native <input type="date">. The native picker on desktop browsers
// surfaces a calendar that's slow to scroll back 30+ years to pick a
// year, which was the actual usability complaint.
//
// API: emits a `value` string in YYYY-MM-DD form (or "" when any of
// three are empty) so the surrounding form payload contract is
// unchanged from the legacy native input.

const MIN_AGE = 13;   // COPPA-style floor — common marketplace default
const MAX_AGE = 100;

const MONTHS = [
  { v: "01", label: "January" },
  { v: "02", label: "February" },
  { v: "03", label: "March" },
  { v: "04", label: "April" },
  { v: "05", label: "May" },
  { v: "06", label: "June" },
  { v: "07", label: "July" },
  { v: "08", label: "August" },
  { v: "09", label: "September" },
  { v: "10", label: "October" },
  { v: "11", label: "November" },
  { v: "12", label: "December" },
];

function parts(value: string): { y: string; m: string; d: string } {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { y: "", m: "", d: "" };
  const [y, m, d] = value.split("-");
  return { y: y!, m: m!, d: d! };
}

function daysInMonth(y: number, m: number): number {
  // m is 1-12 here; new Date(y, m, 0) gives last day of previous month.
  return new Date(y, m, 0).getDate();
}

export function DateOfBirthPicker({
  value,
  onChange,
  className,
  selectClass,
  required = false,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** Per-select class so the surrounding form can match its own styling. */
  selectClass?: string;
  required?: boolean;
}) {
  // Local state is the source of truth for partial selections (e.g.
  // year picked but month/day still empty). Emitting "" to the parent
  // for a partial state lets the parent's required check work, but if
  // we ALSO read y/m/d back from the parent's value the dropdowns
  // would snap to "Year"/"Month"/"Day" the instant a year is picked
  // — which is exactly the bug we're fixing here.
  const [local, setLocal] = useState(() => parts(value));
  const lastEmitRef = useRef<string>(value);

  // Sync from parent when an external write happens (form reset, edit
  // profile pre-fill). Skip when the change came from our own emit
  // (lastEmitRef matches), otherwise we'd clobber the user's partial
  // state on every keystroke.
  useEffect(() => {
    if (value === lastEmitRef.current) return;
    setLocal(parts(value));
    lastEmitRef.current = value;
  }, [value]);

  const { y, m, d } = local;
  const today = new Date();
  const thisYear = today.getFullYear();

  const years = useMemo(() => {
    const out: string[] = [];
    for (let yr = thisYear - MIN_AGE; yr >= thisYear - MAX_AGE; yr--) {
      out.push(String(yr));
    }
    return out;
  }, [thisYear]);

  const days = useMemo(() => {
    if (!y || !m) {
      // Default to 31 so the picker is usable before year/month are set.
      return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
    }
    const max = daysInMonth(Number(y), Number(m));
    return Array.from({ length: max }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [y, m]);

  function emit(next: { y?: string; m?: string; d?: string }) {
    const ny = next.y ?? y;
    const nm = next.m ?? m;
    let nd = next.d ?? d;

    // Day-clamp: if month/year change makes the current day invalid
    // (e.g. Feb 30 → Feb 28), trim down rather than blank the picker.
    if (ny && nm && nd) {
      const max = daysInMonth(Number(ny), Number(nm));
      if (Number(nd) > max) nd = String(max).padStart(2, "0");
    }

    // Persist the partial state locally so the selects stay on what
    // the user picked.
    setLocal({ y: ny, m: nm, d: nd });
    const outgoing = ny && nm && nd ? `${ny}-${nm}-${nd}` : "";
    lastEmitRef.current = outgoing;
    onChange(outgoing);
  }

  const baseSelect =
    selectClass ??
    "rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-white outline-none focus:border-metu-yellow";

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      <select
        aria-label="Year of birth"
        value={y}
        onChange={(e) => emit({ y: e.target.value })}
        required={required}
        className={baseSelect}
      >
        <option value="">Year</option>
        {years.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
      <select
        aria-label="Month of birth"
        value={m}
        onChange={(e) => emit({ m: e.target.value })}
        required={required}
        className={baseSelect}
      >
        <option value="">Month</option>
        {MONTHS.map((mm) => (
          <option key={mm.v} value={mm.v}>
            {mm.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Day of birth"
        value={d}
        onChange={(e) => emit({ d: e.target.value })}
        required={required}
        className={baseSelect}
      >
        <option value="">Day</option>
        {days.map((dd) => (
          <option key={dd} value={dd}>
            {Number(dd)}
          </option>
        ))}
      </select>
    </div>
  );
}
