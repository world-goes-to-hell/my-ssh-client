// 세션 및 터미널 관리
const sessions = new Map();
const terminals = new Map();
let activeSessionId = null;
let savedSessions = [];
let editingSessionIndex = -1; // 편집 중인 세션 인덱스 (-1이면 새 세션)

// 폴더 관리
let folders = [];
let expandedFolders = new Set(); // 펼쳐진 폴더 ID 집합

// 화면 분할 관련
let panels = new Map(); // panelId -> { terminal, sessionId, fitAddon }
let activePanelId = '1';
let panelCounter = 1;
let splitDirection = 'horizontal'; // 'horizontal' 또는 'vertical'

// Transfer queue state
let currentTransferQueue = [];

// 비밀번호 모달 관련
let passwordModalResolve = null;
let passwordModalReject = null;

// 비밀번호 입력 모달 표시 (Promise 반환)
function showPasswordModal(title, label, hint = '') {
  return new Promise((resolve, reject) => {
    passwordModalResolve = resolve;
    passwordModalReject = reject;

    document.getElementById('passwordModalTitle').textContent = title;
    document.getElementById('passwordModalLabel').textContent = label;
    document.getElementById('passwordModalHint').textContent = hint;
    document.getElementById('passwordModalInput').value = '';
    document.getElementById('passwordModalInput').type = 'password';
    const modal = document.getElementById('passwordModal');
    modal.style.display = 'flex';
    modal.classList.add('show');

    // 입력 필드에 포커스
    setTimeout(() => {
      document.getElementById('passwordModalInput').focus();
    }, 100);
  });
}

// 일반 텍스트 입력 모달 표시 (Promise 반환)
function showInputModal(title, label, defaultValue = '') {
  return new Promise((resolve, reject) => {
    passwordModalResolve = resolve;
    passwordModalReject = reject;

    document.getElementById('passwordModalTitle').textContent = title;
    document.getElementById('passwordModalLabel').textContent = label;
    document.getElementById('passwordModalHint').textContent = '';
    document.getElementById('passwordModalInput').value = defaultValue;
    document.getElementById('passwordModalInput').type = 'text';
    const modal = document.getElementById('passwordModal');
    modal.style.display = 'flex';
    modal.classList.add('show');

    // 입력 필드에 포커스 및 선택
    setTimeout(() => {
      const input = document.getElementById('passwordModalInput');
      input.focus();
      input.select();
    }, 100);
  });
}

// 비밀번호 모달 확인
function confirmPasswordModal() {
  const value = document.getElementById('passwordModalInput').value;
  const modal = document.getElementById('passwordModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  if (passwordModalResolve) {
    passwordModalResolve(value);
    passwordModalResolve = null;
    passwordModalReject = null;
  }
}

// 비밀번호 모달 취소
function cancelPasswordModal() {
  const modal = document.getElementById('passwordModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  if (passwordModalResolve) {
    passwordModalResolve(null); // null 반환으로 취소 표시
    passwordModalResolve = null;
    passwordModalReject = null;
  }
}

// Enter 키로 비밀번호 모달 확인
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('passwordModal');
  if (modal && modal.style.display === 'flex') {
    if (e.key === 'Enter') {
      confirmPasswordModal();
    } else if (e.key === 'Escape') {
      cancelPasswordModal();
    }
  }
});

// Session activity tracking
const sessionActivity = new Map(); // sessionId -> { hasNewOutput: boolean, lastActivity: Date }

// Session icon selector
let selectedSessionIcon = 'server';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded 실행됨');
  await loadSavedFolders();
  await loadSavedSessions();
  setupSSHListeners();

  // 버튼 이벤트 리스너 직접 등록
  const newSessionBtn = document.querySelector('.btn-new-session');
  console.log('새 연결 버튼 요소:', newSessionBtn);
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
      console.log('새 연결 버튼 클릭됨 (addEventListener)');
      showConnectModal();
    });
  }
});

// SSH 이벤트 리스너 설정
function setupSSHListeners() {
  // Create per-session write buffers
  const writeBuffers = new Map();
  const writeTimeouts = new Map();
  const THROTTLE_MS = 16; // ~60fps

  window.electronAPI.onSshData(({ sessionId, data }) => {
    console.log('SSH 데이터 수신:', sessionId, data.substring(0, 50));
    const terminal = terminals.get(sessionId);
    console.log('터미널 찾음:', !!terminal, 'terminals 크기:', terminals.size);
    if (terminal) {
      let buffer = writeBuffers.get(sessionId) || '';
      buffer += data;
      writeBuffers.set(sessionId, buffer);

      if (!writeTimeouts.has(sessionId)) {
        const timeout = setTimeout(() => {
          const bufferedData = writeBuffers.get(sessionId);
          if (bufferedData) {
            terminal.write(bufferedData);
            writeBuffers.set(sessionId, '');
          }
          writeTimeouts.delete(sessionId);
        }, THROTTLE_MS);
        writeTimeouts.set(sessionId, timeout);
      }

      // Track activity for non-active sessions
      const activePanel = panels.get(activePanelId);
      const activeSession = activePanel?.sessionId;
      if (sessionId !== activeSession) {
        sessionActivity.set(sessionId, { hasNewOutput: true, lastActivity: new Date() });
        updatePanelActivityIndicator(sessionId, true);
      }
    } else {
      console.error('터미널을 찾을 수 없음! sessionId:', sessionId);
      console.log('현재 terminals Map:', [...terminals.keys()]);
    }
  });

  window.electronAPI.onSshClosed(({ sessionId }) => {
    const terminal = terminals.get(sessionId);
    if (terminal) {
      terminal.write('\r\n\x1b[31m연결이 종료되었습니다.\x1b[0m\r\n');
    }
    updateStatusBar('연결 종료됨');
  });

  window.electronAPI.onSshStateChanged(({ sessionId, state }) => {
    console.log(`Session ${sessionId} state: ${state}`);
    updateSessionStateUI(sessionId, state);
  });

  window.electronAPI.onSshReconnecting(({ sessionId, attempt, delay, maxAttempts }) => {
    showReconnectingToast(sessionId, attempt, delay, maxAttempts);
  });

  window.electronAPI.onSshReconnected(({ sessionId }) => {
    showToast('Reconnected successfully', 'success');
    updateSessionStateUI(sessionId, 'connected');
  });

  window.electronAPI.onSshReconnectFailed(({ sessionId, message }) => {
    showToast(`Reconnection failed: ${message}`, 'error');
    updateSessionStateUI(sessionId, 'disconnected');
  });
}

// Toast notification helper
function showToast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  updateStatusBar(message);
}

function showReconnectingToast(sessionId, attempt, delay, maxAttempts) {
  const seconds = Math.ceil(delay / 1000);
  showToast(`Reconnecting... Attempt ${attempt}/${maxAttempts} in ${seconds}s`, 'warning');
}

function updateSessionStateUI(sessionId, state) {
  // Find panel with this sessionId and update status indicator
  for (const [panelId, panel] of panels.entries()) {
    if (panel.sessionId === sessionId) {
      const header = document.querySelector(`#panel-${panelId} .panel-header`);
      if (header) {
        header.dataset.connectionState = state;
      }
      break;
    }
  }
}

// 저장된 폴더 불러오기
async function loadSavedFolders() {
  try {
    const data = await window.electronAPI.loadFolders();
    folders = data.folders || [];
    expandedFolders = new Set(data.expandedFolders || []);
    console.log('폴더 로드됨:', folders.length);
  } catch (error) {
    console.error('폴더 로드 실패:', error);
    folders = [];
    expandedFolders = new Set();
  }
}

// 폴더 저장
async function saveFolders() {
  try {
    await window.electronAPI.saveFolders({
      folders: folders,
      expandedFolders: Array.from(expandedFolders)
    });
    console.log('폴더 저장됨');
  } catch (error) {
    console.error('폴더 저장 실패:', error);
  }
}

// 저장된 세션 불러오기
async function loadSavedSessions() {
  try {
    const result = await window.electronAPI.loadSessions();

    // Handle new encrypted response format
    if (result && typeof result === 'object' && 'sessions' in result) {
      if (!result.success) {
        console.error('Failed to load sessions:', result.error);
        showToast(result.error || 'Failed to load sessions', 'error');
        savedSessions = [];
      } else {
        savedSessions = result.sessions || [];
      }
    } else if (Array.isArray(result)) {
      // Backward compatibility with old format
      savedSessions = result;
    } else {
      savedSessions = [];
    }

    console.log('세션 로드됨:', savedSessions.length);
    renderSessionList();
  } catch (error) {
    console.error('세션 로드 실패:', error);
    savedSessions = [];
  }
}

