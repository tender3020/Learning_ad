import { useEffect, useRef } from "react";
import MobileSideDrawer from "@/components/ui/MobileSideDrawer";

export type TocItem = { id: string; title: string };

type ReadingTocProps = {
  items: TocItem[];
  activeId?: string;
  activeTitle?: string;
  onNavigate: (id: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function ReadingToc({
  items,
  activeId,
  activeTitle,
  onNavigate,
  mobileOpen = false,
  onMobileClose,
}: ReadingTocProps) {
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const resolvedActiveTitle =
    activeTitle ?? items.find((item) => item.id === activeId)?.title;

  useEffect(() => {
    if (!mobileOpen) return;
    requestAnimationFrame(() => {
      activeItemRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [mobileOpen, activeId]);

  if (items.length === 0) return null;

  const renderList = (variant: "desktop" | "drawer") => (
    <nav className="reading-toc" aria-label="章节目录">
      {variant === "desktop" && <p className="reading-toc__heading">本章目录</p>}
      <ul className={`reading-toc__list ${variant === "drawer" ? "reading-toc__list--drawer" : ""}`}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              ref={activeId === item.id ? activeItemRef : undefined}
              type="button"
              className={`reading-toc__link ${activeId === item.id ? "reading-toc__link--active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <aside className="reading-toc-desktop hidden lg:block">{renderList("desktop")}</aside>

      <MobileSideDrawer
        open={mobileOpen}
        onClose={() => onMobileClose?.()}
        title="本章目录"
        subtitle={resolvedActiveTitle ? `当前：${resolvedActiveTitle}` : undefined}
      >
        {renderList("drawer")}
      </MobileSideDrawer>
    </>
  );
}
