// src/global.d.ts

// 1. For standard side-effect imports: import '@styles/global.css'
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// 2. For TanStack Start explicit URL link imports: import globalCss from '@/styles/global.css?url'
declare module "*.css?url" {
  const content: string;
  export default content;
}
