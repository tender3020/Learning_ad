import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MathText from "./MathText";

function render(text: string): string {
  return renderToStaticMarkup(<MathText text={text} />);
}

describe("MathText 练习题公式渲染", () => {
  it("行内公式 $...$ 渲染为 KaTeX，文本原样保留", () => {
    const html = render("质能方程 $E = mc^2$ 表明");
    expect(html).toContain("katex");
    expect(html).toContain("质能方程");
    expect(html).not.toContain("$E");
  });

  it("块级公式 $$...$$ 渲染为 display 模式", () => {
    const html = render("求和公式：$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$");
    expect(html).toContain("katex-display");
  });

  it("预处理 \\(...\\) 与 \\[...\\] 非标准格式", () => {
    expect(render("\\(x^2\\)")).toContain("katex");
    expect(render("\\[x^2\\]")).toContain("katex-display");
  });

  it("跨行块级公式可正确渲染", () => {
    const html = render("$$\nx^2 + y^2 = z^2\n$$");
    expect(html).toContain("katex-display");
  });

  it("不误匹配美元金额", () => {
    const html = render("价格在 $5 和 $10 之间");
    expect(html).not.toContain("katex");
  });

  it("以序号开头的题目保持纯文本（不被解析为列表）", () => {
    const html = render("1. 计算 $1+1$ 的结果");
    expect(html).toContain("1. 计算");
    expect(html).toContain("katex");
  });

  it("非法公式回退为可读文本而非崩溃", () => {
    const html = render("$\\badcommand{$");
    expect(html).toContain("badcommand");
  });

  it("无公式文本完全原样输出", () => {
    const html = render("下列哪项是勾股定理的内容？");
    expect(html).toBe("<span>下列哪项是勾股定理的内容？</span>");
  });
});
