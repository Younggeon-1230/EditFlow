import { Fragment, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import Header from './Header.jsx'
import LegacyImportBanner from './LegacyImportBanner.jsx'

function AppLayout() {
  const { user } = useAuth()
  const [storageRevision, setStorageRevision] = useState(0)

  useEffect(() => {
    setStorageRevision(0)
  }, [user?.id])

  return (
    <div className="app">
      <Header />
      {user && (
        <LegacyImportBanner
          onImported={() => setStorageRevision((current) => current + 1)}
          userId={user.id}
        />
      )}
      <Fragment key={`${user?.id ?? 'public'}:${storageRevision}`}>
        <Outlet />
      </Fragment>
    </div>
  )
}

export default AppLayout
