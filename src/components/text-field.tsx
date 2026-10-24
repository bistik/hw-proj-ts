import { AnyFieldApi } from "@tanstack/react-form";
import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

type TextFieldProps = {
  field: AnyFieldApi;
  label: string;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  multiline?: boolean;
  rows?: number;
};
export function TextField({
  field,
  label,
  placeholder,
  type = "text",
  multiline = false,
  rows,
}: TextFieldProps) {
  const { errors, isTouched } = field.state.meta;
  const error = isTouched ? errors[0]?.message : undefined;
  const sharedAttrs = {
    value: field.state.value,
    onBlur: () => field.handleBlur(),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      field.handleChange(e.target.value),
    placeholder,
    "aria-invalid": error ? true : undefined,
  };
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      {multiline ? (
        <textarea {...sharedAttrs} className="textarea" rows={rows} />
      ) : (
        <input type={type} className="input" {...sharedAttrs} />
      )}
      {error && <p className="label text-error">{error}</p>}
    </fieldset>
  );
}
