import { useEffect, useId, useRef, useState } from "react";
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
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, "");
  const renderCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = chart.trim();
    if (!trimmed) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      configureMermaid();
      const renderId = `mermaid-${reactId}-${renderCountRef.current++}`;

      try {
        const { svg } = await mermaid.render(renderId, trimmed);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        // 记录错误供调试，但在流式传输时忽略不完整的语法
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Mermaid Render Error] ${renderId}:`, errorMessage);
        if (!cancelled) {
          setError(errorMessage);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chart, reactId]);

  // Re-render when light/dark theme toggles
  useEffect(() => {
    const observer = new MutationObserver(() => {
      renderCountRef.current++;
      const trimmed = chart.trim();
      if (!trimmed || !containerRef.current) return;

      configureMermaid();
      const renderId = `mermaid-${reactId}-${renderCountRef.current}`;
      mermaid
        .render(renderId, trimmed)
        .then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
            setError(null);
          }
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
  }, [chart, reactId]);

  if (!chart.trim()) return null;

  // 显示错误消息便于调试
  if (error) {
    return (
      <div
        className="mermaid-diagram-error"
        style={{
          padding: "12px",
          marginTop: "1rem",
          marginBottom: "1rem",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          fontSize: "0.85rem",
          color: "#dc2626",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <strong>Mermaid 图表错误:</strong>
        <br />
        {error}
      </div>
    );
  }

  return <div className="mermaid-diagram" ref={containerRef} />;
}
