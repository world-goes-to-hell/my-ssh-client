import { useCallback } from 'react'
import { useTerminalStore } from '../stores/terminalStore'
import { useHistoryStore } from '../stores/historyStore'
import { useStatsStore } from '../stores/statsStore'
import { toast } from '../stores/toastStore'

export function useSSH() {
  const { addTerminal, removeTerminal, setConnecting, setConnected, updateTerminalMeta } = useTerminalStore()

  const connect = useCallback(async (config: {
    host: string
    port: number
    username: string
    authType: 'password' | 'privateKey'
    password?: string
    privateKeyPath?: string
    passphrase?: string
    sessionName?: string
    color?: string
    postConnectScript?: string
  }) => {
    setConnecting(true)
    toast.info('연결 중...', `${config.username}@${config.host}에 연결을 시도합니다`)

    try {
      const result = await window.electronAPI.sshConnect({
        host: config.host,
        port: config.port,
        username: config.username,
        authType: config.authType,
        password: config.password,
        privateKeyPath: config.privateKeyPath,
        passphrase: config.passphrase
      })

      if (result.success) {
        addTerminal(result.sessionId, {
          id: result.sessionId,
          host: config.host,
          username: config.username,
          connected: true,
          color: config.color,
          title: config.sessionName
        })
        setConnected(result.sessionId)

        // Add to connection history
        useHistoryStore.getState().addConnection({
          sessionId: result.sessionId,
          sessionName: config.sessionName || `${config.username}@${config.host}`,
          host: config.host,
          username: config.username
        })

        // Add to stats tracking
        const statsId = useStatsStore.getState().addRecord({
          sessionName: config.sessionName || `${config.username}@${config.host}`,
          host: config.host,
          username: config.username
        })
        // Store statsId in terminal for later disconnect tracking
        updateTerminalMeta(result.sessionId, { statsId })

        toast.success('Connected', `Successfully connected to ${config.username}@${config.host}`)

        // Post-connect script execution
        if (config.postConnectScript?.trim()) {
          const lines = config.postConnectScript.trim().split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('#'))
          if (lines.length > 0) {
            // Wait for shell to be ready
            setTimeout(() => {
              lines.forEach((line, index) => {
                setTimeout(() => {
                  window.electronAPI.sshSend(result.sessionId, line.trim() + '\r')
                }, index * 300)
              })
            }, 500)
          }
        }

        return { success: true, sessionId: result.sessionId }
      } else {
        toast.error('Connection Failed', result.error)
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      toast.error('Connection Error', error.message)
      return { success: false, error: error.message }
    } finally {
      setConnecting(false)
    }
  }, [addTerminal, setConnecting, setConnected, updateTerminalMeta])

  const disconnect = useCallback((sessionId: string) => {
    // End stats record
    const terminal = useTerminalStore.getState().terminals.get(sessionId)
    if (terminal?.statsId) {
      useStatsStore.getState().endRecord(terminal.statsId)
    }

    window.electronAPI.sshDisconnect(sessionId)
    removeTerminal(sessionId)
    toast.info('Disconnected', 'SSH session closed')
  }, [removeTerminal])

  const send = useCallback((sessionId: string, data: string) => {
    // Track command count when Enter key is sent
    if (data === '\r' || data === '\n') {
      const terminal = useTerminalStore.getState().terminals.get(sessionId)
      if (terminal?.statsId) {
        useStatsStore.getState().incrementCommandCount(terminal.statsId)
      }
    }

    window.electronAPI.sshSend(sessionId, data)
  }, [])

  const resize = useCallback((sessionId: string, cols: number, rows: number) => {
    window.electronAPI.sshResize(sessionId, cols, rows)
  }, [])

  return { connect, disconnect, send, resize }
}
