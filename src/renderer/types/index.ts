export interface SessionConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKeyPath?: string
  passphrase?: string
  folderId?: string
}

export interface FolderConfig {
  id: string
  name: string
}

export interface TerminalSession {
  id: string
  config: SessionConfig
  connected: boolean
}

// Extend Window interface for electronAPI
declare global {
  interface Window {
    electronAPI: {
      // Window controls
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      toggleFullscreen: () => Promise<void>

      // SSH
      sshConnect: (config: any) => Promise<any>
      sshSend: (sessionId: string, data: string) => void
      sshDisconnect: (sessionId: string) => void
      sshResize: (sessionId: string, cols: number, rows: number) => void
      onSshData: (callback: (data: any) => void) => void
      onSshClosed: (callback: (data: any) => void) => void

      // Private Key
      selectPrivateKey: () => Promise<{ success: boolean; path?: string }>

      // SFTP
      sftpOpen: (sessionId: string) => Promise<any>
      sftpClose: (sessionId: string) => Promise<any>
      sftpList: (sessionId: string, remotePath: string) => Promise<any>
      sftpDownload: (sessionId: string, remotePath: string, localPath: string) => Promise<any>
      sftpUpload: (sessionId: string, localPath: string, remotePath: string) => Promise<any>
      sftpDelete: (sessionId: string, remotePath: string, isDirectory: boolean) => Promise<any>
      sftpRename: (sessionId: string, oldPath: string, newPath: string) => Promise<any>
      sftpMkdir: (sessionId: string, remotePath: string) => Promise<any>

      // Transfer Queue
      sftpQueueDownload: (sessionId: string, remotePath: string, localPath: string) => Promise<any>
      sftpQueueUpload: (sessionId: string, localPath: string, remotePath: string) => Promise<any>
      sftpUploadDirectory?: (sessionId: string, localDir: string, remoteDir: string) => Promise<{ success: boolean; uploadedFiles: string[] }>
      sftpTransferPause: (sessionId: string, transferId: string) => Promise<any>
      sftpTransferResume: (sessionId: string, transferId: string) => Promise<any>
      sftpTransferCancel: (sessionId: string, transferId: string) => Promise<any>
      sftpQueueClearCompleted: (sessionId: string) => Promise<any>
      sftpGetQueue: (sessionId: string) => Promise<any>
      onSftpQueueUpdate: (callback: (data: any) => void) => void
      onSftpTransferProgress: (callback: (data: any) => void) => void

      // Local file system
      localList: (dirPath: string) => Promise<any>
      selectLocalFolder: () => Promise<string | null>

      // SFTP Window
      openSftpWindow?: (sessionId: string, localPath: string, remotePath: string) => Promise<any>

      // Terminal Window
      openTerminalWindow: (sessionId: string, title: string) => Promise<any>
      onTerminalMerge: (callback: (data: any) => void) => void

      // Sessions
      loadSessions: () => Promise<any>
      saveSessions: (sessions: any) => Promise<any>
      loadFolders: () => Promise<any>
      saveFolders: (folders: any) => Promise<any>
      exportSessions: (data: any) => Promise<any>
      importSessions: (mode: 'merge' | 'replace') => Promise<any>

      // Master Password
      hasMasterPassword: () => Promise<boolean>
      setupMasterPassword: (password: string) => Promise<{ success: boolean; error?: string }>
      unlockApp: (password: string) => Promise<{ success: boolean; error?: string }>
      lockApp: () => Promise<{ success: boolean }>
      isAppLocked: () => Promise<{ locked: boolean }>
      resetMasterPassword: () => Promise<{ success: boolean }>

      // Terminal zoom
      onTerminalZoom?: (callback: (direction: string) => void) => (() => void)

      // App zoom (Ctrl+mouse wheel)
      appZoomIn?: () => void
      appZoomOut?: () => void
      appZoomReset?: () => void
    }
  }
}
