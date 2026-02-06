# My SSH Client

예쁜 UI의 간단한 SSH 클라이언트입니다.

## 설치 및 실행 방법

### 1. 의존성 설치
```bash
cd D:\DEV\WORKSPACE\ELECTRON\my-ssh-client
npm install
```

### 2. 개발 모드 실행 (테스트용)
```bash
npm start
```

### 3. EXE 파일 빌드
```bash
npm run build
```
→ `dist` 폴더에 `MySSHClient.exe` 파일 생성됨

## 기능
- SSH 연결
- 다중 탭 지원
- 세션 저장
- 다크 테마 UI

## 주의사항
- 개인 사용/테스트 용도로만 사용하세요
- 비밀번호는 저장되지 않습니다 (보안상)
