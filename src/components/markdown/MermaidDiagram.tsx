import { useEffect, useId, useRef } from "react";
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
        }
      } catch {
        // Incomplete syntax during streaming — skip until content stabilizes
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
          }
        })
        .catch(() => {});
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [chart, reactId]);

  if (!chart.trim()) return null;

  return <div className="mermaid-diagram" ref={containerRef} />;
}
