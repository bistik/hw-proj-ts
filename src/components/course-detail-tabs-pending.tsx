import { Fragment } from "react";
import TabPanelSkeleton from "@/components/tab-panel-skeleton";

// Single source of truth for the course detail tab values. The course
// detail route derives its ?tab= search-param schema from this list, so
// the two lists cannot drift.
export const courseDetailTabValues = [
  "details",
  "enrollments",
  "assignments",
  "lessons",
  "submissions",
] as const;

export type CourseDetailTab = (typeof courseDetailTabValues)[number];

const courseDetailTabs: { value: CourseDetailTab; label: string }[] = [
  { value: "details", label: "Course Details" },
  { value: "enrollments", label: "Enrollment" },
  { value: "assignments", label: "Assignments" },
  { value: "lessons", label: "Lessons" },
  { value: "submissions", label: "Submissions" },
];

// Loading placeholder for the course detail page: keeps the tab bar visible
// with the pending tab checked and shows skeletons in the active panel.
//
// NOTE: each radio must be immediately followed by its own tab-content div —
// DaisyUI only shows a tab-content that is a direct sibling right after the
// checked radio (input:checked + .tab-content).
export default function CourseDetailTabsPending({
  activeTab,
}: {
  activeTab: CourseDetailTab;
}) {
  return (
    <div className="tabs tabs-border" role="tablist">
      {courseDetailTabs.map(({ value, label }) => (
        <Fragment key={value}>
          <input
            type="radio"
            name="course_tabs_pending"
            className="tab"
            aria-label={label}
            checked={activeTab === value}
            disabled
          />
          <div className="tab-content border-base-300 bg-base-100 p-10 min-h-96">
            {activeTab === value ? <TabPanelSkeleton /> : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
