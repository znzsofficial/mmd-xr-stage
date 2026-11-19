// Local line icons: file pickers and the XR entry affordance also work offline.
const paths = {
  screen:'M3 4.5h18v13H3z M12 17.5V21m-4 0h8', pause:'M8 5h2v14H8z M14 5h2v14h-2z',
  studio: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z M3.5 7.8l8.5 4.3 8.5-4.3 M12 12v8.5 M7.3 5.3l9 4.5',
  folder: 'M3 17.5V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1 M3 17.5l2.5-7h16l-2.3 8a2 2 0 0 1-1.9 1.5H5a2 2 0 0 1-2-2.5z',
  archive: 'M5 4h14v16H5z M10 4v4h3V4 M10.5 12h3',
  down: 'm6 9 6 6 6-6', arrow: 'M4 12h15m-6-6 6 6-6 6',
  tune: 'M3 7h5m4 0h9M3 17h11m4 0h3 M8 4v6m8 4v6', trash: 'M4 6h16m-13 0 1 14h8l1-14M9 6V3h6v3m-4 3v8m3-8v8',
  headset: 'M4 7c4-2 12-2 16 0l2 8a2.5 2.5 0 0 1-3.5 3l-5-2a4 4 0 0 0-3 0l-5 2A2.5 2.5 0 0 1 2 15z M6 10v2m12-2v2',
  alert: 'm12 3 10 17H2z M12 9v4m0 3v.2', check: 'm5 12 4 4L19 6',
  search:'M16 16l5 5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  link:'m9 15 6-6m-4-2 2-2a4 4 0 0 1 6 6l-2 2m-4 4-2 2a4 4 0 0 1-6-6l2-2',
  refresh:'M20 9a8 8 0 1 0 0 6M20 3v6h-6', play:'m8 5 11 7-11 7z',
  window:'M3 4h18v16H3z M10 4v16m0-10h11', bag:'M5 8h14l1 12H4z M9 8V6a3 3 0 0 1 6 0v2',
} as const;
export function PrepIcon({name,size=18,className}: {name:keyof typeof paths;size?:number;className?:string}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
