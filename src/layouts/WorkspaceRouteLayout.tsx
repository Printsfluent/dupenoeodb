import { Outlet } from 'react-router-dom'

/** Parent layout for workspace home + database routes (enables relative back navigation). */
export default function WorkspaceRouteLayout() {
  return <Outlet />
}
