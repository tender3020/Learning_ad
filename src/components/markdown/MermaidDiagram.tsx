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

function MermaidLightbox({ svgHtml, onClose }: { svgHtml: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const svg = canvas.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    const apply = () => {
      const styles = getComputedStyle(canvas);
      const padX = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
      const padY = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0);
      fitSvgToStage(svg, stage.clientWidth - padX - 2, stage.clientHeight - padY - 2);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [svgHtml]);

  return (
    <div
      className="mermaid-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="流程图"
      onClick={onClose}
    >
      <div ref={stageRef} className="mermaid-lightbox__stage" onClick={(event) => event.stopPropagation()}>
        <div
          ref={canvasRef}
          className="mermaid-lightbox__canvas"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
      <button type="button" className="mermaid-lightbox__close" onClick={onClose}>
        关闭
      </button>
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
