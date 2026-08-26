type IconName =
  | "plus"
  | "pencil"
  | "trash"
  | "check"
  | "x"
  | "search"
  | "download"
  | "upload"
  | "sheet"
  | "collapse"
  | "expand"
  | "apply"
  | "eraser"
  | "back"
  | "drag"
  | "minimize"
  | "calculator"
  | "impact"
  | "grade"
  | "credits"
  | "clock"
  | "login"
  | "userPlus"
  | "mail";

const PATHS: Record<IconName, string> = {
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  pencil: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z",
  trash: "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  x: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z",
  download: "M5 20h14v-2H5zm7-18v10.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L12 12.17V2z",
  upload: "M5 20h14v-2H5zm7-18-5 5 1.41 1.41L11 4.83V15h2V4.83l2.59 2.58L17 7z",
  sheet: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 4H5V5h14zm-8 4v8H5v-8zm8 0v8h-6v-8z",
  collapse: "M7.41 18.59 8.83 20 12 16.83 15.17 20l1.42-1.41L12 14zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10z",
  expand: "M12 5.83 15.17 9l1.42-1.41L12 3 7.41 7.59 8.83 9zm0 12.34L8.83 15l-1.42 1.41L12 21l4.59-4.59L15.17 15z",
  apply: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z",
  eraser: "M15.14 3a2 2 0 0 1 1.41.59l3.86 3.86a2 2 0 0 1 0 2.83L11.66 19H20v2H7.5l-3.9-3.9a2 2 0 0 1 0-2.83L13.73 3.59A2 2 0 0 1 15.14 3zM6.42 15.5l3.08 3.08 3.6-3.6-3.09-3.08z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z",
  drag: "M9 4h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 5h2v2H9zm4 0h2v2h-2zm-4 5h2v2H9zm4 0h2v2h-2z",
  minimize: "M6 19h12v2H6z",
  calculator: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 4v3h10V6zm0 5v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm-8 4v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2z",
  impact: "M3 17h2v4H3zm4-6h2v10H7zm4-6h2v16h-2zm4 3h2v13h-2zm4 5h2v8h-2z",
  grade: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  credits: "M12 3 1 9l11 6 9-4.91V17h2V9zm0 12.9L5 12.1v3.3l7 3.8 7-3.8v-3.3z",
  clock: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h-5v-2h3V6h2z",
  login: "M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5zM20 19h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8z",
  userPlus: "M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-9-1V8H4v3H1v2h3v3h2v-3h3v-2zm9 3c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  mail: "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="currentColor" d={PATHS[name]} />
    </svg>
  );
}
