import type { ReactNode } from "react";

type BreadcrumbsProps = {
  /** One entry per crumb, in order. Each entry renders in its own <li>. */
  items: ReactNode[];
};

/** DaisyUI breadcrumb trail. Each item is usually a router <Link>. */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="breadcrumbs text-sm mb-8">
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
