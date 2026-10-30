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
    const assignment = await getAssignmentById({
      data: { assignmentId: assignmentId },
    });
    return { assignment };
  },
  component: RouteComponent,
});

function RouteComponent() {
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
              <div role="alert" className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>{error}</span>
              </div>
            ) : null
          }
        </form.Subscribe>
        <form.Field name="title">
          {(field) => <TextField label="Title" field={field} />}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button
              type="submit"
              className="btn btn-primary my-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner"></span>Updating
                </>
              ) : (
                "Update assignment"
              )}
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
