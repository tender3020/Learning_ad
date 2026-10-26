import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  READING_FONTS,
  readingFontStack,
  type ReadingFontFamily,
} from "@/lib/reading-fonts";

const FONTS_PER_PAGE = 3;
const PAGE_TURN_RATIO = 0.2;
const PAGE_TURN_VELOCITY = 0.4;
const DRAG_CLICK_PX = 8;

type FontStripProps = {
  open: boolean;
  value: ReadingFontFamily;
  loading?: ReadingFontFamily | null;
  onSelect: (id: ReadingFontFamily) => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
  lastT: number;
  vx: number;
  dx: number;
  from: number;
  moved: boolean;
};

function paginate<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function pageOf(id: ReadingFontFamily) {
  const index = Math.max(0, READING_FONTS.findIndex((font) => font.id === id));
  return Math.floor(index / FONTS_PER_PAGE);
}

/** 一屏三个字体胶囊，手指或鼠标左右拖翻页；第一页不能再往右，最后一页不能再往左。 */
export default function FontStrip({ open, value, loading = null, onSelect }: FontStripProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const ignoreClickRef = useRef(false);
  const pages = paginate(READING_FONTS, FONTS_PER_PAGE);
  const lastPage = Math.max(0, pages.length - 1);

  const widthOf = () => viewportRef.current?.clientWidth ?? 0;

  const setTrack = (page: number, dx: number, animate: boolean) => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;
    const width = viewport.clientWidth;
    viewport.style.setProperty("--font-strip-width", `${width}px`);
    track.style.transition = animate ? "transform 0.28s ease-out" : "none";
    track.style.transform = `translate3d(${-page * width + dx}px, 0, 0)`;
  };

  const goToPage = (next: number, animate: boolean) => {
    const page = Math.max(0, Math.min(lastPage, next));
    pageRef.current = page;
    setTrack(page, 0, animate);
  };

  const stopDrag = (animate: boolean) => {
    dragRef.current = null;
    goToPage(pageRef.current, animate);
  };

  useEffect(() => {
    if (!open) return;
    goToPage(pageOf(value), false);
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (dragRef.current) return;
      setTrack(pageRef.current, 0, false);
    });
    ro.observe(viewport);
    return () => ro.disconnect();
    // 只在打开面板时跳到当前字体所在页，选中时不要把用户正在翻的页拽回去。
  }, [open, lastPage]);

  useEffect(() => {
    if (loading) stopDrag(false);
  }, [loading]);

  const clampDrag = (from: number, dx: number) => {
    if (from <= 0 && dx > 0) return 0;
    if (from >= lastPage && dx < 0) return 0;
    return dx;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    ignoreClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastT: performance.now(),
      vx: 0,
      dx: 0,
      from: pageRef.current,
      moved: false,
    };
    setTrack(pageRef.current, 0, false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.vx = (event.clientX - drag.lastX) / dt;
    drag.lastX = event.clientX;
    drag.lastT = now;
    const raw = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(raw) <= DRAG_CLICK_PX) return;
      drag.moved = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic / already released */
      }
    }
    event.preventDefault();
    drag.dx = clampDrag(drag.from, raw);
    setTrack(drag.from, drag.dx, false);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    ignoreClickRef.current = true;
    const width = widthOf() || 1;
    let next = drag.from;
    if (drag.dx < -width * PAGE_TURN_RATIO || drag.vx < -PAGE_TURN_VELOCITY) next = drag.from + 1;
    else if (drag.dx > width * PAGE_TURN_RATIO || drag.vx > PAGE_TURN_VELOCITY) next = drag.from - 1;
    goToPage(next, true);
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ignoreClickRef.current) return;
    ignoreClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={viewportRef}
      className="reading-settings-fonts"
      role="listbox"
      aria-label="字体，左右滑动查看更多"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div ref={trackRef} className="reading-settings-fonts__track">
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="reading-settings-fonts__page">
            {page.map((font) => (
              <button
                key={font.id}
                type="button"
                role="option"
                aria-selected={value === font.id}
                disabled={loading !== null}
                className={`reading-settings-font ${value === font.id ? "is-active" : ""}`}
                style={{ fontFamily: readingFontStack(font.id) }}
                onClick={() => onSelect(font.id)}
              >
                {loading === font.id ? <Loader2 size={12} className="animate-spin" /> : null}
                {font.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
