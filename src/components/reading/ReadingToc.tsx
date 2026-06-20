import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type TocItem = { id: string; title: string };

type ReadingTocProps = {
  items: TocItem[];
  activeId?: string;
  onNavigate: (id: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function ReadingToc({
  items,
  activeId,
  onNavigate,
  mobileOpen = false,
  onMobileClose,
}: ReadingTocProps) {
  if (items.length === 0) return null;

  const list = (
    <nav className="reading-toc" aria-label="章节目录">
      <p className="reading-toc__heading">本章目录</p>
      <ul className="reading-toc__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
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
      <aside className="reading-toc-desktop hidden lg:block">{list}</aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="reading-toc-backdrop lg:hidden"
              onClick={onMobileClose}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="reading-toc-sheet lg:hidden"
            >
              <div className="reading-toc-sheet__header">
                <span className="reading-toc-sheet__title">章节目录</span>
                <button
                  type="button"
                  className="reading-toc-sheet__close"
                  onClick={onMobileClose}
                  aria-label="关闭目录"
                >
                  <X size={18} />
                </button>
              </div>
              {list}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
