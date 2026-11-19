import { AnyFieldApi } from "@tanstack/react-form";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";

type MarkdownFieldProps = {
  field: AnyFieldApi;
  label: string;
};
export function MarkdownField({ field, label }: MarkdownFieldProps) {
  const { errors, isTouched } = field.state.meta;
  const error = isTouched ? errors[0]?.message : undefined;
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <MDEditor
        // Fixed height: the auto-grown height changes when the textarea
        // gains or loses focus, which shifts the layout under the user's
        // pointer mid-click (a real click then misses the Save button).
        height={200}
        value={field.state.value}
        onBlur={() => field.handleBlur()}
        onChange={(value) => field.handleChange(value ?? "")}
        textareaProps={{ "aria-invalid": error ? true : undefined }}
      />
      {error && <p className="label text-error">{error}</p>}
    </fieldset>
  );
}
