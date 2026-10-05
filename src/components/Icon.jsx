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
  cursor: 'M5 3.5 18.5 11l-6 1.8L9.7 19z',
  route: 'M6 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17.5h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16',
  drone: 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.5 7.5l2.5 2.5M16.5 7.5 14 10M7.5 16.5l2.5-2.5M16.5 16.5 14 14',
  diamond: 'M12 3.5 20.5 12 12 20.5 3.5 12z',
  burst: 'M12 2.5l1.8 5 5-2-2.2 4.8 5 1.7-5 1.7 2.2 4.8-5-2-1.8 5-1.8-5-5 2 2.2-4.8-5-1.7 5-1.7L5.2 5.5l5 2z',
  area: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4',
  crossfire: 'M4 5l6.5 6.5M4 19l6.5-6.5M20 12h-4M13 9.5l2.5 2.5-2.5 2.5M8 9.5V5H3.5M8 14.5V19H3.5',
  flag: 'M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11',
  note: 'M4.5 5h15v11h-9l-4 3.5V16h-2z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z',
  copy: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
  play: 'M7 4.5v15l12-7.5z',
  layers: 'M12 3.5 21 8.5 12 13.5 3 8.5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  compare: 'M10 3.5v17M14 3.5v17M4 7.5h3M4 12h3M4 16.5h3M17 7.5h3M17 12h3M17 16.5h3',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4.5l2.5 1.5M9.5 2.5h5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.5h.01',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
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
