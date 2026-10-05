// Small inline icon set (24x24, stroke based) so we don't ship an icon font.
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5',
  calendar: 'M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  crosshair: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z',
  book: 'M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16zM5 16a3.5 3.5 0 0 1 3.5-3.5H19',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.5 3.5 5.2',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  check: 'M5 12.5 10 17.5 19.5 7',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 5l7 7-7 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  trophy: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5',
  alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.2v.3',
  refresh: 'M19.5 12A7.5 7.5 0 1 1 17 6.4M19.5 4v4.5H15',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  map: 'M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2zM9 4.5v13M15 6.5v13',
  shield: 'M12 3 20 6.5v6c0 4.5-3.4 7.2-8 8.5-4.6-1.3-8-4-8-8.5v-6z',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5',
  dice: 'M5 5h14v14H5zM9 9h.5M15 9h.5M12 12h.5M9 15h.5M15 15h.5',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  user: 'M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6',
  more: 'M6 12h.5M12 12h.5M18 12h.5',
};

export default function Icon({ name, size = 20, className = '', label }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <path d={PATHS[name] ?? PATHS.more} />
    </svg>
  );
}
