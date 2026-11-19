import { defaultSchema } from "hast-util-sanitize";
// The same stylesheet the author editor preview uses (@uiw editor +
// github-markdown styles). It scopes everything under .wmde-markdown, so
// it does not style the rest of the page. Colors follow data-color-mode
// on <body> (see __root.tsx), like the editor preview.
import "@uiw/react-markdown-preview/markdown.css";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// GitHub style sanitation, with the anchor attributes this app uses.
// The default schema already drops script/style elements and on*
// handler attributes, and restricts href to safe protocols (http,
// https, mailto, ...), so javascript:/data: links lose their href.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
};

type MarkdownViewProps = {
  content: string;
};

/**
 * Renders stored markdown as sanitized HTML.
 *
 * Raw HTML in the markdown is parsed, then sanitized: dangerous
 * elements and attributes never reach the DOM. Anchors without their
 * own target/rel open in a new tab; anchors that set them keep them.
 *
 * The wrapper carries the preview stylesheet class, so tables have
 * borders, headings scale, and the look matches the author editor
 * preview.
 */
export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="wmde-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a({ node: _node, ...props }) {
            return (
              <a
                {...props}
                target={props.target ?? "_blank"}
                rel={props.rel ?? "noopener noreferrer"}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