// 세션 목록 렌더링
function renderSessionList() {
  const sessionList = document.getElementById('sessionList');

  if (savedSessions.length === 0 && folders.length === 0) {
    sessionList.innerHTML = `
      <div class="empty-state">
        <p>저장된 세션이 없습니다</p>
        <p class="hint">새 연결을 추가하세요</p>
      </div>
    `;
    return;
  }

  let html = '';

  // 폴더 렌더링
  folders.forEach(folder => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderSessions = savedSessions.filter(s => s.folderId === folder.id);

    html += `
      <div class="folder-item" data-folder-id="${folder.id}">
        <div class="folder-header">
          <span class="folder-toggle" onclick="toggleFolder('${folder.id}')"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="icon-xs"></i></span>
          <span class="folder-icon"><i data-lucide="folder" class="icon-sm"></i></span>
          <span class="folder-name" ondblclick="renameFolder('${folder.id}')">${folder.name}</span>
          <span class="session-count">(${folderSessions.length})</span>
          <div class="folder-actions">
            <button class="btn-folder-edit" title="이름 변경" onclick="event.stopPropagation(); renameFolder('${folder.id}')">✎</button>
            <button class="btn-folder-delete" title="삭제" onclick="event.stopPropagation(); deleteFolder('${folder.id}')">✕</button>
          </div>
        </div>
        <div class="folder-sessions" style="display: ${isExpanded ? 'block' : 'none'}">
          ${renderSessionsInFolder(folder.id)}
        </div>
      </div>
    `;
  });

  // 폴더에 속하지 않은 세션들 (루트 세션)
  const rootSessions = savedSessions.filter(s => !s.folderId);
  if (rootSessions.length > 0) {
    html += '<div class="root-sessions">' + renderSessionsArray(rootSessions) + '</div>';
  }

  sessionList.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setupSessionEventListeners();
}

// 특정 폴더의 세션 렌더링
function renderSessionsInFolder(folderId) {
  const folderSessions = savedSessions.filter(s => s.folderId === folderId);
  return renderSessionsArray(folderSessions);
}

