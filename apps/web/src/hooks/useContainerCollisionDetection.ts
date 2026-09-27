import { useCallback, useRef } from "react";
import {
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

import type { Containers } from "../components/ranking-editor-logic";

/**
 * ~360 sortable player rows makes the default collision detection
 * (comparing every row on every pointer-move) expensive enough to
 * visibly stall drags. Use the cheap pointerWithin check to find
 * which tier/unranked container the pointer is over first, then run
 * the more expensive closestCenter only against that container's
 * rows — the standard dnd-kit pattern for large multi-container
 * sortable lists.
 *
 * Also returns `lastOverId`, the most recent hit — the fallback target
 * when the pointer is momentarily over nothing, and what the edge
 * autoscroll reads to find the container under the pointer.
 */
export function useContainerCollisionDetection(
  containers: Containers,
  playerContainerMap: Map<string, string>,
) {
  const lastOverId = useRef<string | null>(null);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        const overIdStr = String(overId);
        const targetContainer = playerContainerMap.get(overIdStr) ?? overIdStr;

        if (containers[targetContainer]?.length) {
          const closest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                playerContainerMap.get(String(container.id)) ===
                  targetContainer || container.id === targetContainer,
            ),
          });
          overId = closest[0]?.id ?? overId;
        }

        lastOverId.current = String(overId);
        return [{ id: overId }];
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [containers, playerContainerMap],
  );

  // Called at drag start so a previous drag's target can't leak in.
  const resetLastOverId = useCallback(() => {
    lastOverId.current = null;
  }, []);

  return { collisionDetection, lastOverId, resetLastOverId };
}
