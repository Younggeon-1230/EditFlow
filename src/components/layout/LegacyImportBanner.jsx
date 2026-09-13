import { useEffect, useRef, useState } from 'react'
import {
  getLegacyStorageSummary,
  hasCompletedLegacyImport,
  importLegacyStorageForUser,
} from '../../utils/userStorage.js'

function getInitialState(userId) {
  if (!Number.isInteger(userId) || userId <= 0) return { visible: false }
  try {
    const summary = getLegacyStorageSummary(localStorage)
    return {
      visible:
        !hasCompletedLegacyImport(localStorage, userId) &&
        (summary.hasLegacyData || summary.hasCorruptData),
      summary,
    }
  } catch {
    return { visible: false }
  }
}

function LegacyImportBanner({ userId, onImported }) {
  const [state, setState] = useState(() => getInitialState(userId))
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState(null)
  const importLock = useRef(false)

  useEffect(() => {
    setState(getInitialState(userId))
    setMessage(null)
    setIsImporting(false)
    importLock.current = false
  }, [userId])

  if (!state.visible && !message) return null

  function handleImport() {
    if (importLock.current) return
    importLock.current = true
    setIsImporting(true)
    setMessage(null)
    try {
      const result = importLegacyStorageForUser(localStorage, userId)
      setState({ visible: false })
      setMessage({
        type: 'success',
        text: '기존 로컬 데이터를 현재 계정으로 가져왔습니다. 원본 데이터는 그대로 보존됩니다.',
      })
      onImported?.(result)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      importLock.current = false
      setIsImporting(false)
    }
  }

  return (
    <section
      aria-live="polite"
      className={`legacy-import-banner${message?.type === 'success' ? ' is-success' : ''}`}
    >
      <div className="legacy-import-banner__content">
        <strong>
          {message?.type === 'success'
            ? '가져오기 완료'
            : '이 브라우저에 이전 버전의 로컬 데이터가 있습니다.'}
        </strong>
        <p className={message?.type === 'error' ? 'legacy-import-banner__error' : ''}>
          {message?.text ?? (state.summary?.hasCorruptData
            ? '일부 데이터를 읽을 수 없습니다. 가져오기를 시도하면 원본을 유지한 채 오류를 안내합니다.'
            : '원하면 현재 로그인한 계정의 전용 저장 공간으로 복사할 수 있습니다.')}
        </p>
      </div>
      {state.visible && (
        <div className="legacy-import-banner__actions">
          <button disabled={isImporting} onClick={handleImport} type="button">
            {isImporting ? '가져오는 중…' : '현재 계정으로 가져오기'}
          </button>
          <button
            className="is-secondary"
            disabled={isImporting}
            onClick={() => setState({ visible: false })}
            type="button"
          >
            나중에
          </button>
        </div>
      )}
      {!state.visible && message?.type === 'success' && (
        <button
          className="legacy-import-banner__dismiss"
          onClick={() => setMessage(null)}
          type="button"
        >
          닫기
        </button>
      )}
    </section>
  )
}

export default LegacyImportBanner