// 세션 배열 HTML 생성
function renderSessionsArray(sessions) {
  return sessions.map(session => {
    const index = savedSessions.indexOf(session);
    const icon = session.icon || 'server';
    return `
      <div class="session-item" data-index="${index}" draggable="true">
        <div class="session-info">
          <div class="name"><i data-lucide="${icon}" class="icon-sm session-icon"></i> ${session.name} <i data-lucide="${session.authType === 'privateKey' ? 'key' : 'lock'}" class="icon-xs"></i></div>
          <div class="host">${session.username}@${session.host}:${session.port}</div>
        </div>
        <div class="session-actions">
          <button class="btn-edit" title="수정">✎</button>
          <button class="btn-delete" title="삭제">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// 세션 이벤트 리스너 설정
function setupSessionEventListeners() {
  document.querySelectorAll('.session-item').forEach(item => {
    const index = parseInt(item.dataset.index);

    // 세션 정보 클릭 -> 연결
    item.querySelector('.session-info').addEventListener('click', () => {
      connectToSaved(index);
    });

    // 수정 버튼
    item.querySelector('.btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      editSession(e, index);
    });

    // 삭제 버튼
    item.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(e, index);
    });

    // 드래그 앤 드롭 설정
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('sessionIndex', index);
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });

  // 폴더 드롭 영역 설정
  document.querySelectorAll('.folder-header').forEach(header => {
    const folderId = header.closest('.folder-item').dataset.folderId;

    header.addEventListener('dragover', (e) => {
      e.preventDefault();
      header.classList.add('drag-over');
    });

    header.addEventListener('dragleave', () => {
      header.classList.remove('drag-over');
    });

    header.addEventListener('drop', (e) => {
      e.preventDefault();
      header.classList.remove('drag-over');
      const sessionIndex = parseInt(e.dataTransfer.getData('sessionIndex'));
      moveSessionToFolder(sessionIndex, folderId);
    });
  });
}

// 연결 모달 표시
function showConnectModal() {
  console.log('showConnectModal 호출됨');
  const modal = document.getElementById('connectModal');
  console.log('connectModal 요소:', modal);
  if (modal) {
    // 폴더 셀렉트 박스 채우기
    populateFolderSelect();
    modal.classList.add('show');
    console.log('show 클래스 추가됨');
    document.getElementById('sessionName').focus();
  } else {
    console.error('connectModal 요소를 찾을 수 없습니다!');
  }
}

// 폴더 셀렉트 박스 채우기
function populateFolderSelect() {
  const select = document.getElementById('sessionFolder');
  select.innerHTML = '<option value="">루트 (폴더 없음)</option>';

  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    select.appendChild(option);
  });
}

// 연결 모달 숨기기
function hideConnectModal() {
  document.getElementById('connectModal').classList.remove('show');
  clearForm();
}

// 폼 초기화
function clearForm() {
  document.getElementById('sessionName').value = '';
  document.getElementById('host').value = '';
  document.getElementById('port').value = '22';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('privateKeyPath').value = '';
  document.getElementById('passphrase').value = '';
  document.getElementById('saveSession').checked = false;
  document.getElementById('sessionFolder').value = '';
  document.getElementById('connectTimeout').value = '20';
  document.getElementById('keepaliveInterval').value = '30';
  document.getElementById('autoReconnect').checked = true;
  // 인증 방식을 비밀번호로 초기화
  document.querySelector('input[name="authType"][value="password"]').checked = true;
  toggleAuthType();
  // 편집 모드 초기화
  editingSessionIndex = -1;
  document.querySelector('#connectModal .modal-header h2').textContent = '새 SSH 연결';
  // 아이콘 초기화
  selectedSessionIcon = 'server';
  document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
  const defaultIcon = document.querySelector('.icon-option[data-icon="server"]');
  if (defaultIcon) {
    defaultIcon.classList.add('selected');
  }
}

// SSH 연결
async function connect() {
  const authType = document.querySelector('input[name="authType"]:checked').value;

  const config = {
    name: document.getElementById('sessionName').value || 'Unnamed',
    host: document.getElementById('host').value,
    port: parseInt(document.getElementById('port').value) || 22,
    username: document.getElementById('username').value,
    authType: authType,
    icon: selectedSessionIcon,
    connectTimeout: (parseInt(document.getElementById('connectTimeout').value) || 20) * 1000,
    keepaliveInterval: (parseInt(document.getElementById('keepaliveInterval').value) || 30) * 1000,
    autoReconnect: document.getElementById('autoReconnect').checked
  };

  // 인증 방식에 따른 설정
  if (authType === 'privateKey') {
    config.privateKeyPath = document.getElementById('privateKeyPath').value;
    config.passphrase = document.getElementById('passphrase').value;

    if (!config.privateKeyPath) {
      alert('Private Key 파일을 선택해주세요.');
      return;
    }
  } else {
    config.password = document.getElementById('password').value;
  }

  if (!config.host || !config.username) {
    alert('호스트와 사용자명을 입력해주세요.');
    return;
  }

  // 세션 저장 또는 업데이트
  if (document.getElementById('saveSession').checked || editingSessionIndex >= 0) {
    const saveConfig = { ...config };
    delete saveConfig.password;
    delete saveConfig.passphrase;

    // 폴더 설정
    const folderId = document.getElementById('sessionFolder').value;
    if (folderId) {
      saveConfig.folderId = folderId;
    }

    if (editingSessionIndex >= 0) {
      // 기존 세션 업데이트
      savedSessions[editingSessionIndex] = saveConfig;
      console.log('세션 업데이트:', saveConfig.name);
    } else {
      // 새 세션 추가
      savedSessions.push(saveConfig);
      console.log('새 세션 추가:', saveConfig.name);
    }
    window.electronAPI.saveSessions(savedSessions);
    console.log('세션 저장됨, 총 세션 수:', savedSessions.length);
    renderSessionList();
  }

  hideConnectModal();
  updateStatusBar('연결 중...');
  console.log('SSH 연결 시도:', config.host, config.username);

  try {
    const result = await window.electronAPI.sshConnect(config);
    console.log('SSH 연결 결과:', result);
    if (result.success) {
      createTerminalTab(result.sessionId, config);
      updateStatusBar(`연결됨: ${config.username}@${config.host}`);
    } else {
      alert('연결 실패: 알 수 없는 오류');
      updateStatusBar('연결 실패');
    }
  } catch (error) {
    console.error('SSH 연결 오류:', error);
    alert('연결 실패: ' + (error.message || error));
    updateStatusBar('연결 실패');
  }
}

// 저장된 세션으로 연결
async function connectToSaved(index) {
  console.log('connectToSaved 호출됨, index:', index);

  const session = savedSessions[index];
  if (!session) {
    alert('세션 정보를 찾을 수 없습니다.');
    return;
  }

  let config = { ...session };

  // authType이 없으면 기본값 password로 설정 (이전 버전 호환)
  if (!config.authType) {
    config.authType = 'password';
  }

  // 인증 방식에 따른 처리
  if (config.authType === 'privateKey') {
    // Private Key의 경우 passphrase만 필요할 수 있음
    const passphrase = await showPasswordModal(
      `${session.name} 연결`,
      'Passphrase',
      '암호화된 키의 경우 입력하세요 (없으면 비워두세요)'
    );
    if (passphrase === null) return; // 취소됨
    config.passphrase = passphrase;
  } else {
    // 비밀번호 인증
    const password = await showPasswordModal(
      `${session.name} 연결`,
      '비밀번호',
      ''
    );
    if (password === null) return; // 취소됨 (빈 문자열은 허용)
    config.password = password;
  }

  updateStatusBar('연결 중...');
  console.log('SSH 연결 시도:', config.host, config.username);

  try {
    const result = await window.electronAPI.sshConnect(config);
    console.log('SSH 연결 결과:', result);
    if (result.success) {
      createTerminalTab(result.sessionId, config);
      updateStatusBar(`연결됨: ${config.username}@${config.host}`);
    } else {
      alert('연결 실패: 알 수 없는 오류');
      updateStatusBar('연결 실패');
    }
  } catch (error) {
    console.error('SSH 연결 오류:', error);
    alert('연결 실패: ' + (error.message || error));
    updateStatusBar('연결 실패');
  }
}

// 터미널 생성 (패널에)
function createTerminalInPanel(sessionId, config, panelId = null) {
  console.log('createTerminalInPanel 호출됨:', { sessionId, config, panelId, activePanelId });

  // 환영 화면 숨기고 분할 컨테이너 표시
  document.getElementById('welcomeScreen').style.display = 'none';
  const splitContainer = document.getElementById('splitContainer');
  splitContainer.style.display = 'flex';
  splitContainer.style.height = '100%';
  splitContainer.style.flex = '1';
  console.log('splitContainer 표시됨, 크기:', splitContainer.offsetWidth, 'x', splitContainer.offsetHeight);

  // 패널 ID 결정
  if (!panelId) {
    panelId = activePanelId;
  }

  // 기존 패널에 터미널이 있으면 정리
  const existingPanel = panels.get(panelId);
  if (existingPanel && existingPanel.terminal) {
    existingPanel.terminal.dispose();
    if (existingPanel.sessionId) {
      window.electronAPI.sshDisconnect(existingPanel.sessionId);
    }
  }

  const wrapper = document.getElementById(`terminal-panel-${panelId}`);
  console.log('wrapper 요소:', wrapper, 'panelId:', panelId);
  if (!wrapper) {
    console.error('패널을 찾을 수 없습니다:', panelId);
    alert('터미널 패널을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }
  wrapper.innerHTML = '';

  // 강제로 크기 설정
  wrapper.style.display = 'block';
  wrapper.style.height = '100%';
  wrapper.style.minHeight = '300px';

  console.log('wrapper 크기:', wrapper.offsetWidth, 'x', wrapper.offsetHeight);

  // 패널 제목 업데이트
  const titleEl = document.getElementById(`panelTitle-${panelId}`);
  if (titleEl) {
    titleEl.textContent = config.name || `${config.username}@${config.host}`;
  }

  // 패널에도 강제 높이 설정
  const panelEl = document.getElementById(`panel-${panelId}`);
  if (panelEl) {
    panelEl.style.height = '100%';
    panelEl.style.display = 'flex';
    panelEl.style.flexDirection = 'column';
    console.log('패널 크기:', panelEl.offsetWidth, 'x', panelEl.offsetHeight);
  }

  // xterm 터미널 초기화
  const terminal = new Terminal({
    allowProposedApi: true,
    theme: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selection: 'rgba(166, 227, 161, 0.3)',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8'
    },
    fontSize: 14,
    fontFamily: 'Consolas, "D2Coding", monospace',
    cursorBlink: true,
    cursorStyle: 'bar'
  });

  const canvasAddon = new CanvasAddon.CanvasAddon();
  terminal.loadAddon(canvasAddon);
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(wrapper);
  console.log('터미널 open 완료, wrapper:', wrapper, 'wrapper 자식 수:', wrapper.children.length);

  setTimeout(() => {
    try {
      // wrapper 크기 재확인
      console.log('fit 전 wrapper 크기:', wrapper.offsetWidth, 'x', wrapper.offsetHeight);
      fitAddon.fit();
      console.log('터미널 fit 완료, 크기:', terminal.cols, 'x', terminal.rows);
    } catch(e) {
      console.error('fitAddon.fit() 오류:', e);
    }
    // 환영 메시지 표시하여 터미널이 작동하는지 확인
    terminal.write('터미널 연결 중...\r\n');
  }, 200);

  // Resize listener for server sync
  terminal.onResize(({ cols, rows }) => {
    window.electronAPI.sshResize(sessionId, cols, rows);
  });

  // 입력 처리
  terminal.onData(data => {
    window.electronAPI.sshSend(sessionId, data);
  });

  // 패널 정보 저장
  panels.set(panelId, { terminal, sessionId, fitAddon, config });
  sessions.set(sessionId, config);
  terminals.set(sessionId, terminal);
  console.log('터미널 등록됨 - sessionId:', sessionId, 'terminals 크기:', terminals.size);

  // 활성 패널 설정
  setActivePanel(panelId);

  // SFTP 초기화
  initSftp(sessionId);

  // 패널 클릭 이벤트 (panelEl은 위에서 이미 선언됨)
  if (panelEl) {
    panelEl.onclick = () => setActivePanel(panelId);
  }

  // 패널 드래그 설정
  setupPanelDrag(panelId);
}

// 기존 createTerminalTab을 새 함수로 연결 (호환성)
function createTerminalTab(sessionId, config) {
  createTerminalInPanel(sessionId, config, activePanelId);
}

// 탭 전환
function switchTab(sessionId) {
  // 탭 활성화
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.sessionId === sessionId);
  });

  // 터미널 활성화
  document.querySelectorAll('.terminal-wrapper').forEach(wrapper => {
    wrapper.classList.toggle('active', wrapper.id === `terminal-${sessionId}`);
  });

  activeSessionId = sessionId;
  const config = sessions.get(sessionId);
  if (config) {
    updateStatusBar(`연결됨: ${config.username}@${config.host}`);
  }
}

// 탭 닫기
function closeTab(event, sessionId) {
  event.stopPropagation();
  
  // SSH 연결 종료
  window.electronAPI.sshDisconnect(sessionId);
  
  // 터미널 정리
  const terminal = terminals.get(sessionId);
  if (terminal) {
    terminal.dispose();
    terminals.delete(sessionId);
  }
  
  sessions.delete(sessionId);

  // DOM 정리
  const tab = document.querySelector(`.tab[data-session-id="${sessionId}"]`);
  const wrapper = document.getElementById(`terminal-${sessionId}`);
  if (tab) tab.remove();
  if (wrapper) wrapper.remove();

  // 다른 탭으로 전환 또는 환영 화면 표시
  const remainingTabs = document.querySelectorAll('.tab');
  if (remainingTabs.length > 0) {
    switchTab(remainingTabs[0].dataset.sessionId);
  } else {
    document.getElementById('welcomeScreen').style.display = 'flex';
    updateStatusBar('연결 안 됨');
    activeSessionId = null;
  }
}

// 상태바 업데이트
function updateStatusBar(text) {
  document.getElementById('connectionStatus').textContent = text;
}

// 인증 방식 토글
function toggleAuthType() {
  const authType = document.querySelector('input[name="authType"]:checked').value;
  const passwordFields = document.querySelectorAll('.auth-password');
  const privateKeyFields = document.querySelectorAll('.auth-privatekey');

  if (authType === 'password') {
    passwordFields.forEach(el => el.style.display = 'block');
    privateKeyFields.forEach(el => el.style.display = 'none');
  } else {
    passwordFields.forEach(el => el.style.display = 'none');
    privateKeyFields.forEach(el => el.style.display = 'block');
  }
}

// Private Key 파일 선택
async function selectPrivateKey() {
  const result = await window.electronAPI.selectPrivateKey();
  if (result.success) {
    document.getElementById('privateKeyPath').value = result.path;
  }
}

// 세션 편집
function editSession(event, index) {
  event.stopPropagation();
  const session = savedSessions[index];

  // 편집 모드 설정
  editingSessionIndex = index;

  // 모달 제목 변경
  document.querySelector('#connectModal .modal-header h2').textContent = '세션 수정';

  // 폴더 셀렉트 박스 채우기
  populateFolderSelect();

  // 폼에 기존 값 채우기
  document.getElementById('sessionName').value = session.name || '';
  document.getElementById('host').value = session.host || '';
  document.getElementById('port').value = session.port || 22;
  document.getElementById('username').value = session.username || '';
  document.getElementById('privateKeyPath').value = session.privateKeyPath || '';
  document.getElementById('sessionFolder').value = session.folderId || '';

  // 인증 방식 설정
  if (session.authType === 'privateKey') {
    document.querySelector('input[name="authType"][value="privateKey"]').checked = true;
  } else {
    document.querySelector('input[name="authType"][value="password"]').checked = true;
  }
  toggleAuthType();

  // 아이콘 설정
  selectedSessionIcon = session.icon || 'server';
  document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
  const iconBtn = document.querySelector(`.icon-option[data-icon="${selectedSessionIcon}"]`);
  if (iconBtn) {
    iconBtn.classList.add('selected');
  }

  // 세션 저장 체크박스 숨기기 (편집 모드에서는 항상 저장)
  document.getElementById('saveSession').checked = true;

  // 모달 표시
  document.getElementById('connectModal').classList.add('show');
  document.getElementById('sessionName').focus();

  // Lucide 아이콘 재생성
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 세션 삭제
function deleteSession(event, index) {
  event.stopPropagation();
  const session = savedSessions[index];

  if (confirm(`"${session.name}" 세션을 삭제하시겠습니까?`)) {
    savedSessions.splice(index, 1);
    window.electronAPI.saveSessions(savedSessions);
    renderSessionList();
  }
}

// ==================== 폴더 관리 기능 ====================

// 폴더 토글
function toggleFolder(folderId) {
  if (expandedFolders.has(folderId)) {
    expandedFolders.delete(folderId);
  } else {
    expandedFolders.add(folderId);
  }
  saveFolders();
  renderSessionList();
}

// 새 폴더 생성
async function createNewFolder() {
  const name = await showInputModal('새 폴더', '폴더 이름', '새 폴더');
  if (!name) return;

  const folder = {
    id: 'folder-' + Date.now(),
    name: name
  };

  folders.push(folder);
  expandedFolders.add(folder.id);
  saveFolders();
  renderSessionList();
}

// 폴더 이름 변경
async function renameFolder(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;

  const newName = await showInputModal('폴더 이름 변경', '새 이름', folder.name);
  if (!newName || newName === folder.name) return;

  folder.name = newName;
  saveFolders();
  renderSessionList();
}

// 폴더 삭제
function deleteFolder(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;

  const folderSessions = savedSessions.filter(s => s.folderId === folderId);
  let message = `"${folder.name}" 폴더를 삭제하시겠습니까?`;

  if (folderSessions.length > 0) {
    message += `\n\n폴더 내 ${folderSessions.length}개 세션은 루트로 이동됩니다.`;
  }

  if (!confirm(message)) return;

  // 폴더 내 세션들을 루트로 이동
  folderSessions.forEach(session => {
    delete session.folderId;
  });

  // 폴더 삭제
  folders = folders.filter(f => f.id !== folderId);
  expandedFolders.delete(folderId);

  saveFolders();
  window.electronAPI.saveSessions(savedSessions);
  renderSessionList();
}

// 세션을 폴더로 이동
function moveSessionToFolder(sessionIndex, folderId) {
  if (sessionIndex < 0 || sessionIndex >= savedSessions.length) return;

  const session = savedSessions[sessionIndex];

  if (session.folderId === folderId) return; // 이미 같은 폴더에 있음

  session.folderId = folderId;
  window.electronAPI.saveSessions(savedSessions);

  // 폴더 자동 펼치기
  expandedFolders.add(folderId);
  saveFolders();

  renderSessionList();
}

// 세션을 루트로 이동
function moveSessionToRoot(sessionIndex) {
  if (sessionIndex < 0 || sessionIndex >= savedSessions.length) return;

  const session = savedSessions[sessionIndex];
  delete session.folderId;

  window.electronAPI.saveSessions(savedSessions);
  renderSessionList();
}

// ==================== SFTP 기능 ====================

// SFTP 상태
let sftpCurrentPath = '/';
let sftpSelectedFiles = new Set();
let sftpPanelOpen = false;

// 로컬 파일 상태
let localCurrentPath = '';
let localSelectedFiles = new Set();

// SFTP 리사이즈 관련
let isSftpResizing = false;
let sftpStartY = 0;
let sftpStartHeight = 0;

// SFTP 초기화 (터미널 탭 생성 시 호출)
async function initSftp(sessionId) {
  try {
    await window.electronAPI.sftpOpen(sessionId);
    document.getElementById('btnSftpToggle').disabled = false;
    setupSftpProgressListener();
  } catch (error) {
    console.error('SFTP 초기화 실패:', error);
  }
}

// SFTP 진행률 리스너 설정
function setupSftpProgressListener() {
  window.electronAPI.onSftpProgress((data) => {
    if (data.sessionId === activeSessionId) {
      updateSftpProgress(data);
    }
  });
}

// SFTP 패널 토글
function toggleSftpPanel() {
  sftpPanelOpen = !sftpPanelOpen;
  const panel = document.getElementById('sftpPanel');
  const btn = document.getElementById('btnSftpToggle');

  if (sftpPanelOpen) {
    panel.style.display = 'flex';
    btn.classList.add('active');
    sftpRefresh();

    // 로컬 패널 초기화 (처음 열 때만)
    if (!localCurrentPath) {
      initLocalPanel();
    }
  } else {
    panel.style.display = 'none';
    btn.classList.remove('active');
  }
}

// SFTP 패널 리사이즈 설정
function setupSftpResize() {
  const handle = document.getElementById('sftpResizeHandle');
  const panel = document.getElementById('sftpPanel');

  if (!handle || !panel) return;

  handle.addEventListener('mousedown', (e) => {
    isSftpResizing = true;
    sftpStartY = e.clientY;
    sftpStartHeight = panel.offsetHeight;
    handle.classList.add('dragging');

    document.addEventListener('mousemove', doSftpResize);
    document.addEventListener('mouseup', stopSftpResize);
    e.preventDefault();
  });
}

function doSftpResize(e) {
  if (!isSftpResizing) return;

  const panel = document.getElementById('sftpPanel');
  const deltaY = sftpStartY - e.clientY;
  const newHeight = Math.max(150, Math.min(600, sftpStartHeight + deltaY));

  panel.style.height = newHeight + 'px';
}

function stopSftpResize() {
  const handle = document.getElementById('sftpResizeHandle');
  if (handle) {
    handle.classList.remove('dragging');
  }
  isSftpResizing = false;
  document.removeEventListener('mousemove', doSftpResize);
  document.removeEventListener('mouseup', stopSftpResize);
}

// 디렉토리 목록 새로고침
async function sftpRefresh() {
  if (!activeSessionId) return;

  updateSftpStatus('로딩 중...');
  try {
    const files = await window.electronAPI.sftpList(activeSessionId, sftpCurrentPath);
    renderSftpFileList(files);
    document.getElementById('sftpPath').value = sftpCurrentPath;
    updateSftpStatus(`${files.length}개 항목`);
  } catch (error) {
    console.error('SFTP 목록 조회 실패:', error);
    if (error.message && error.message.includes('Permission denied')) {
      updateSftpStatus('접근 권한이 없습니다');
      alert('이 폴더에 접근할 권한이 없습니다.');
    } else {
      updateSftpStatus('오류: ' + error.message);
    }
  }
}

// 파일 목록 렌더링
function renderSftpFileList(files) {
  const container = document.getElementById('sftpFileList');
  sftpSelectedFiles.clear();

  // 루트가 아니면 ".." 엔트리 추가
  const isNotRoot = sftpCurrentPath !== '/';

  let html = '';

  if (isNotRoot) {
    html += `
      <div class="sftp-file-item is-directory"
           ondblclick="sftpGoUp()">
        <span class="file-icon"><i data-lucide="folder" class="icon-sm"></i></span>
        <span class="file-name">..</span>
        <span class="file-size">-</span>
        <span class="file-perms">-</span>
        <span class="file-date">-</span>
      </div>
    `;
  }

  if (files.length === 0 && !isNotRoot) {
    container.innerHTML = '<div class="sftp-empty">빈 폴더입니다</div>';
    return;
  }

  html += files.map(file => `
    <div class="sftp-file-item ${file.isDirectory ? 'is-directory' : ''}"
         data-name="${file.name}"
         data-is-dir="${file.isDirectory}"
         onclick="sftpSelectFile(event, '${file.name}')"
         ondblclick="sftpOpenItem('${file.name}', ${file.isDirectory})"
         oncontextmenu="sftpShowContextMenu(event, '${file.name}')">
      <span class="file-icon"><i data-lucide="${file.isDirectory ? 'folder' : getFileIcon(file.name)}" class="icon-sm"></i></span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${file.isDirectory ? '-' : formatFileSize(file.size)}</span>
      <span class="file-perms">${file.permissions}</span>
      <span class="file-date">${formatDate(file.mtime)}</span>
    </div>
  `).join('');

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 파일 아이콘 결정
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    'txt': 'file-text', 'log': 'file-text', 'md': 'file-text',
    'js': 'file-code', 'ts': 'file-code', 'jsx': 'file-code', 'tsx': 'file-code',
    'py': 'file-code', 'java': 'file-code', 'c': 'file-code', 'cpp': 'file-code',
    'h': 'file-code', 'css': 'file-code', 'html': 'file-code', 'xml': 'file-code',
    'json': 'file-json', 'yaml': 'file-code', 'yml': 'file-code',
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'svg': 'image',
    'zip': 'file-archive', 'tar': 'file-archive', 'gz': 'file-archive', 'rar': 'file-archive',
    'pdf': 'file-text', 'doc': 'file-text', 'docx': 'file-text',
    'sh': 'terminal', 'bash': 'terminal', 'zsh': 'terminal'
  };
  return icons[ext] || 'file';
}

// 파일 크기 포맷
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 날짜 포맷
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// 파일 선택
function sftpSelectFile(event, name) {
  const item = event.currentTarget;

  if (event.ctrlKey) {
    // Ctrl+클릭: 다중 선택
    item.classList.toggle('selected');
    if (sftpSelectedFiles.has(name)) {
      sftpSelectedFiles.delete(name);
    } else {
      sftpSelectedFiles.add(name);
    }
  } else {
    // 단일 선택
    document.querySelectorAll('.sftp-file-item.selected').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    sftpSelectedFiles.clear();
    sftpSelectedFiles.add(name);
  }
}

// 파일/폴더 열기
function sftpOpenItem(name, isDirectory) {
  if (isDirectory) {
    // 경로 정규화: 이중 슬래시 방지
    const basePath = sftpCurrentPath.replace(/\/+$/, '');
    if (basePath === '' || basePath === '/') {
      sftpCurrentPath = '/' + name;
    } else {
      sftpCurrentPath = basePath + '/' + name;
    }
    sftpRefresh();
  } else {
    sftpDownloadFile(name);
  }
}

// 상위 폴더로 이동
function sftpGoUp() {
  if (sftpCurrentPath === '/' || sftpCurrentPath === '') return;
  // 경로 정규화: 후행 슬래시 제거 후 처리
  const normalized = sftpCurrentPath.replace(/\/+$/, '');
  const parts = normalized.split('/').filter(p => p);
  parts.pop();
  sftpCurrentPath = parts.length === 0 ? '/' : '/' + parts.join('/');
  sftpRefresh();
}

// 경로로 이동
function sftpNavigate() {
  const path = document.getElementById('sftpPath').value.trim() || '/';
  sftpCurrentPath = path;
  sftpRefresh();
}

// 파일 다운로드
async function sftpDownloadFile(name) {
  const remotePath = sftpCurrentPath === '/' ? '/' + name : sftpCurrentPath + '/' + name;

  const result = await window.electronAPI.selectDownloadPath(name);
  if (!result.success) return;

  updateSftpStatus('다운로드 중...');
  showSftpProgress();

  try {
    await window.electronAPI.sftpDownload(activeSessionId, remotePath, result.path);
    updateSftpStatus('다운로드 완료: ' + name);
  } catch (error) {
    updateSftpStatus('다운로드 실패: ' + error.message);
  }

  hideSftpProgress();
}

// 선택된 파일 다운로드
async function sftpDownloadSelected() {
  hideContextMenu();

  if (!localCurrentPath) {
    alert('Please select a local folder first.');
    return;
  }

  const files = [...sftpSelectedFiles];

  for (const name of files) {
    const remotePath = sftpCurrentPath === '/' ? '/' + name : sftpCurrentPath + '/' + name;
    await window.electronAPI.sftpQueueDownload(activeSessionId, remotePath, localCurrentPath);
  }

  sftpSelectedFiles.clear();
  if (files.length > 0) {
    updateSftpStatus(`${files.length} file(s) added to download queue`);
  }
}

// 업로드 다이얼로그
async function sftpUploadDialog() {
  const result = await window.electronAPI.selectUploadFiles();
  if (!result.success) return;

  for (const localPath of result.paths) {
    await sftpUploadFile(localPath);
  }
  sftpRefresh();
}

// 파일 업로드
async function sftpUploadFile(localPath) {
  const fileName = localPath.split(/[/\\]/).pop();
  const remotePath = sftpCurrentPath === '/' ? '/' + fileName : sftpCurrentPath + '/' + fileName;

  await window.electronAPI.sftpQueueUpload(activeSessionId, localPath, remotePath);
  updateSftpStatus('Added to upload queue: ' + fileName);
}

// 새 폴더 생성
async function sftpNewFolder() {
  hideContextMenu();
  const name = await showInputModal('새 폴더', '폴더 이름', '');
  if (!name) return;

  const remotePath = sftpCurrentPath === '/' ? '/' + name : sftpCurrentPath + '/' + name;

  try {
    await window.electronAPI.sftpMkdir(activeSessionId, remotePath);
    sftpRefresh();
  } catch (error) {
    alert('폴더 생성 실패: ' + error.message);
  }
}

// 이름 변경
async function sftpRenameSelected() {
  hideContextMenu();
  if (sftpSelectedFiles.size !== 1) return;

  const oldName = [...sftpSelectedFiles][0];
  const newName = await showInputModal('이름 변경', '새 이름', oldName);
  if (!newName || newName === oldName) return;

  const oldPath = sftpCurrentPath === '/' ? '/' + oldName : sftpCurrentPath + '/' + oldName;
  const newPath = sftpCurrentPath === '/' ? '/' + newName : sftpCurrentPath + '/' + newName;

  try {
    await window.electronAPI.sftpRename(activeSessionId, oldPath, newPath);
    sftpRefresh();
  } catch (error) {
    alert('이름 변경 실패: ' + error.message);
  }
}

// 선택된 항목 삭제
async function sftpDeleteSelected() {
  hideContextMenu();
  if (sftpSelectedFiles.size === 0) return;

  const names = [...sftpSelectedFiles];
  if (!confirm(`${names.length}개 항목을 삭제하시겠습니까?`)) return;

  for (const name of names) {
    const remotePath = sftpCurrentPath === '/' ? '/' + name : sftpCurrentPath + '/' + name;
    const isDir = document.querySelector(`[data-name="${name}"]`).dataset.isDir === 'true';

    try {
      await window.electronAPI.sftpDelete(activeSessionId, remotePath, isDir);
    } catch (error) {
      alert(`삭제 실패 (${name}): ` + error.message);
    }
  }

  sftpRefresh();
}

// 컨텍스트 메뉴 표시
function sftpShowContextMenu(event, name) {
  event.preventDefault();

  if (!sftpSelectedFiles.has(name)) {
    sftpSelectFile({ currentTarget: event.currentTarget, ctrlKey: false }, name);
  }

  const menu = document.getElementById('sftpContextMenu');
  menu.style.display = 'block';

  // Get menu dimensions
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate position with boundary detection
  let left = event.pageX;
  let top = event.pageY;

  // Check right edge overflow
  if (left + menuWidth > viewportWidth) {
    left = event.pageX - menuWidth;
  }

  // Check bottom edge overflow
  if (top + menuHeight > viewportHeight) {
    top = event.pageY - menuHeight;
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

// 컨텍스트 메뉴 숨기기
function hideContextMenu() {
  document.getElementById('sftpContextMenu').style.display = 'none';
}

// 원격 드래그 앤 드롭 (로컬 -> 원격 업로드)
function sftpDragOver(event) {
  event.preventDefault();

  const source = event.dataTransfer.getData('source');
  if (source === 'local' || event.dataTransfer.files.length > 0) {
    document.getElementById('sftpDropOverlay').classList.add('show');
    event.dataTransfer.dropEffect = 'copy';
  }
}

function sftpDragLeave(event) {
  event.preventDefault();
  document.getElementById('sftpDropOverlay').classList.remove('show');
}

async function sftpDrop(event) {
  event.preventDefault();
  document.getElementById('sftpDropOverlay').classList.remove('show');

  const source = event.dataTransfer.getData('source');
  let fileCount = 0;

  if (source === 'local') {
    // 로컬 패널에서 드래그한 파일
    const localPath = event.dataTransfer.getData('text/plain');
    if (localPath) {
      await sftpUploadFile(localPath);
      fileCount = 1;
    }
  } else {
    // 외부에서 드래그한 파일
    const files = event.dataTransfer.files;
    for (const file of files) {
      if (file.path) {
        await sftpUploadFile(file.path);
        fileCount++;
      }
    }
  }

  if (fileCount > 0) {
    updateSftpStatus(`${fileCount} file(s) added to upload queue`);
  }
}

// 진행률 업데이트
function updateSftpProgress(data) {
  const bar = document.getElementById('sftpProgressBar');
  const text = document.getElementById('sftpProgressText');

  bar.style.width = data.progress + '%';
  text.textContent = `${data.progress}% (${formatFileSize(data.loaded)}/${formatFileSize(data.total)})`;
}

function showSftpProgress() {
  document.getElementById('sftpProgressContainer').style.display = 'flex';
}

function hideSftpProgress() {
  document.getElementById('sftpProgressContainer').style.display = 'none';
  document.getElementById('sftpProgressBar').style.width = '0%';
}

// 상태 업데이트
function updateSftpStatus(text) {
  document.getElementById('sftpStatusText').textContent = text;
}

// 문서 클릭 시 컨텍스트 메뉴 닫기
document.addEventListener('click', () => {
  hideContextMenu();
  hideLocalContextMenu();
});

// ==================== 화면 분할 기능 ====================

// 활성 패널 설정
function setActivePanel(panelId) {
  activePanelId = panelId;

  // 모든 패널 비활성화
  document.querySelectorAll('.split-panel').forEach(p => p.classList.remove('active'));

  // 선택한 패널 활성화
  const panel = document.getElementById(`panel-${panelId}`);
  if (panel) {
    panel.classList.add('active');
  }

  // 해당 패널의 세션 정보로 상태바 업데이트
  const panelData = panels.get(panelId);
  if (panelData && panelData.config) {
    updateStatusBar(`연결됨: ${panelData.config.username}@${panelData.config.host}`);
    // SFTP 버튼 활성화
    document.getElementById('btnSftpToggle').disabled = false;
    activeSessionId = panelData.sessionId;

    // Clear activity indicator when panel becomes active
    if (panelData.sessionId) {
      sessionActivity.delete(panelData.sessionId);
      updatePanelActivityIndicator(panelData.sessionId, false);
    }
  }
}

// 수평 분할
function splitHorizontal() {
  splitDirection = 'horizontal';
  createSplitPanel();
}

// 수직 분할
function splitVertical() {
  splitDirection = 'vertical';
  createSplitPanel();
}

// 분할 패널 생성
function createSplitPanel() {
  const container = document.getElementById('splitContainer');
  container.className = `split-container ${splitDirection}`;
  container.style.display = 'flex';
  document.getElementById('welcomeScreen').style.display = 'none';

  panelCounter++;
  const newPanelId = panelCounter.toString();

  // 리사이즈 핸들 생성
  const handle = document.createElement('div');
  handle.className = `resize-handle ${splitDirection}`;
  handle.onmousedown = (e) => startResize(e, handle);

  // 새 패널 생성
  const newPanel = document.createElement('div');
  newPanel.className = 'split-panel';
  newPanel.id = `panel-${newPanelId}`;
  newPanel.dataset.panelId = newPanelId;
  newPanel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title" id="panelTitle-${newPanelId}">새 터미널</span>
      <button class="btn-panel-close" onclick="closePanel('${newPanelId}')" title="패널 닫기">✕</button>
    </div>
    <div class="terminal-wrapper" id="terminal-panel-${newPanelId}">
      <div class="panel-empty">세션을 선택하세요</div>
    </div>
  `;
  newPanel.onclick = () => setActivePanel(newPanelId);

  container.appendChild(handle);
  container.appendChild(newPanel);

  // 새 패널을 활성화
  setActivePanel(newPanelId);

  // 패널 드래그 설정
  setupPanelDrag(newPanelId);

  // 모든 터미널 리사이즈
  resizeAllTerminals();
}

// 패널 닫기
function closePanel(panelId) {
  const panel = document.getElementById(`panel-${panelId}`);
  if (!panel) return;

  // 패널 데이터 정리
  const panelData = panels.get(panelId);
  if (panelData) {
    if (panelData.terminal) {
      panelData.terminal.dispose();
    }
    if (panelData.sessionId) {
      window.electronAPI.sshDisconnect(panelData.sessionId);
      terminals.delete(panelData.sessionId);
      sessions.delete(panelData.sessionId);
    }
    panels.delete(panelId);
  }

  // 이전 리사이즈 핸들 제거
  const prevSibling = panel.previousElementSibling;
  if (prevSibling && prevSibling.classList.contains('resize-handle')) {
    prevSibling.remove();
  }

  panel.remove();

  // 남은 패널 확인
  const remainingPanels = document.querySelectorAll('.split-panel');
  if (remainingPanels.length === 0) {
    // 모든 패널이 닫히면 환영 화면 표시
    document.getElementById('splitContainer').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
    updateStatusBar('연결 안 됨');
    document.getElementById('btnSftpToggle').disabled = true;
    activeSessionId = null;

    // 패널 카운터 리셋하고 기본 패널 재생성
    panelCounter = 1;
    resetDefaultPanel();
  } else {
    // 첫 번째 패널 활성화
    const firstPanel = remainingPanels[0];
    setActivePanel(firstPanel.dataset.panelId);
    resizeAllTerminals();
  }
}

// 기본 패널 재생성
function resetDefaultPanel() {
  const container = document.getElementById('splitContainer');
  container.innerHTML = `
    <div class="split-panel active" id="panel-1" data-panel-id="1">
      <div class="panel-header">
        <span class="panel-title" id="panelTitle-1">터미널</span>
        <button class="btn-panel-close" onclick="closePanel('1')" title="패널 닫기">✕</button>
      </div>
      <div class="terminal-wrapper" id="terminal-panel-1"></div>
    </div>
  `;
  activePanelId = '1';
}

// 리사이즈 시작
let isResizing = false;
let resizeHandle = null;

function startResize(e, handle) {
  isResizing = true;
  resizeHandle = handle;
  handle.classList.add('dragging');
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

function doResize(e) {
  if (!isResizing || !resizeHandle) return;

  const container = document.getElementById('splitContainer');
  const panels = Array.from(container.querySelectorAll('.split-panel'));
  const handleIndex = Array.from(container.children).indexOf(resizeHandle);

  const prevPanel = container.children[handleIndex - 1];
  const nextPanel = container.children[handleIndex + 1];

  if (!prevPanel || !nextPanel) return;

  const containerRect = container.getBoundingClientRect();

  if (splitDirection === 'horizontal') {
    const x = e.clientX - containerRect.left;
    const totalWidth = containerRect.width;
    const handleWidth = resizeHandle.offsetWidth;

    const prevWidth = Math.max(200, Math.min(x - handleWidth / 2, totalWidth - 200));
    prevPanel.style.flex = 'none';
    prevPanel.style.width = prevWidth + 'px';
    nextPanel.style.flex = '1';
  } else {
    const y = e.clientY - containerRect.top;
    const totalHeight = containerRect.height;
    const handleHeight = resizeHandle.offsetHeight;

    const prevHeight = Math.max(150, Math.min(y - handleHeight / 2, totalHeight - 150));
    prevPanel.style.flex = 'none';
    prevPanel.style.height = prevHeight + 'px';
    nextPanel.style.flex = '1';
  }

  resizeAllTerminals();
}

function stopResize() {
  if (resizeHandle) {
    resizeHandle.classList.remove('dragging');
  }
  isResizing = false;
  resizeHandle = null;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
  resizeAllTerminals();
}

// 모든 터미널 리사이즈
function resizeAllTerminals() {
  panels.forEach((panelData) => {
    if (panelData.fitAddon) {
      setTimeout(() => panelData.fitAddon.fit(), 50);
    }
  });
}

// 윈도우 리사이즈 이벤트
window.addEventListener('resize', resizeAllTerminals);

// ==================== 탭 드래그 분할 ====================

let draggedPanelId = null;

// 패널 헤더 드래그 설정 (createTerminalInPanel이나 createSplitPanel에서 호출)
function setupPanelDrag(panelId) {
  const panel = document.getElementById(`panel-${panelId}`);
  if (!panel) return;

  const header = panel.querySelector('.panel-header');
  if (!header) return;

  header.draggable = true;

  header.addEventListener('dragstart', (e) => {
    draggedPanelId = panelId;
    header.style.cursor = 'grabbing';
    panel.classList.add('dragging');

    // 드롭 존 표시
    showDropZones();

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  });

  header.addEventListener('dragend', () => {
    header.style.cursor = 'grab';
    panel.classList.remove('dragging');
    hideDropZones();
    draggedPanelId = null;
  });
}

// 드롭 존 표시
function showDropZones() {
  const overlay = document.getElementById('dropZoneOverlay');
  if (overlay) {
    overlay.style.display = 'block';
    overlay.classList.add('active');
  }
}

// 드롭 존 숨기기
function hideDropZones() {
  const overlay = document.getElementById('dropZoneOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('active');
    overlay.querySelectorAll('.drop-zone').forEach(zone => {
      zone.classList.remove('drag-over');
    });
  }
}

// 드롭 존 이벤트 설정
function setupDropZones() {
  const overlay = document.getElementById('dropZoneOverlay');
  if (!overlay) return;

  overlay.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const direction = zone.dataset.direction;

      if (draggedPanelId && direction !== 'center') {
        // 새 패널 생성하고 분할
        splitInDirection(direction);
      }

      hideDropZones();
    });
  });
}

