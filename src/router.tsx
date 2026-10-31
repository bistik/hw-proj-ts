// src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { ErrorBoundaryCard } from "@/components/error-boundary-card";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => <div>404 - not found</div>,
    defaultErrorComponent: ErrorBoundaryCard,
  });

  return router;
}
