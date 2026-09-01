import { useCallback, useEffect, useRef, useState } from 'react'
import { getProjectStatusLabel, getProjects } from '../../services/projectsApi.js'
import { getDday } from '../../utils/projectDates.js'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function ServerProjectImportDialog({
  localProjects,
  onClose,
  onRestore,
  restoreErrors,
  restoringProjectIds,
  triggerRef,
}) {
  const [serverProjects, setServerProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const dialogRef = useRef(null)
  const controllerRef = useRef(null)
  const requestSequence = useRef(0)
  const pendingRef = useRef(false)
  const hasPendingRestore = restoringProjectIds.size > 0
  pendingRef.current = hasPendingRestore

  const loadServerProjects = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const sequence = ++requestSequence.current
    setIsLoading(true)
    setError(null)
    try {
      const projects = await getProjects(controller.signal)
      if (sequence === requestSequence.current) setServerProjects(projects)
      return projects
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === requestSequence.current) {
        setError('서버 프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
      return null
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    loadServerProjects()
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0)

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!pendingRef.current) onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      requestSequence.current += 1
      controllerRef.current?.abort()
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      window.setTimeout(() => triggerRef?.current?.focus(), 0)
    }
  }, [loadServerProjects, onClose, triggerRef])

  async function restore(serverProject) {
    setAnnouncement('')
    const restored = await onRestore(serverProject.backendProjectId)
    if (restored) {
      setAnnouncement(`${serverProject.title} 프로젝트를 이 브라우저에 연결했습니다.`)
      return
    }
    await loadServerProjects()
  }

  return (
    <div className="form-overlay server-project-import-overlay" onMouseDown={() => !hasPendingRestore && onClose()} role="presentation">
      <section
        aria-describedby="server-project-import-description"
        aria-labelledby="server-project-import-title"
        aria-modal="true"
        className="server-project-import-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex="-1"
      >
        <div className="project-form-heading server-project-import-heading">
          <div>
            <p className="page-eyebrow">IMPORT SERVER PROJECTS</p>
            <h2 id="server-project-import-title">서버 프로젝트 가져오기</h2>
            <p id="server-project-import-description">서버에 저장된 프로젝트를 이 브라우저의 프로젝트 목록에 연결합니다. 서버에 새 프로젝트를 생성하지 않습니다.</p>
          </div>
          <button aria-label="서버 프로젝트 가져오기 닫기" className="icon-button" disabled={hasPendingRestore} onClick={onClose} type="button">×</button>
        </div>

        <div className="server-project-import-toolbar">
          <span>{serverProjects.length > 0 ? `서버 프로젝트 ${serverProjects.length}개` : '서버 프로젝트 확인'}</span>
          <button className="secondary-button" disabled={isLoading || hasPendingRestore} onClick={loadServerProjects} type="button">{isLoading ? '확인 중…' : '다시 확인'}</button>
        </div>

        {error && <div className="reference-state error-state" role="alert"><p>{error}</p></div>}
        {announcement && <p className="server-project-import-announcement" role="status">{announcement}</p>}
        {isLoading && serverProjects.length === 0 ? (
          <p className="server-project-import-state" role="status">서버 프로젝트를 불러오는 중입니다.</p>
        ) : !error && serverProjects.length === 0 ? (
          <p className="server-project-import-state">가져올 수 있는 서버 프로젝트가 없습니다.</p>
        ) : (
          <ul className="server-project-import-list" aria-label="서버 프로젝트 목록">
            {serverProjects.map((serverProject) => {
              const mapped = localProjects.some((project) => project.backendProjectId === serverProject.backendProjectId)
              const importing = restoringProjectIds.has(serverProject.backendProjectId)
              const dday = getDday(serverProject.dueDate)
              return (
                <li className="server-project-import-item" key={serverProject.backendProjectId}>
                  <div className="server-project-import-copy">
                    <div><span className="project-status">{getProjectStatusLabel(serverProject.status)}</span><span>{serverProject.dueDate ? `마감일 ${serverProject.dueDate}` : '마감일 없음'}{dday ? ` · ${dday.label}` : ''}</span></div>
                    <strong>{serverProject.title}</strong>
                    <small>Reference {serverProject.referenceCount} · B-roll {serverProject.brollCount} · 체크리스트 {serverProject.checklistCompleted}/{serverProject.checklistTotal}</small>
                    {restoreErrors[serverProject.backendProjectId] && <p className="server-project-import-error" role="alert">{restoreErrors[serverProject.backendProjectId]}</p>}
                  </div>
                  <button className={mapped ? 'secondary-button' : 'primary-button'} disabled={mapped || importing} onClick={() => restore(serverProject)} type="button">{mapped ? '연결됨' : importing ? '가져오는 중…' : '가져오기'}</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default ServerProjectImportDialog
