import FormErrorAlert from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { assignmentUpdateFormSchema } from "@/schemas/course-schema";
import { getAssignmentById } from "@/server/assignments/get-assignment";
import { updateAssignment } from "@/server/assignments/mutate-assignment";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/assignments/$assignmentId/edit",
)({
  loader: async ({ params }) => {
    const assignmentId = Number(params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) throw notFound();
    // Same guard as the detail page: null means unknown id or a caller who
    // is not the course author, so a non-author gets the not-found page.
    const assignment = await getAssignmentById({
      data: { assignmentId: assignmentId },
    });
    if (!assignment) throw notFound();
    return { assignment };
  },
  component: EditAssignmentComponent,
});

// Issue #84: the points dropdown offers exactly 1 to 10, same as the
// create form.
const pointsOptions = Array.from({ length: 10 }, (_, i) => i + 1);

function EditAssignmentComponent() {
  const { assignment } = Route.useLoaderData();
  const navigate = useNavigate();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof assignmentUpdateFormSchema>;
  }) => {
    const result = await updateAssignment({ data: value });
    if (result) {
      navigate({
        to: "/assignments/$assignmentId",
        params: { assignmentId: String(value.assignmentId) },
      });
    }
  };

  const form = useForm({
    defaultValues: {
      assignmentId: assignment.id,
      title: assignment.title,
      example: assignment.example ?? "",
      // Issue #84: prefill the dropdown with the stored points, so a
      // title-only edit cannot reset them.
      points: assignment.points,
      // Issue #86: prefill the checkbox with the stored value, so a
      // title-only edit cannot reset the toggle.
      checkOnSubmit: assignment.checkOnSubmit,
    },
    validators: {
      onSubmit: assignmentUpdateFormSchema,
    },
    onSubmit: handleSubmit,
  });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) =>
            typeof error === "string" ? (
              <FormErrorAlert errorMsg={error} />
            ) : null
          }
        </form.Subscribe>
        <form.Field name="title">
          {(field) => <TextField label="Title" field={field} />}
        </form.Field>
        <form.Field name="example">
          {(field) => (
            <TextField label="Example" field={field} multiline rows={8} />
          )}
        </form.Field>
        <form.Field name="points">
          {(field) => (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Points</legend>
              <select
                className="select"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              >
                {pointsOptions.map((points) => (
                  <option key={points} value={points}>
                    {points}
                  </option>
                ))}
              </select>
            </fieldset>
          )}
        </form.Field>
        {/* Issue #86: the same "Check answers on submit" checkbox as the
            create form, prefilled with the stored value. */}
        <form.Field name="checkOnSubmit">
          {(field) => (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">
                Check answers on submit
              </legend>
              <input
                type="checkbox"
                className="checkbox"
                name={field.name}
                checked={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
            </fieldset>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton
              label="Update assignment"
              submittingLabel="Updating"
              isSubmitting={isSubmitting}
            />
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
