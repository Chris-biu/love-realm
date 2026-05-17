"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./session-shell.module.css";

type SessionNavProps = {
  sessionId: string;
};

const items = [
  { href: "", label: "剧情" },
  { href: "/memory", label: "回忆" },
  { href: "/relationships", label: "关系" },
  { href: "/backstage", label: "幕后" },
];

export function SessionNav({ sessionId }: SessionNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="会话页面导航">
      {items.map((item) => {
        const href = `/session/${sessionId}${item.href}`;
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
