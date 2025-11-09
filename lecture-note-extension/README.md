# 🎓 LectureNote AI Extension

실시간 인강 필기 봇 - 크롬 확장 프로그램

온라인 강의를 들으면서 **음성을 실시간으로 텍스트로 변환**하고, **AI가 자동 요약**해서 **Notion에 자동 저장**하는 크롬 확장 프로그램입니다.

---

## ✨ 주요 기능

- ✅ **실시간 음성 캡처**: 인강 오디오를 5초 단위로 자동 캡처
- ✅ **AI 텍스트 변환**: OpenAI Whisper API로 음성을 텍스트로 변환
- ✅ **자동 요약**: GPT-4가 핵심 내용을 3-5줄로 요약
- ✅ **키워드 추출**: 중요한 키워드 3-5개 자동 추출
- ✅ **Notion 자동 저장**: 요약된 내용을 Notion 페이지에 자동 추가
- ✅ **실시간 UI**: 팝업에서 실시간으로 노트 확인

---

## 📋 목차

1. [설치 방법](#설치-방법)
2. [API 키 발급](#api-키-발급)
3. [사용 방법](#사용-방법)
4. [파일 구조](#파일-구조)
5. [문제 해결](#문제-해결)
6. [개발 정보](#개발-정보)

---

## 🚀 설치 방법

### 1. 프로젝트 다운로드

```bash
git clone <repository-url>
cd lecture-note-extension
```

### 2. 아이콘 생성

아이콘 파일이 없으면 확장 프로그램이 로드되지 않습니다.

**방법 1: 자동 생성 도구 사용 (권장)**

1. `icons/generate-icons.html` 파일을 브라우저에서 엽니다
2. 자동으로 아이콘이 생성됩니다
3. 각 아이콘을 우클릭 → "이미지를 다른 이름으로 저장"
4. `icon16.png`, `icon48.png`, `icon128.png`로 저장
5. `icons/` 폴더에 저장합니다

**방법 2: 온라인 도구 사용**

- [Favicon Generator](https://www.favicon-generator.org/)에서 생성
- 16x16, 48x48, 128x128 크기로 다운로드

### 3. Chrome에 확장 프로그램 로드

1. Chrome 브라우저를 엽니다
2. 주소창에 `chrome://extensions/` 입력
3. 우측 상단의 **개발자 모드** 활성화
4. **압축해제된 확장 프로그램을 로드합니다** 클릭
5. `lecture-note-extension` 폴더 선택

---

## 🔑 API 키 발급

### OpenAI API 키

1. [OpenAI 플랫폼](https://platform.openai.com/api-keys) 접속
2. 로그인 후 **Create new secret key** 클릭
3. 생성된 키 복사 (sk-로 시작)
4. 확장 프로그램 설정에 입력

**비용**: 1시간 인강 기준 약 $1

- Whisper: $0.006/분 → 60분 = $0.36
- GPT-4: 12회 요약 (5분당 1회) → 약 $0.60

### Notion Integration Token

1. [Notion Integrations](https://www.notion.so/my-integrations) 접속
2. **New integration** 클릭
3. 이름 입력 (예: "LectureNote AI")
4. **Submit** 클릭
5. **Internal Integration Token** 복사 (secret_으로 시작)
6. 확장 프로그램 설정에 입력

### Notion 부모 페이지 ID 얻기

노트를 저장할 Notion 페이지가 필요합니다.

**방법 1: 기존 페이지 사용**

1. Notion에서 노트를 저장할 페이지를 엽니다
2. 페이지 우측 상단 **...** 클릭 → **페이지 링크 복사**
3. URL에서 ID 추출:
   ```
   https://www.notion.so/My-Page-abc123def456?...
                                ^^^^^^^^^^^^^^^^
                                이 부분이 페이지 ID
   ```
4. 하이픈(-)을 제거하거나 그대로 사용

**방법 2: 데이터베이스 사용**

1. Notion에서 새 데이터베이스 생성
2. 데이터베이스 링크 복사
3. URL에서 ID 추출

**중요**:
- Integration을 해당 페이지에 연결해야 합니다!
- 페이지 우측 상단 **...** → **연결** → **LectureNote AI** 선택

---

## 📖 사용 방법

### 1. 초기 설정

1. Chrome 확장 프로그램 아이콘 클릭
2. **⚙️ 설정** 버튼 클릭
3. API 키 및 Notion 설정 입력:
   - OpenAI API 키
   - Notion Integration Token
   - Notion 부모 페이지 ID
   - 강의 제목 (예: "자바스크립트 기초")
4. **저장** 클릭
5. (선택) **Notion 연결 테스트** 클릭하여 확인

### 2. 녹음 시작

1. 인강 사이트로 이동 (YouTube, 유데미, 인프런 등)
2. 강의 영상 재생
3. 확장 프로그램 아이콘 클릭
4. **🎙️ 녹음 시작** 클릭
5. 팝업에서 실시간 노트 확인

### 3. 노트 확인

- **팝업**: 실시간으로 요약된 내용 확인
- **Notion**: 자동으로 저장된 노트 확인

### 4. 녹음 중지

- **⏹️ 정지** 버튼 클릭

---

## 📁 파일 구조

```
lecture-note-extension/
│
├── manifest.json              # 확장 프로그램 설정
├── background.js              # 백그라운드 워커 (오디오 캡처, API 통신)
├── README.md                  # 사용 가이드
│
├── popup/
│   ├── popup.html            # 팝업 UI
│   ├── popup.js              # 팝업 로직
│   └── popup.css             # 팝업 스타일
│
├── utils/
│   ├── storage.js            # Chrome Storage 래퍼
│   └── notion-api.js         # Notion API 래퍼
│
└── icons/
    ├── icon16.png            # 16x16 아이콘
    ├── icon48.png            # 48x48 아이콘
    ├── icon128.png           # 128x128 아이콘
    ├── generate-icons.html   # 아이콘 생성 도구
    └── README.txt            # 아이콘 생성 가이드
```

---

## 🔧 문제 해결

### 확장 프로그램이 로드되지 않아요

- **아이콘 파일 확인**: `icons/` 폴더에 icon16.png, icon48.png, icon128.png 파일이 있는지 확인
- **manifest.json 확인**: 문법 오류가 없는지 확인
- **개발자 모드**: chrome://extensions/에서 개발자 모드가 활성화되어 있는지 확인

### 녹음이 시작되지 않아요

- **API 키 확인**: OpenAI API 키가 올바르게 입력되었는지 확인
- **탭 권한**: 녹음할 탭에서 오디오가 재생 중인지 확인
- **크레딧 확인**: OpenAI 계정에 크레딧이 있는지 확인

### Notion에 저장되지 않아요

- **Integration 연결**: Notion 페이지에 Integration이 연결되어 있는지 확인
- **페이지 ID**: 부모 페이지 ID가 올바른지 확인
- **토큰 확인**: Notion Integration Token이 유효한지 확인
- **연결 테스트**: 설정에서 "Notion 연결 테스트" 실행

### 텍스트 변환이 정확하지 않아요

- Whisper API는 한국어를 지원하지만 100% 정확하지 않을 수 있습니다
- 배경 소음이 적은 환경에서 녹음하면 정확도가 향상됩니다
- 강의 음질에 따라 결과가 달라질 수 있습니다

### API 비용이 걱정돼요

- **테스트**: 짧은 영상으로 먼저 테스트해보세요
- **사용량 제한**: OpenAI 대시보드에서 사용량 제한 설정 가능
- **간격 조정**: background.js의 `setInterval` 시간을 5초에서 10초로 늘리면 비용 절감

---

## 💡 개발 정보

### 기술 스택

- **Chrome Extension Manifest V3**
- **Chrome TabCapture API** - 오디오 캡처
- **MediaRecorder API** - 오디오 녹음
- **OpenAI Whisper API** - 음성→텍스트 변환
- **OpenAI GPT-4 API** - 텍스트 요약
- **Notion API** - 노트 저장

### 데이터 흐름

```
[인강 음성]
    ↓
[5초 단위 캡처] (Chrome TabCapture API)
    ↓
[Whisper API] → 텍스트 변환
    ↓
[GPT-4 API] → 요약 + 키워드 추출
    ↓
[실시간 UI 표시] + [Notion API 저장]
```

### 커스터마이징

**요약 간격 변경**

`background.js`:
```javascript
// 5초 → 10초로 변경
setInterval(() => {
  // ...
}, 10000); // 5000 → 10000
```

**요약 스타일 변경**

`background.js`의 GPT-4 프롬프트 수정:
```javascript
{
  role: 'system',
  content: '원하는 스타일로 수정...'
}
```

**Notion 블록 스타일 변경**

`utils/notion-api.js`의 `appendBlocks` 함수 수정

---

## 📝 라이선스

MIT License

---

## 🤝 기여

이슈 및 PR은 언제나 환영합니다!

---

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 등록해주세요.

---

## 🎯 향후 개발 계획

- [ ] 타임스탬프 클릭 → 영상 해당 시점 이동
- [ ] PDF 다운로드 기능
- [ ] 퀴즈 자동 생성
- [ ] 다국어 지원 (영어 강의 → 한글 요약)
- [ ] 로컬 Whisper 지원 (무료 버전)
- [ ] 요약 품질 개선
- [ ] 에러 핸들링 강화

---

**즐거운 학습 되세요! 🚀**
