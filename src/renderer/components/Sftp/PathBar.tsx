import { useState, useEffect, KeyboardEvent } from 'react'
import { RiHardDrive2Fill } from 'react-icons/ri'

interface PathBarProps {
  path: string
  onNavigate: (path: string) => void
  type: 'local' | 'remote'
  label: string
}

const WINDOWS_DRIVES = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:']

const isWindows = () => {
  return navigator.platform.toLowerCase().includes('win') ||
         navigator.userAgent.toLowerCase().includes('windows')
}

export function PathBar({ path, onNavigate, type, label }: PathBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputPath, setInputPath] = useState(path)

  useEffect(() => {
    setInputPath(path)
  }, [path])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmedPath = inputPath.trim()
      if (trimmedPath) {
        onNavigate(trimmedPath)
      }
      setIsEditing(false)
    } else if (e.key === 'Escape') {
      setInputPath(path)
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    setInputPath(path)
    setIsEditing(false)
  }

  const handleDriveChange = (drive: string) => {
    onNavigate(`${drive}\\`)
  }

  const currentDrive = isWindows() && type === 'local'
    ? path.substring(0, 2).toUpperCase()
    : null

  return (
    <div className="path-bar">
      <span className="path-label">{label}</span>

      {/* Drive selector for Windows local */}
      {type === 'local' && isWindows() && (
        <div className="drive-selector">
          <RiHardDrive2Fill size={12} />
          <select
            value={currentDrive || 'C:'}
            onChange={(e) => handleDriveChange(e.target.value)}
            className="drive-select"
          >
            {WINDOWS_DRIVES.map(drive => (
              <option key={drive} value={drive}>{drive}</option>
            ))}
          </select>
        </div>
      )}

      {/* Editable path */}
      {isEditing ? (
        <input
          type="text"
          className="path-input"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
        />
      ) : (
        <span
          className="path-display"
          onClick={() => setIsEditing(true)}
          title="클릭하여 경로 편집"
        >
          {path}
        </span>
      )}
    </div>
  )
}
