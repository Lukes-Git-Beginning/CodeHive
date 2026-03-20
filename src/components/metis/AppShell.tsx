import { Outlet } from 'react-router-dom'
import { MetisSidebar } from './MetisSidebar'
import { MetisTopBar } from './MetisTopBar'

export function AppShell() {
  return (
    <div className="flex w-full h-full bg-bg-deep">
      <MetisSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MetisTopBar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
