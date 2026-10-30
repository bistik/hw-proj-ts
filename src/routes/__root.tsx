import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import globalCss from "@/styles/global.css?url";
import { isUnauthorized } from "@/lib/errors";

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
  errorComponent: ({ error }) => {
    if (isUnauthorized(error)) {
      return (
        <div className="p-4 alert alert-warning">
          <h3>Please login</h3>
          <a href="/login" className="btn">
            Sign in again
          </a>
        </div>
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return (
      <div className="p-4 alert alert-danger">
        <h3>Oops! Something went wrong</h3>
        <p>{errorMessage}</p>
        <button onClick={() => window.location.reload()} className="btn">
          Try Again
        </button>
      </div>
    );
  },
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
