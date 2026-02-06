import { useEffect } from 'react'
import { useSftpStore, Transfer } from '../../stores/sftpStore'
import { RiCheckboxCircleFill, RiErrorWarningFill, RiPauseFill, RiPlayFill, RiCloseFill, RiDeleteBinFill } from 'react-icons/ri'

interface TransferQueueProps {
  sessionId: string
}

export function TransferQueue({ sessionId }: TransferQueueProps) {
  const store = useSftpStore()
  const transfers = store.transfers(sessionId)

  useEffect(() => {
    // Listen for transfer updates
    const handleQueueUpdate = (data: any) => {
      if (data.sessionId === sessionId && data.queue) {
        store.setTransfers(sessionId, data.queue)
      }
    }

    const handleProgressUpdate = (data: any) => {
      if (data.sessionId === sessionId) {
        store.updateTransfer(sessionId, data.transferId, {
          progress: data.progress,
          speed: data.speed,
          status: 'active'
        })
      }
    }

    window.electronAPI.onSftpQueueUpdate(handleQueueUpdate)
    window.electronAPI.onSftpTransferProgress(handleProgressUpdate)
  }, [sessionId])

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  }

  const getStatusIcon = (transfer: Transfer) => {
    switch (transfer.status) {
      case 'completed': return <RiCheckboxCircleFill size={14} className="text-success" />
      case 'error': return <RiErrorWarningFill size={14} className="text-error" />
      case 'paused': return <RiPauseFill size={14} className="text-warning" />
      default: return null
    }
  }

  const getStatusText = (transfer: Transfer) => {
    if (transfer.status === 'active') return formatSpeed(transfer.speed)
    if (transfer.status === 'error' && transfer.error) {
      const errorMap: Record<string, string> = {
        'Permission denied': '권한 거부됨',
        'No such file': '파일 없음',
        'EACCES': '접근 거부됨'
      }
      for (const [key, value] of Object.entries(errorMap)) {
        if (transfer.error.includes(key)) return value
      }
      return transfer.error.length > 15 ? transfer.error.slice(0, 15) + '...' : transfer.error
    }
    const statusMap: Record<string, string> = {
      'queued': '대기 중',
      'paused': '일시정지',
      'completed': '완료',
      'error': '오류'
    }
    return statusMap[transfer.status] || transfer.status
  }

  const handlePause = async (transferId: string) => {
    await window.electronAPI.sftpTransferPause(sessionId, transferId)
  }

  const handleResume = async (transferId: string) => {
    await window.electronAPI.sftpTransferResume(sessionId, transferId)
  }

  const handleCancel = async (transferId: string) => {
    await window.electronAPI.sftpTransferCancel(sessionId, transferId)
  }

  const handleClearCompleted = async () => {
    await window.electronAPI.sftpQueueClearCompleted(sessionId)
  }

  const hasCompletedOrError = transfers.some(t => t.status === 'completed' || t.status === 'error')

  if (transfers.length === 0) return null

  return (
    <div className="transfer-queue">
      <div className="transfer-header">
        <span>전송 ({transfers.filter(t => t.status === 'active' || t.status === 'queued').length})</span>
        {hasCompletedOrError && (
          <button
            className="transfer-clear-btn"
            onClick={handleClearCompleted}
            title="완료된 항목 삭제"
          >
            <RiDeleteBinFill size={14} />
          </button>
        )}
      </div>
      <div className="transfer-list">
        {transfers.map((transfer) => (
          <div key={transfer.id} className={`transfer-item ${transfer.status}`}>
            <div className="transfer-info">
              <span className="transfer-name" title={transfer.fileName}>{transfer.fileName}</span>
              <span className={`transfer-status ${transfer.status}`}>
                {getStatusIcon(transfer)}
                {getStatusText(transfer)}
              </span>
            </div>
            <div className="transfer-progress-bar">
              <div className="transfer-progress-fill" style={{ width: `${transfer.progress}%` }} />
            </div>
            <div className="transfer-actions">
              {transfer.status === 'active' && (
                <button
                  className="transfer-action-btn"
                  onClick={() => handlePause(transfer.id)}
                  title="일시정지"
                >
                  <RiPauseFill size={12} />
                </button>
              )}
              {transfer.status === 'paused' && (
                <button
                  className="transfer-action-btn"
                  onClick={() => handleResume(transfer.id)}
                  title="재개"
                >
                  <RiPlayFill size={12} />
                </button>
              )}
              {(transfer.status === 'active' || transfer.status === 'paused' || transfer.status === 'queued') && (
                <button
                  className="transfer-action-btn cancel"
                  onClick={() => handleCancel(transfer.id)}
                  title="취소"
                >
                  <RiCloseFill size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