// 방향에 따라 분할
function splitInDirection(direction) {
  if (direction === 'left' || direction === 'right') {
    splitDirection = 'horizontal';
  } else {
    splitDirection = 'vertical';
  }

  createSplitPanel();

  // 방향에 따라 패널 순서 조정
  if (direction === 'left' || direction === 'top') {
    const container = document.getElementById('splitContainer');
    const panelsList = Array.from(container.querySelectorAll('.split-panel'));
    const handles = Array.from(container.querySelectorAll('.resize-handle'));

    // 새로 생성된 패널이 마지막에 있으므로 첫 번째로 이동
    if (panelsList.length >= 2) {
      const newPanel = panelsList[panelsList.length - 1];
      const handle = handles[handles.length - 1];
      container.insertBefore(newPanel, container.firstChild);
      if (handle) {
        container.insertBefore(handle, newPanel.nextSibling);
      }
    }
  }
}

// ==================== 로컬 파일 브라우저 ====================

// 로컬 패널 초기화
async function initLocalPanel() {
  const result = await window.electronAPI.selectLocalFolder();
  if (result.success) {
    localCurrentPath = result.path;
  } else {
    localCurrentPath = 'C:\\';
  }
  localRefresh();
}

// 로컬 디렉토리 새로고침
async function localRefresh() {
  if (!localCurrentPath) return;

  updateSftpStatus('로컬 폴더 로딩 중...');
  try {
    const files = await window.electronAPI.localList(localCurrentPath);
    renderLocalFileList(files);
    document.getElementById('localPath').value = localCurrentPath;
    updateSftpStatus(`로컬: ${files.length}개 항목`);
  } catch (error) {
    updateSftpStatus('로컬 폴더 오류: ' + error.message);
  }
}

