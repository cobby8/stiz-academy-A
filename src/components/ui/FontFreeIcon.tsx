import type { CSSProperties, ReactElement } from "react";

type FontFreeIconName =
  | "bookmark"
  | "call"
  | "campaign"
  | "chat_bubble"
  | "check_circle"
  | "chevron_left"
  | "chevron_right"
  | "close"
  | "dark_mode"
  | "expand_more"
  | "how_to_reg"
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
  | "person_add"
  | "rate_review"
  | "school"
  | "send"
  | "favorite";

type FontFreeIconProps = {
  name: FontFreeIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

const PATHS: Record<FontFreeIconName, ReactElement> = {
  bookmark: <path d="M7 4.5h10v15l-5-3-5 3z" />,
  call: <path d="M7.5 4.5 10 9l-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 2.5-1.5 3c-.4.8-1.3 1.2-2.2 1A17 17 0 0 1 3.5 8.7c-.2-.9.2-1.8 1-2.2z" />,
  campaign: <path d="M4 10v4h3l7 4V6l-7 4zm12-2.5v9m2-7v5" />,
  chat_bubble: <path d="M5 6.5h14v9H9l-4 3z" />,
  check_circle: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l2.5 2.5L16 9" />,
  chevron_left: <path d="m14.5 6-6 6 6 6" />,
  chevron_right: <path d="m9.5 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  dark_mode: <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />,
  expand_more: <path d="m7 9.5 5 5 5-5" />,
  favorite: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  how_to_reg: <path d="M8 12h6m-6 4h4m-5-8h7m3 8 2 2 4-5M5 4.5h12v6.5M5 4.5v15h9" />,
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
  person_add: <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 8a6 6 0 0 1 12 0m4-9v6m-3-3h6" />,
  rate_review: <path d="M5 5h14v10H9l-4 4zm4 4h6m-6 3h4" />,
  school: <path d="m3 9 9-5 9 5-9 5zm4 3.5V17c2.8 2 7.2 2 10 0v-4.5" />,
  send: <path d="m3.5 20 17-8-17-8 3 8zM6.5 12h14" />,
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
