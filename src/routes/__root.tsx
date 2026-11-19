import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import globalCss from "@/styles/global.css?url";
import { ErrorBoundaryCard } from "@/components/error-boundary-card";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Lets do homework",
      },
    ],
    links: [{ rel: "stylesheet", href: globalCss }],
  }),
  component: RootComponent,
  errorComponent: ErrorBoundaryCard,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-theme="dracula">
      <head>
        <HeadContent />
      </head>
      {/* @uiw/react-markdown-preview CSS follows data-color-mode, not the
          daisyUI data-theme. Set dark so the editor matches the dark page. */}
      <body data-color-mode="dark">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
