import type { CSSProperties, ReactElement } from "react";

export type FontFreeIconName =
  | "arrow_back"
  | "arrow_forward"
  | "attach_file"
  | "auto_fix_high"
  | "bookmark"
  | "calendar_today"
  | "call"
  | "campaign"
  | "chat_bubble"
  | "check"
  | "check_circle"
  | "checkroom"
  | "child_care"
  | "chevron_left"
  | "chevron_right"
  | "close"
  | "dark_mode"
  | "download"
  | "error"
  | "expand_more"
  | "how_to_reg"
  | "home"
  | "image"
  | "light_mode"
  | "location_on"
  | "logout"
  | "mail"
  | "menu"
  | "more_horiz"
  | "notifications"
  | "notifications_off"
  | "open_in_new"
  | "payments"
  | "person"
  | "person_add"
  | "play_arrow"
  | "progress_activity"
  | "push_pin"
  | "rate_review"
  | "school"
  | "send"
  | "sports_basketball"
  | "verified"
  | "favorite";

type FontFreeIconProps = {
  name: FontFreeIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

const PATHS: Record<FontFreeIconName, ReactElement> = {
  arrow_back: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrow_forward: <path d="M5 12h14m-6-6 6 6-6 6" />,
  attach_file: <path d="m21 8.5-9.5 9.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 1 1-2.8-2.8l8.5-8.5" />,
  auto_fix_high: <path d="m4 20 10-10m-1-5 1 2 2 1-2 1-1 2-1-2-2-1 2-1zm6 5 .8 1.6 1.7.8-1.7.8L18 15l-.8-1.6-1.7-.8 1.7-.8zM5 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />,
  bookmark: <path d="M7 4.5h10v15l-5-3-5 3z" />,
  calendar_today: <path d="M7 3v3m10-3v3M4 8h16M5 5h14v15H5z" />,
  call: <path d="M7.5 4.5 10 9l-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 2.5-1.5 3c-.4.8-1.3 1.2-2.2 1A17 17 0 0 1 3.5 8.7c-.2-.9.2-1.8 1-2.2z" />,
  campaign: <path d="M4 10v4h3l7 4V6l-7 4zm12-2.5v9m2-7v5" />,
  chat_bubble: <path d="M5 6.5h14v9H9l-4 3z" />,
  check: <path d="m5 12 4 4 10-10" />,
  check_circle: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l2.5 2.5L16 9" />,
  checkroom: <path d="M12 7a2.5 2.5 0 1 0-2.5-2.5M12 7v2l-7 5.5V20h14v-5.5L12 9" />,
  child_care: <path d="M9 10h.1M15 10h.1M8.5 14a4.5 4.5 0 0 0 7 0M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0zm3-5 2 2m8-2-2 2" />,
  chevron_left: <path d="m14.5 6-6 6 6 6" />,
  chevron_right: <path d="m9.5 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  dark_mode: <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />,
  download: <path d="M12 4v10m-4-4 4 4 4-4M5 20h14" />,
  error: <path d="M12 8v5m0 4h.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  expand_more: <path d="m7 9.5 5 5 5-5" />,
  favorite: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  how_to_reg: <path d="M8 12h6m-6 4h4m-5-8h7m3 8 2 2 4-5M5 4.5h12v6.5M5 4.5v15h9" />,
  home: <path d="m3 11 9-7 9 7v9h-6v-6H9v6H3z" />,
  image: <path d="M4 5h16v14H4zm3 10 3.5-4 3 3 2-2.5L20 16M8 8.5h.1" />,
  light_mode: <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />,
  location_on: <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  logout: <path d="M10 5H5v14h5m4-11 4 4-4 4m4-4H9" />,
  mail: <path d="M4 6.5h16v11H4zm0 1 8 6 8-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more_horiz: <path d="M7 12h.1M12 12h.1M17 12h.1" />,
  notifications: <path d="M18 16H6l2-2V9a4 4 0 0 1 8 0v5zm-4 2a2 2 0 0 1-4 0" />,
  notifications_off: <path d="m4 4 16 16M18 16H8m0 0 1-1V9a4 4 0 0 1 5-3.9M14 18a2 2 0 0 1-4 0" />,
  open_in_new: <path d="M14 4h6v6m0-6-9 9M10 5H5v14h14v-5" />,
  payments: <path d="M4 7h16v10H4zm0 3h16m-5 4h2" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />,
  person_add: <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 8a6 6 0 0 1 12 0m4-9v6m-3-3h6" />,
  play_arrow: <path d="M8 5v14l11-7z" />,
  progress_activity: <path d="M12 3a9 9 0 1 0 9 9M12 3v4m0-4a9 9 0 0 1 8.5 6" />,
  push_pin: <path d="m14 4 6 6-3 1-4 4v5l-2 2-3-6-6-3 2-2h5l4-4z" />,
  rate_review: <path d="M5 5h14v10H9l-4 4zm4 4h6m-6 3h4" />,
  school: <path d="m3 9 9-5 9 5-9 5zm4 3.5V17c2.8 2 7.2 2 10 0v-4.5" />,
  send: <path d="m3.5 20 17-8-17-8 3 8zM6.5 12h14" />,
  sports_basketball: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM4.5 8h15M4.5 16h15M12 3c2.5 2.4 3.5 5.4 3.5 9s-1 6.6-3.5 9M12 3C9.5 5.4 8.5 8.4 8.5 12s1 6.6 3.5 9" />,
  verified: <path d="m12 3 2 2.5 3.2-.2.8 3.1 2.7 1.6-1.5 2.8.8 3.1-3.1.9-1.7 2.7-3.2-1.4-3.2 1.4-1.7-2.7-3.1-.9.8-3.1L3.3 10l2.7-1.6.8-3.1 3.2.2zm-3 9 2 2 4-5" />,
};

export default function FontFreeIcon({
  name,
  size = 20,
  className = "",
  style,
  title,
}: FontFreeIconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      height={size}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={style}
      viewBox="0 0 24 24"
      width={size}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
