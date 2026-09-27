const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M8.5 9.5c0-1.2 1.5-2 3.5-2s3.5.8 3.5 2-1 2-3.5 2-3.5.8-3.5 2 1.5 2 3.5 2 3.5-.8 3.5-2"/>',
  work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  life: '<path d="M12 21c-5-3-8-6-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 5-3 8-8 11Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.5-.7-1.6 1-1.8-2.2-2.2-1.8 1L11.5 5 11 3H8l-.5 2-1.6.7-1.8-1L1.9 6.9l1 1.8L2.2 10.5l-2 .5v3l2 .5.7 1.6-1 1.8 2.2 2.2 1.8-1 1.6.7.5 2h3l.5-2 1.6-.7 1.8 1 2.2-2.2-1-1.8.7-1.6z" transform="translate(2 -1) scale(.85)"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4"/>',
  wallet: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M16 14h2M6 6V4h12"/>',
  sparkle: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  notes: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  upload: '<path d="M12 17V5m-4 4 4-4 4 4M4 17v4h16v-4"/>'
};

export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
}
