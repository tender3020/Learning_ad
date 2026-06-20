import { memo, useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

function isLightTheme() {
  return document.documentElement.classList.contains("theme-light");
}

function configureMermaid() {
  const light = isLightTheme();
  mermaid.initialize({
    startOnLoad: false,
    theme: light ? "base" : "dark",
    themeVariables: light
      ? {
          primaryColor: "#EDE9FE",
          primaryTextColor: "#1C1C1E",
          primaryBorderColor: "#6E56CF",
          lineColor: "#636366",
          secondaryColor: "#F2F2F7",
          tertiaryColor: "#FFFFFF",
          background: "transparent",
          mainBkg: "#F2F2F7",
          textColor: "#3A3A3C",
          nodeBorder: "#6E56CF",
          clusterBkg: "#F2F2F7",
          titleColor: "#1C1C1E",
          edgeLabelBackground: "#FFFFFF",
        }
      : {
          primaryColor: "#6E56CF",
          primaryTextColor: "#F5F5F7",
          primaryBorderColor: "#8B7CF7",
          lineColor: "#8A8A8E",
          secondaryColor: "#1C1C1E",
          tertiaryColor: "#0A0A0A",
          background: "transparent",
          mainBkg: "#1C1C1E",
          textColor: "#E0E0E5",
          nodeBorder: "#6E56CF",
          clusterBkg: "#0A0A0A",
          titleColor: "#F5F5F7",
          edgeLabelBackground: "#1C1C1E",
        },
    securityLevel: "strict",
    fontFamily: "Inter, system-ui, sans-serif",
  });
}

interface MermaidDiagramProps {
  chart: string;
  deferRender?: boolean;
}

function MermaidDiagram({ chart, deferRender = false }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, "");
  const renderCountRef = useRef(0);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const trimmed = chart.trim();
    if (!trimmed || deferRender) {
      setSvgHtml(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      configureMermaid();
      const renderId = `mermaid-${reactId}-${renderCountRef.current++}`;

      try {
        const { svg } = await mermaid.render(renderId, trimmed);
        if (!cancelled) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Mermaid Render Error] ${renderId}:`, errorMessage);
        if (!cancelled) {
          setError(errorMessage);
          setSvgHtml(null);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chart, reactId, deferRender]);

  useEffect(() => {
    if (deferRender) return;

    const observer = new MutationObserver(() => {
      renderCountRef.current++;
      const trimmed = chart.trim();
      if (!trimmed) return;

      configureMermaid();
      const renderId = `mermaid-${reactId}-${renderCountRef.current}`;
      mermaid
        .render(renderId, trimmed)
        .then(({ svg }) => {
          setSvgHtml(svg);
          setError(null);
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[Mermaid Theme Toggle Error] ${renderId}:`, errorMessage);
          setError(errorMessage);
        });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [chart, reactId, deferRender]);

  if (!chart.trim()) return null;

  if (deferRender) {
    return <div className="mermaid-diagram mermaid-diagram-pending" aria-hidden />;
  }

  if (error) {
    return (
      <div className="mermaid-diagram-error">
        <button
          type="button"
          className="mermaid-diagram-error-toggle"
          onClick={() => setCollapsed((v) => !v)}
        >
          Mermaid 图表无法渲染 {collapsed ? "▸" : "▾"}
        </button>
        {!collapsed && <pre className="mermaid-diagram-error-detail">{error}</pre>}
      </div>
    );
  }

  if (!svgHtml) {
    return <div className="mermaid-diagram mermaid-diagram-pending" aria-hidden />;
  }

  return (
    <div
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

export default memo(MermaidDiagram);
