import { CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { radii, spacing } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';
import { DateFieldProps } from './DateField';

export function formatDateDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const YEARS_PER_PAGE = 12;
const MONTH_SHORT_LABELS = MONTH_LABELS.map(m => m.slice(0, 3));

type PickerView = 'days' | 'months' | 'years';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Web: @react-native-community/datetimepicker has no web build at all. This
// previously fell back to the browser's own native <input type="date">, but
// its calendar popup is rendered by the browser itself — like a native
// <select> dropdown, it can't be positioned or styled from CSS, and on
// desktop it opened whichever way the browser felt like, overlapping other
// form fields below it instead of anchoring to the input (the "Date of
// Birth" popup covering Gender/Mobile Number below it). This is a small
// self-contained calendar popover instead — same value/onChange contract as
// DateField.tsx, so no call site needs to change.
//
// The popover is rendered through a portal into document.body rather than
// as an absolutely-positioned child of the trigger. React Native Web gives
// every View an explicit (non-auto) zIndex, which makes each sibling form
// field its own stacking context — a nested z-index:1000 popover can never
// out-rank a *later* sibling field's stacking context no matter how high it
// is, since the comparison happens one level up, between the two z:0 field
// wrappers, by DOM order. Escaping to body sidesteps that trap entirely; its
// position is computed from the trigger's bounding rect and kept in sync on
// scroll/resize while open.
export default function DateField({ value, onChange, minimumDate, maximumDate, defaultDate, placeholder = 'Select a date' }: DateFieldProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ?? defaultDate ?? new Date());
  const [triggerActive, setTriggerActive] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<'prev' | 'next' | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [pickerView, setPickerView] = useState<PickerView>('days');
  const [yearsPageStart, setYearsPageStart] = useState(() => Math.floor((value ?? defaultDate ?? new Date()).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Re-sync the visible month to whatever's actually selected (or the
    // default) each time the popover opens, rather than wherever it was
    // last left after a previous open/navigate.
    const resolvedViewDate = value ?? defaultDate ?? new Date();
    setViewDate(resolvedViewDate);
    setPickerView('days');
    setYearsPageStart(Math.floor(resolvedViewDate.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE);
    setIsEntered(false);
    // Flips one frame after mount so the popover transitions from its
    // closed (faded/shifted) state into place instead of snapping open.
    const raf = requestAnimationFrame(() => setIsEntered(true));

    const POPUP_WIDTH = 296;
    const updateCoords = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPUP_WIDTH - 8));
      setCoords({ top: rect.bottom + 8, left });
    };
    updateCoords();

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    // capture:true so this fires for scrolls inside any nested scrollable
    // ancestor (e.g. the registration form's ScrollView), not just window.
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const min = minimumDate ? startOfDay(minimumDate) : null;
  const max = maximumDate ? startOfDay(maximumDate) : null;
  const isDisabled = (d: Date) => (!!min && d < min) || (!!max && d > max);

  const today = startOfDay(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  const changeMonth = (delta: number) => setViewDate(new Date(year, month + delta, 1));
  const canGoPrevMonth = !min || new Date(year, month, 0) >= min;
  const canGoNextMonth = !max || new Date(year, month + 1, 1) <= max;

  const minYear = min ? min.getFullYear() : -Infinity;
  const maxYear = max ? max.getFullYear() : Infinity;
  const changeYear = (delta: number) => setViewDate(new Date(year + delta, month, 1));
  const canGoPrevYear = !min || new Date(year - 1, 11, 31) >= min;
  const canGoNextYear = !max || new Date(year + 1, 0, 1) <= max;
  const changeYearsPage = (delta: number) => setYearsPageStart(y => y + delta * YEARS_PER_PAGE);
  const canGoPrevYearsPage = yearsPageStart > minYear;
  const canGoNextYearsPage = yearsPageStart + YEARS_PER_PAGE <= maxYear;

  const openYearPicker = () => {
    setYearsPageStart(Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE);
    setPickerView('years');
  };
  const selectYear = (y: number) => {
    setViewDate(new Date(y, month, 1));
    setPickerView('months');
  };
  const selectMonth = (m: number) => {
    setViewDate(new Date(year, m, 1));
    setPickerView('days');
  };

  const headerCanGoPrev = pickerView === 'years' ? canGoPrevYearsPage : pickerView === 'months' ? canGoPrevYear : canGoPrevMonth;
  const headerCanGoNext = pickerView === 'years' ? canGoNextYearsPage : pickerView === 'months' ? canGoNextYear : canGoNextMonth;
  const headerPrev = () => {
    if (pickerView === 'years') changeYearsPage(-1);
    else if (pickerView === 'months') changeYear(-1);
    else changeMonth(-1);
  };
  const headerNext = () => {
    if (pickerView === 'years') changeYearsPage(1);
    else if (pickerView === 'months') changeYear(1);
    else changeMonth(1);
  };

  const selectDate = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const navBtnStyle = (enabled: boolean, hovered: boolean): CSSProperties => ({
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: radii.pill,
    background: hovered && enabled ? colors.raised : 'transparent',
    fontSize: 17,
    lineHeight: 1,
    padding: 0,
    cursor: enabled ? 'pointer' : 'default',
    color: colors.text,
    opacity: enabled ? 1 : 0.3,
    transition: `background-color 140ms ${EASE_OUT}`,
  });

  const gridCellStyle = (opts: { disabled: boolean; selected: boolean; current: boolean; hovered: boolean }): CSSProperties => ({
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    border: opts.current && !opts.selected ? `1.5px solid ${colors.accent}` : '1.5px solid transparent',
    fontSize: 13.5,
    fontFamily: 'inherit',
    cursor: opts.disabled ? 'default' : 'pointer',
    backgroundColor: opts.selected ? colors.accent : opts.hovered ? colors.raised : 'transparent',
    color: opts.disabled ? colors.subtext : opts.selected ? '#fff' : opts.current ? colors.accent : colors.text,
    fontWeight: opts.selected || opts.current ? 700 : 400,
    opacity: opts.disabled ? 0.32 : 1,
    transition: `background-color 120ms ${EASE_OUT}, transform 120ms ${EASE_OUT}`,
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        onMouseEnter={() => setTriggerActive(true)}
        onMouseLeave={() => setTriggerActive(false)}
        onFocus={() => setTriggerActive(true)}
        onBlur={() => setTriggerActive(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          borderRadius: radii.md,
          padding: `0 ${spacing.md}px`,
          fontSize: 15,
          textAlign: 'left',
          border: `1px solid ${isOpen || triggerActive ? colors.accent : colors.divider}`,
          backgroundColor: colors.surfaceAlt,
          color: value ? colors.text : colors.subtext,
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
          boxShadow: isOpen || triggerActive ? `0 0 0 3px ${colors.accent}26` : 'none',
          transition: `border-color 160ms ${EASE_OUT}, box-shadow 160ms ${EASE_OUT}`,
        }}
      >
        <span>{value ? formatDateDisplay(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
          <rect x="3" y="5" width="18" height="16" rx="3" stroke={colors.subtext} strokeWidth="1.8" />
          <path d="M3 9.5H21" stroke={colors.subtext} strokeWidth="1.8" />
          <path d="M8 3V6.5" stroke={colors.subtext} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 3V6.5" stroke={colors.subtext} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            // react-native-web's own <Modal> (this field is always used from
            // inside RegistrationFormModal) renders its own fixed, opaque,
            // full-screen host at z-index 9999 — since that's a sibling
            // stacking context under document.body too, this has to clear it
            // or the modal's own content paints right over the popover.
            zIndex: 10000,
            width: 296,
            boxSizing: 'border-box',
            borderRadius: radii.lg,
            border: `1px solid ${colors.divider}`,
            backgroundColor: colors.surface,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
            padding: spacing.lg,
            opacity: isEntered ? 1 : 0,
            transform: isEntered ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
            transformOrigin: 'top left',
            transition: `opacity 180ms ${EASE_OUT}, transform 180ms ${EASE_OUT}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              type="button"
              aria-label={pickerView === 'years' ? 'Previous years' : pickerView === 'months' ? 'Previous year' : 'Previous month'}
              onClick={() => headerCanGoPrev && headerPrev()}
              onMouseEnter={() => setHoveredNav('prev')}
              onMouseLeave={() => setHoveredNav(n => (n === 'prev' ? null : n))}
              disabled={!headerCanGoPrev}
              style={navBtnStyle(headerCanGoPrev, hoveredNav === 'prev')}
            >
              ‹
            </button>
            {pickerView === 'years' ? (
              <span style={{ color: colors.text, fontWeight: 700, fontSize: 14.5, letterSpacing: 0.2 }}>
                {yearsPageStart} – {yearsPageStart + YEARS_PER_PAGE - 1}
              </span>
            ) : (
              <button
                type="button"
                onClick={openYearPicker}
                onMouseEnter={() => setHoveredLabel(true)}
                onMouseLeave={() => setHoveredLabel(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '2px 8px',
                  borderRadius: radii.sm,
                  color: colors.text,
                  fontWeight: 700,
                  fontSize: 14.5,
                  letterSpacing: 0.2,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  backgroundColor: hoveredLabel ? colors.raised : 'transparent',
                  transition: `background-color 140ms ${EASE_OUT}`,
                }}
              >
                {pickerView === 'months' ? year : `${MONTH_LABELS[month]} ${year}`}
              </button>
            )}
            <button
              type="button"
              aria-label={pickerView === 'years' ? 'Next years' : pickerView === 'months' ? 'Next year' : 'Next month'}
              onClick={() => headerCanGoNext && headerNext()}
              onMouseEnter={() => setHoveredNav('next')}
              onMouseLeave={() => setHoveredNav(n => (n === 'next' ? null : n))}
              disabled={!headerCanGoNext}
              style={navBtnStyle(headerCanGoNext, hoveredNav === 'next')}
            >
              ›
            </button>
          </div>

          {pickerView === 'years' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearsPageStart + i).map((y, i) => {
                const disabled = y < minYear || y > maxYear;
                const selected = y === year;
                const current = y === today.getFullYear();
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectYear(y)}
                    onMouseEnter={() => setHoveredCell(i)}
                    onMouseLeave={() => setHoveredCell(c => (c === i ? null : c))}
                    style={gridCellStyle({ disabled, selected, current, hovered: hoveredCell === i && !disabled && !selected })}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {pickerView === 'months' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MONTH_SHORT_LABELS.map((label, m) => {
                const disabled = (!!max && new Date(year, m, 1) > max) || (!!min && new Date(year, m + 1, 0) < min);
                const selected = m === month;
                const current = year === today.getFullYear() && m === today.getMonth();
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectMonth(m)}
                    onMouseEnter={() => setHoveredCell(m)}
                    onMouseLeave={() => setHoveredCell(c => (c === m ? null : c))}
                    style={gridCellStyle({ disabled, selected, current, hovered: hoveredCell === m && !disabled && !selected })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {pickerView === 'days' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
                {WEEKDAY_LABELS.map(w => (
                  <div
                    key={w}
                    style={{
                      textAlign: 'center',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      color: colors.subtext,
                      padding: '4px 0',
                      opacity: 0.75,
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
                {cells.map(({ date, inMonth }, i) => {
                  const disabled = isDisabled(date);
                  const selected = !!value && isSameDay(date, value);
                  const isToday = isSameDay(date, today);
                  const hovered = hoveredDay === i && !disabled && !selected;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectDate(date)}
                      onMouseEnter={() => setHoveredDay(i)}
                      onMouseLeave={() => setHoveredDay(d => (d === i ? null : d))}
                      style={{
                        justifySelf: 'center',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.pill,
                        border: isToday && !selected ? `1.5px solid ${colors.accent}` : '1.5px solid transparent',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        cursor: disabled ? 'default' : 'pointer',
                        backgroundColor: selected ? colors.accent : hovered ? colors.raised : 'transparent',
                        color: disabled ? colors.subtext : selected ? '#fff' : isToday ? colors.accent : colors.text,
                        fontWeight: selected || isToday ? 700 : 400,
                        opacity: disabled ? 0.32 : !inMonth ? 0.4 : 1,
                        transform: selected ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: selected ? `0 2px 8px ${colors.accent}59` : 'none',
                        transition: `background-color 120ms ${EASE_OUT}, transform 120ms ${EASE_OUT}, box-shadow 120ms ${EASE_OUT}`,
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
