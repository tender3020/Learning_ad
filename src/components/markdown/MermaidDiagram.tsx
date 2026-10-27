import { memo, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mermaid from "mermaid";

type Palette = "dark" | "light" | "warm";

function isLightTheme() {
  return document.documentElement.classList.contains("theme-light");
}

function readContext(el: HTMLElement | null): { palette: Palette; fontFamily: string } {
  const shell = el?.closest(".reading-shell") as HTMLElement | null;
  let palette: Palette = "dark";
  if (shell?.classList.contains("reading-shell--warm")) {
    palette = "warm";
  } else if (shell?.classList.contains("reading-shell--soft-dark")) {
    palette = "dark";
  } else if (isLightTheme()) {
    palette = "light";
  }
  const fontFamily =
    (shell ? getComputedStyle(shell).getPropertyValue("--reading-font-family") : "").trim() ||
    "system-ui, sans-serif";
  return { palette, fontFamily };
}

function themeVariables(palette: Palette) {
  if (palette === "warm") {
    return {
      primaryColor: "#E8DFD2",
      primaryTextColor: "#2A2520",
      primaryBorderColor: "#8A7E70",
      lineColor: "#8A7E70",
      secondaryColor: "#F4EDE4",
      tertiaryColor: "#FFF8F0",
      background: "transparent",
      mainBkg: "#EFE6D8",
      textColor: "#3D3835",
      nodeBorder: "#8A7E70",
      clusterBkg: "#E8DFD2",
      titleColor: "#2A2520",
      edgeLabelBackground: "#F4EDE4",
    };
  }
  if (palette === "light") {
    return {
      primaryColor: "#E8E8EC",
      primaryTextColor: "#1C1C1E",
      primaryBorderColor: "#6E6E76",
      lineColor: "#636366",
      secondaryColor: "#F2F2F7",
      tertiaryColor: "#FFFFFF",
      background: "transparent",
      mainBkg: "#F2F2F7",
      textColor: "#3A3A3C",
      nodeBorder: "#8E8E96",
      clusterBkg: "#F2F2F7",
      titleColor: "#1C1C1E",
      edgeLabelBackground: "#FFFFFF",
    };
  }
  return {
    primaryColor: "#2C2C30",
    primaryTextColor: "#F2F2F4",
    primaryBorderColor: "#8E8E96",
    lineColor: "#A1A1A6",
    secondaryColor: "#1C1C1E",
    tertiaryColor: "#121214",
    background: "transparent",
    mainBkg: "#2A2A2E",
    textColor: "#E4E4E8",
    nodeBorder: "#8E8E96",
    clusterBkg: "#1C1C1E",
    titleColor: "#F5F5F7",
    edgeLabelBackground: "#1C1C1E",
  };
}

function configureMermaid(palette: Palette, fontFamily: string) {
  mermaid.initialize({
    startOnLoad: false,
    theme: palette === "dark" ? "dark" : "base",
    themeVariables: themeVariables(palette),
    securityLevel: "strict",
    fontFamily,
    flowchart: {
      htmlLabels: true,
      curve: "basis",
      padding: 12,
      nodeSpacing: 36,
      rankSpacing: 32,
    },
  });
}

function readSvgNaturalSize(svg: SVGSVGElement): { w: number; h: number } | null {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height };
  const widthAttr = svg.getAttribute("width") ?? "";
  const heightAttr = svg.getAttribute("height") ?? "";
  if (!widthAttr.includes("%") && !heightAttr.includes("%")) {
    const w = Number.parseFloat(widthAttr);
    const h = Number.parseFloat(heightAttr);
    if (w > 0 && h > 0) return { w, h };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) return { w: box.width, h: box.height };
  } catch {
    /* SVG not in DOM yet */
  }
  return null;
}

function fitSvgToStage(svg: SVGSVGElement, availW: number, availH: number) {
  const size = readSvgNaturalSize(svg);
  if (!size || availW <= 0 || availH <= 0) return;
  svg.style.maxWidth = "none";
  svg.style.maxHeight = "none";
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const contain = Math.min(availW / size.w, availH / size.h);
  const scale = Math.min(contain, 1.35);
  svg.style.width = `${size.w * scale}px`;
  svg.style.height = `${size.h * scale}px`;
}