// 로컬 파일 목록 렌더링
function renderLocalFileList(files) {
  const container = document.getElementById('localFileList');
  localSelectedFiles.clear();

  // ".." 부모 폴더 엔트리 추가 여부 확인 (Windows 경로)
  const isNotRoot = !/^[A-Za-z]:\\?$/.test(localCurrentPath);

  let html = '';

  // 루트가 아니면 ".." 엔트리 추가
  if (isNotRoot) {
    html += `
      <div class="sftp-file-item is-directory"
           ondblclick="localGoUp()">
        <span class="file-icon"><i data-lucide="folder" class="icon-sm"></i></span>
        <span class="file-name">..</span>
        <span class="file-size">-</span>
      </div>
    `;
  }

  if (files.length === 0 && !isNotRoot) {
    container.innerHTML = '<div class="sftp-empty">빈 폴더입니다</div>';
    return;
  }

  html += files.map(file => `
    <div class="sftp-file-item ${file.isDirectory ? 'is-directory' : ''}"
         data-name="${file.name}"
         data-path="${file.path}"
         data-is-dir="${file.isDirectory}"
         draggable="${!file.isDirectory}"
         onclick="localSelectFile(event, '${file.name}')"
         ondblclick="localOpenItem('${file.path.replace(/\\/g, '\\\\')}', ${file.isDirectory})"
         oncontextmenu="localShowContextMenu(event, '${file.name}')">
      <span class="file-icon"><i data-lucide="${file.isDirectory ? 'folder' : getFileIcon(file.name)}" class="icon-sm"></i></span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${file.isDirectory ? '-' : formatFileSize(file.size)}</span>
    </div>
  `).join('');

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 로컬 파일 선택
function localSelectFile(event, name) {
  const item = event.currentTarget;

  if (event.ctrlKey) {
    item.classList.toggle('selected');
    if (localSelectedFiles.has(name)) {
      localSelectedFiles.delete(name);
    } else {
      localSelectedFiles.add(name);
    }
  } else {
    document.querySelectorAll('#localFileList .sftp-file-item.selected').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    localSelectedFiles.clear();
    localSelectedFiles.add(name);
  }
}

// 로컬 항목 열기
function localOpenItem(fullPath, isDirectory) {
  if (isDirectory) {
    localCurrentPath = fullPath;
    localRefresh();
  }
}

// 로컬 상위 폴더로 이동
function localGoUp() {
  if (!localCurrentPath) return;

  // Windows 경로에서 상위 폴더 계산
  let parentPath;
  const normalized = localCurrentPath.replace(/\\/g, '/');

  // 루트 드라이브인지 확인 (예: C:/ 또는 C:\)
  if (/^[A-Za-z]:\/?$/.test(localCurrentPath)) {
    return; // 루트면 더 이상 올라갈 수 없음
  }

  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 2) {
    // C:/folder -> C:/
    parentPath = normalized.substring(0, 3);
  } else {
    parentPath = normalized.substring(0, lastSlash);
  }

  // Windows 형식으로 변환
  parentPath = parentPath.replace(/\//g, '\\');

  if (parentPath !== localCurrentPath) {
    localCurrentPath = parentPath;
    localRefresh();
  }
}

// 로컬 경로로 이동
function localNavigate() {
  const path = document.getElementById('localPath').value.trim();
  if (path) {
    localCurrentPath = path;
    localRefresh();
  }
}

// 로컬 드래그 시작
function localDragStart(event) {
  const item = event.target.closest('.sftp-file-item');
  if (!item || item.dataset.isDir === 'true') {
    event.preventDefault();
    return;
  }

  item.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', item.dataset.path);
  event.dataTransfer.setData('source', 'local');
}

// 로컬 드래그 오버
function localDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

// 로컬 드래그 리브
function localDragLeave(event) {
  event.preventDefault();
}

// 로컬 드롭 (원격 -> 로컬 다운로드)
async function localDrop(event) {
  event.preventDefault();

  const source = event.dataTransfer.getData('source');
  if (source !== 'remote') return;

  const fileName = event.dataTransfer.getData('fileName');
  if (!fileName) return;

  // 원격 파일을 로컬로 다운로드
  await sftpDownloadToLocal(fileName);
}

// 원격 드래그 시작
function sftpDragStart(event) {
  const item = event.target.closest('.sftp-file-item');
  if (!item || item.dataset.isDir === 'true') {
    event.preventDefault();
    return;
  }

  item.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('fileName', item.dataset.name);
  event.dataTransfer.setData('source', 'remote');
}

// 원격 파일을 로컬로 다운로드
async function sftpDownloadToLocal(fileName) {
  if (!localCurrentPath) {
    alert('로컬 폴더를 먼저 선택하세요.');
    return;
  }

  const remotePath = sftpCurrentPath === '/' ? '/' + fileName : sftpCurrentPath + '/' + fileName;

  await window.electronAPI.sftpQueueDownload(activeSessionId, remotePath, localCurrentPath);
  updateSftpStatus('Added to download queue: ' + fileName);
}

// ==================== 로컬 파일 업로드 ====================

// 로컬 파일 원격 업로드
async function localUploadSelected() {
  hideLocalContextMenu();

  if (localSelectedFiles.size === 0) {
    showToast('선택된 파일이 없습니다', 'warning');
    return;
  }

  if (!activeSessionId) {
    showToast('SSH 연결이 필요합니다', 'error');
    return;
  }

  const files = [...localSelectedFiles];
  let uploadCount = 0;

  for (const name of files) {
    const localPath = localCurrentPath.endsWith('/') || localCurrentPath.endsWith('\\')
      ? localCurrentPath + name
      : localCurrentPath + '\\' + name;

    // Check if it's a file (not directory) by checking the element's data attribute
    const item = document.querySelector(`#localFileList .sftp-file-item[data-name="${name}"]`);
    const isDir = item && item.dataset.isDir === 'true';

    if (isDir) {
      showToast(`폴더 업로드는 지원되지 않습니다: ${name}`, 'warning');
      continue;
    }

    await sftpUploadFile(localPath);
    uploadCount++;
  }

  if (uploadCount > 0) {
    showToast(`${uploadCount}개 파일이 업로드 큐에 추가되었습니다`, 'success');
    sftpRefresh();
  }

  localSelectedFiles.clear();
}

// 로컬 컨텍스트 메뉴 표시
function localShowContextMenu(event, name) {
  event.preventDefault();

  if (!localSelectedFiles.has(name)) {
    localSelectFile({ currentTarget: event.currentTarget, ctrlKey: false }, name);
  }

  const menu = document.getElementById('localContextMenu');
  menu.style.display = 'block';

  // Position menu
  const menuWidth = menu.offsetWidth || 150;
  const menuHeight = menu.offsetHeight || 100;

  let x = event.clientX;
  let y = event.clientY;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

// 로컬 컨텍스트 메뉴 숨기기
function hideLocalContextMenu() {
  const menu = document.getElementById('localContextMenu');
  if (menu) menu.style.display = 'none';
}

// 탐색기에서 열기
async function localOpenInExplorer() {
  hideLocalContextMenu();
  showToast('탐색기 열기 기능은 추후 지원 예정입니다', 'info');
}

// Session switching shortcuts
function switchToNextPanel() {
  const panelIds = Array.from(panels.keys());
  if (panelIds.length <= 1) return;
  const currentIdx = panelIds.indexOf(activePanelId);
  const nextIdx = (currentIdx + 1) % panelIds.length;
  setActivePanel(panelIds[nextIdx]);
}

function switchToPreviousPanel() {
  const panelIds = Array.from(panels.keys());
  if (panelIds.length <= 1) return;
  const currentIdx = panelIds.indexOf(activePanelId);
  const prevIdx = (currentIdx - 1 + panelIds.length) % panelIds.length;
  setActivePanel(panelIds[prevIdx]);
}

function switchToPanelByIndex(index) {
  const panelIds = Array.from(panels.keys());
  if (index >= 0 && index < panelIds.length) {
    setActivePanel(panelIds[index]);
  }
}

// Update panel activity indicator
function updatePanelActivityIndicator(sessionId, hasActivity) {
  // Find panel with this sessionId
  for (const [panelId, panel] of panels.entries()) {
    if (panel.sessionId === sessionId) {
      const header = document.querySelector(`#panel-${panelId} .panel-header`);
      if (header) {
        if (hasActivity) {
          header.classList.add('has-activity');
        } else {
          header.classList.remove('has-activity');
        }
      }
      break;
    }
  }
}

// DOMContentLoaded에서 드롭 존 설정
document.addEventListener('DOMContentLoaded', () => {
  setupDropZones();
  setupPanelDrag('1');
  setupSftpResize();

  // 드래그 종료 이벤트
  document.addEventListener('dragend', () => {
    document.querySelectorAll('.sftp-file-item.dragging').forEach(item => {
      item.classList.remove('dragging');
    });
  });

  // Session switching shortcuts
  document.addEventListener('keydown', (e) => {
    // Skip if typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl+Tab: Next session
    if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      switchToNextPanel();
    }
    // Ctrl+Shift+Tab: Previous session
    if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      switchToPreviousPanel();
    }
    // Ctrl+1-9: Direct panel switch
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      switchToPanelByIndex(parseInt(e.key) - 1);
    }
  });

  // Initialize icon selector
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSessionIcon = btn.dataset.icon;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  });

  // Setup transfer queue listeners
  setupTransferQueueListeners();
});

