import { useEffect, type RefObject } from "react";

const EDGE_SIZE = 60;
const MAX_SPEED = 18;

/**
 * Manual edge autoscroll for the ranking editor, used instead of dnd-kit's
 * built-in autoScroll (which the editor restricts to the page itself):
 * dnd-kit's own autoscroll tracks the dragged node's ancestor chain,
 * established early in the drag, and doesn't retarget when the pointer
 * crosses into a different container's independently-scrolled
 * (virtualized) viewport — it keeps scrolling the original container.
 * This tracks the pointer directly and always scrolls whichever
 * container is currently under it.
 */
export function useEdgeAutoscroll(
  isDragging: boolean,
  lastOverId: RefObject<string | null>,
  resolveContainer: (id: string) => string | undefined,
  scrollElements: RefObject<Map<string, HTMLDivElement>>,
) {
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    let frame: number;
    let pointerY = 0;

    const onPointerMove = (event: PointerEvent) => {
      pointerY = event.clientY;
    };

    const tick = () => {
      const overContainer = lastOverId.current
        ? (resolveContainer(lastOverId.current) ?? lastOverId.current)
        : undefined;
      const el = overContainer
        ? scrollElements.current.get(overContainer)
        : undefined;

      if (el) {
        const rect = el.getBoundingClientRect();
        const distanceFromTop = pointerY - rect.top;
        const distanceFromBottom = rect.bottom - pointerY;

        if (distanceFromTop >= 0 && distanceFromTop < EDGE_SIZE) {
          const speed = MAX_SPEED * (1 - distanceFromTop / EDGE_SIZE);
          el.scrollTop -= speed;
        } else if (distanceFromBottom >= 0 && distanceFromBottom < EDGE_SIZE) {
          const speed = MAX_SPEED * (1 - distanceFromBottom / EDGE_SIZE);
          el.scrollTop += speed;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove);
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [isDragging, lastOverId, resolveContainer, scrollElements]);
}