const LIGHTBOX_MIN_SCALE = 1;
const LIGHTBOX_MAX_SCALE = 4;
const LIGHTBOX_TAP_PX = 8;

type Point = { x: number; y: number };
type View = { scale: number; tx: number; ty: number };

function swallowGhostTap() {
  const stop = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  document.addEventListener("pointerup", stop, true);
  document.addEventListener("click", stop, true);
  window.setTimeout(() => {
    document.removeEventListener("pointerup", stop, true);
    document.removeEventListener("click", stop, true);
  }, 400);
}

function clampLightboxView(view: View, contentW: number, contentH: number, stageW: number, stageH: number): View {
  const scale = Math.max(LIGHTBOX_MIN_SCALE, Math.min(LIGHTBOX_MAX_SCALE, view.scale));
  if (scale <= 1.001) return { scale: 1, tx: 0, ty: 0 };
  const maxX = Math.max(0, contentW * scale - stageW) / 2;
  const maxY = Math.max(0, contentH * scale - stageH) / 2;
  return {
    scale,
    tx: Math.max(-maxX, Math.min(maxX, view.tx)),
    ty: Math.max(-maxY, Math.min(maxY, view.ty)),
  };
}

function MermaidLightbox({ svgHtml, onClose }: { svgHtml: string; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<"none" | "pan" | "pinch">("none");
  const pinchRef = useRef({ dist: 1, localX: 0, localY: 0, scale: 1 });
  const panRef = useRef({ id: -1, x: 0, y: 0, tx: 0, ty: 0 });
  const movedRef = useRef(false);
  const pinchedRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  const paint = (next: View, animate = false) => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const view = clampLightboxView(next, canvas.offsetWidth, canvas.offsetHeight, stage.clientWidth, stage.clientHeight);
    viewRef.current = view;
    canvas.style.transition = animate ? "transform 0.22s ease-out" : "none";
    canvas.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    setZoomed(view.scale > 1.01);
  };

  const resetView = (animate: boolean) => paint({ scale: 1, tx: 0, ty: 0 }, animate);

  const close = () => {
    swallowGhostTap();
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (viewRef.current.scale > 1.01) {
        resetView(true);
        return;
      }
      swallowGhostTap();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const block = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    root.addEventListener("touchmove", block, { passive: false });
    return () => root.removeEventListener("touchmove", block);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const svg = canvas.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    const fit = () => {
      fitSvgToStage(svg, Math.max(1, stage.clientWidth - 24), Math.max(1, stage.clientHeight - 24));
      paint(viewRef.current);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [svgHtml]);

  const stagePoint = (point: Point) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return { x: point.x - (rect.left + rect.width / 2), y: point.y - (rect.top + rect.height / 2) };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    const pts = [...pointersRef.current.values()];
    if (pts.length >= 2 && pts[0] && pts[1]) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = stagePoint({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
      const view = viewRef.current;
      pinchRef.current = {
        dist,
        scale: view.scale,
        localX: (mid.x - view.tx) / view.scale,
        localY: (mid.y - view.ty) / view.scale,
      };
      gestureRef.current = "pinch";
      pinchedRef.current = true;
      movedRef.current = true;
      return;
    }
    gestureRef.current = viewRef.current.scale > 1.01 ? "pan" : "none";
    panRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tx: viewRef.current.tx,
      ty: viewRef.current.ty,
    };
    movedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointersRef.current.values()];
    if (gestureRef.current === "pinch" && pts.length >= 2 && pts[0] && pts[1]) {
      event.preventDefault();
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = stagePoint({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
      const pinch = pinchRef.current;
      const scale = pinch.scale * (dist / pinch.dist);
      paint({
        scale,
        tx: mid.x - pinch.localX * Math.max(LIGHTBOX_MIN_SCALE, Math.min(LIGHTBOX_MAX_SCALE, scale)),
        ty: mid.y - pinch.localY * Math.max(LIGHTBOX_MIN_SCALE, Math.min(LIGHTBOX_MAX_SCALE, scale)),
      });
      return;
    }
    if (gestureRef.current === "pan" && panRef.current.id === event.pointerId) {
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      if (Math.hypot(dx, dy) > LIGHTBOX_TAP_PX) movedRef.current = true;
      event.preventDefault();
      paint({ scale: viewRef.current.scale, tx: panRef.current.tx + dx, ty: panRef.current.ty + dy });
      return;
    }
    const dx = event.clientX - panRef.current.x;
    const dy = event.clientY - panRef.current.y;
    if (Math.hypot(dx, dy) > LIGHTBOX_TAP_PX) movedRef.current = true;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size >= 1) {
      const entry = [...pointersRef.current.entries()][0];
      if (entry && viewRef.current.scale > 1.01) {
        gestureRef.current = "pan";
        panRef.current = {
          id: entry[0],
          x: entry[1].x,
          y: entry[1].y,
          tx: viewRef.current.tx,
          ty: viewRef.current.ty,
        };
      } else {
        gestureRef.current = "none";
      }
      return;
    }
    const pinched = pinchedRef.current;
    const moved = movedRef.current;
    gestureRef.current = "none";
    pinchedRef.current = false;
    movedRef.current = false;
    if (pinched || moved) return;
    if (viewRef.current.scale > 1.01) resetView(true);
    else close();
  };

  return (
    <div
      ref={rootRef}
      className={`mermaid-lightbox${zoomed ? " is-zoomed" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={zoomed ? "流程图已放大，点按回到初始放大，再点按关闭" : "流程图，点按关闭"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => event.stopPropagation()}
    >
      <div ref={stageRef} className="mermaid-lightbox__stage">
        <div
          ref={canvasRef}
          className="mermaid-lightbox__canvas"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    </div>
  );
}

interface MermaidDiagramProps {
  chart: string;
  deferRender?: boolean;
}

function MermaidDiagram({ chart, deferRender = false }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, "");
  const renderCountRef = useRef(0);
  const boxRef = useRef<HTMLElement>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const trimmed = chart.trim();
    if (!trimmed || deferRender) {
      setSvgHtml(null);
      return;
    }

    let cancelled = false;

    const renderChart = () => {
      const { palette, fontFamily } = readContext(boxRef.current);
      configureMermaid(palette, fontFamily);
      const renderId = `mermaid-${reactId}-${renderCountRef.current++}`;
      void mermaid
        .render(renderId, trimmed)
        .then(({ svg }) => {
          if (!cancelled) {
            setSvgHtml(svg);
            setError(null);
          }
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[Mermaid Render Error] ${renderId}:`, errorMessage);
          if (!cancelled) {
            setError(errorMessage);
            setSvgHtml(null);
          }
        });
    };

    renderChart();

    const shell = boxRef.current?.closest(".reading-shell") ?? document.documentElement;
    const observer = new MutationObserver(renderChart);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    if (shell !== document.documentElement) {
      observer.observe(shell, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [chart, reactId, deferRender]);

  if (!chart.trim()) return null;

  if (deferRender) {
    return <div ref={boxRef} className="mermaid-diagram mermaid-diagram-pending" aria-hidden />;
  }

  if (error) {
    return (
      <div ref={boxRef} className="mermaid-diagram-error">
        <button
          type="button"
          className="mermaid-diagram-error-toggle"
          onClick={() => setCollapsed((v) => !v)}
        >
          流程图暂时无法显示 {collapsed ? "▸" : "▾"}
        </button>
        {!collapsed && <pre className="mermaid-diagram-error-detail">{error}</pre>}
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div ref={boxRef} className="mermaid-diagram mermaid-diagram-pending">
        <span className="mermaid-diagram__status">流程图加载中</span>
      </div>
    );
  }

  return (
    <>
      <button
        ref={boxRef}
        type="button"
        className="mermaid-diagram mermaid-diagram--interactive"
        aria-label="放大查看流程图"
        onClick={() => setExpanded(true)}
      >
        <div className="mermaid-diagram__canvas" dangerouslySetInnerHTML={{ __html: svgHtml }} />
        <span className="mermaid-diagram__hint">点按放大</span>
      </button>
      {expanded &&
        typeof document !== "undefined" &&
        createPortal(<MermaidLightbox svgHtml={svgHtml} onClose={() => setExpanded(false)} />, document.body)}
    </>
  );
}

export default memo(MermaidDiagram);