// ==================== Transfer Queue ====================

function setupTransferQueueListeners() {
  // Listen for queue updates
  window.electronAPI.onSftpQueueUpdate(({ sessionId, queue }) => {
    if (sessionId === activeSessionId) {
      currentTransferQueue = queue;
      renderTransferQueue();
    }
  });

  // Listen for progress updates
  window.electronAPI.onSftpTransferProgress(({ sessionId, transferId, progress, speed, size }) => {
    if (sessionId === activeSessionId) {
      const transfer = currentTransferQueue.find(t => t.id === transferId);
      if (transfer) {
        transfer.progress = progress;
        transfer.speed = speed;
        transfer.size = size;
        updateTransferItem(transferId);
      }
    }
  });
}

function renderTransferQueue() {
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');

  if (!queueList) return;

  queueCount.textContent = currentTransferQueue.length;

  if (currentTransferQueue.length === 0) {
    queueList.innerHTML = '<div class="queue-empty">No transfers</div>';
    return;
  }

  queueList.innerHTML = currentTransferQueue.map(t => `
    <div class="transfer-item ${t.status}" id="transfer-${t.id}" style="--progress: ${t.progress}%">
      <span class="transfer-icon ${t.type}">
        ${t.type === 'upload' ? '<i data-lucide="upload"></i>' : '<i data-lucide="download"></i>'}
      </span>
      <span class="transfer-name" title="${t.fileName}">${t.fileName}</span>
      <div class="transfer-info">
        <span class="transfer-progress-text">${t.progress}%</span>
        <span class="transfer-speed ${t.status === 'error' ? 'transfer-error' : ''}" title="${t.error || ''}">${getTransferStatusText(t)}</span>
      </div>
      <div class="transfer-actions">
        ${t.status === 'active' ? `<button onclick="pauseTransfer('${t.id}')" title="Pause"><i data-lucide="pause"></i></button>` : ''}
        ${t.status === 'paused' ? `<button onclick="resumeTransfer('${t.id}')" title="Resume"><i data-lucide="play"></i></button>` : ''}
        ${t.status !== 'completed' ? `<button onclick="cancelTransfer('${t.id}')" title="Cancel"><i data-lucide="x"></i></button>` : ''}
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateTransferItem(transferId) {
  const transfer = currentTransferQueue.find(t => t.id === transferId);
  if (!transfer) return;

  const item = document.getElementById(`transfer-${transferId}`);
  if (item) {
    item.style.setProperty('--progress', `${transfer.progress}%`);
    const progressText = item.querySelector('.transfer-progress-text');
    if (progressText) progressText.textContent = `${transfer.progress}%`;
    if (transfer.status === 'active') {
      const speedText = item.querySelector('.transfer-speed');
      if (speedText) speedText.textContent = formatSpeed(transfer.speed);
    }
  }
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return '0 B/s';
  if (bytesPerSec > 1024 * 1024) return (bytesPerSec / 1024 / 1024).toFixed(1) + ' MB/s';
  if (bytesPerSec > 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return bytesPerSec.toFixed(0) + ' B/s';
}

function getTransferStatusText(transfer) {
  if (transfer.status === 'active') {
    return formatSpeed(transfer.speed);
  }
  if (transfer.status === 'error' && transfer.error) {
    // Translate common errors to Korean
    const errorMap = {
      'Permission denied': '권한 거부됨',
      'No such file': '파일 없음',
      'No such file or directory': '파일/폴더 없음',
      'Connection reset': '연결 끊김',
      'No SFTP connection': 'SFTP 연결 없음',
      'No SSH connection': 'SSH 연결 없음',
      'ENOENT': '파일 없음',
      'EACCES': '접근 거부됨',
      'ENOSPC': '저장 공간 부족',
      'Failure': '실패'
    };

    // Check if error message contains known patterns
    for (const [key, value] of Object.entries(errorMap)) {
      if (transfer.error.includes(key)) {
        return value;
      }
    }
    // Return shortened error message
    return transfer.error.length > 15 ? transfer.error.substring(0, 15) + '...' : transfer.error;
  }

  // Status translations
  const statusMap = {
    'queued': '대기 중',
    'paused': '일시정지',
    'completed': '완료',
    'error': '오류'
  };
  return statusMap[transfer.status] || transfer.status;
}

async function pauseTransfer(transferId) {
  await window.electronAPI.sftpTransferPause(activeSessionId, transferId);
}

async function resumeTransfer(transferId) {
  await window.electronAPI.sftpTransferResume(activeSessionId, transferId);
}

async function cancelTransfer(transferId) {
  await window.electronAPI.sftpTransferCancel(activeSessionId, transferId);
}

async function clearCompletedTransfers() {
  await window.electronAPI.sftpQueueClearCompleted(activeSessionId);
}
