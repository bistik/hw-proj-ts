import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/lessons/new')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/lessons/new"!</div>
}
