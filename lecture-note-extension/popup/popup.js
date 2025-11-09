/**
 * Popup UI 로직
 *
 * 사용자 인터페이스 제어 및 background.js와 통신
 */

// DOM 요소
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');

const recordingStatus = document.getElementById('recordingStatus');
const notionStatus = document.getElementById('notionStatus');
const notesList = document.getElementById('notesList');
const settingsPanel = document.getElementById('settingsPanel');
const settingsMessage = document.getElementById('settingsMessage');

// 설정 입력 필드
const openaiKeyInput = document.getElementById('openaiKey');
const notionTokenInput = document.getElementById('notionToken');
const notionParentIdInput = document.getElementById('notionParentId');
const lectureTitleInput = document.getElementById('lectureTitle');

// 현재 상태
let isRecording = false;
let mediaRecorder = null;
let recordingInterval = null;

/**
 * 초기화
 */
async function init() {
  // 저장된 설정 불러오기
  await loadSettings();

  // 현재 세션 불러오기
  await loadSession();

  // 이벤트 리스너 등록
  startBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', saveSettings);
  testConnectionBtn.addEventListener('click', testNotionConnection);

  // background.js로부터 메시지 수신
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * 설정 불러오기
 */
async function loadSettings() {
  const { apiKeys, notion } = await chrome.storage.local.get(['apiKeys', 'notion']);

  if (apiKeys) {
    openaiKeyInput.value = apiKeys.openai || '';
    notionTokenInput.value = apiKeys.notion || '';
  }

  if (notion) {
    notionParentIdInput.value = notion.databaseId || '';
  }

  // Notion 상태 업데이트
  if (apiKeys && apiKeys.notion) {
    notionStatus.textContent = '✅ 연결됨';
    notionStatus.style.color = '#28a745';
  } else {
    notionStatus.textContent = '❌ 미연결';
    notionStatus.style.color = '#dc3545';
  }
}

/**
 * 현재 세션 불러오기
 */
async function loadSession() {
  const { currentSession } = await chrome.storage.local.get(['currentSession']);

  if (currentSession) {
    // 강의 제목 설정
    lectureTitleInput.value = currentSession.pageTitle || '';

    // 녹음 상태 업데이트
    if (currentSession.isRecording) {
      isRecording = true;
      updateRecordingUI(true);
    }

    // 노트 목록 표시
    if (currentSession.notes && currentSession.notes.length > 0) {
      displayNotes(currentSession.notes);
    }
  }
}

/**
 * 녹음 시작
 */
async function startRecording() {
  try {
    // 설정 확인
    const { apiKeys } = await chrome.storage.local.get(['apiKeys']);
    if (!apiKeys || !apiKeys.openai) {
      alert('OpenAI API 키를 먼저 설정해주세요.');
      openSettings();
      return;
    }

    // 강의 제목 확인
    const lectureTitle = lectureTitleInput.value.trim() || '강의 노트';

    // 세션 초기화
    await chrome.storage.local.set({
      currentSession: {
        isRecording: true,
        startTime: new Date().toISOString(),
        pageTitle: lectureTitle,
        notes: []
      }
    });

    console.log('🎙️ 녹음 시작 시도...');

    // TabCapture로 오디오 스트림 획득
    chrome.tabCapture.capture({ audio: true }, async (stream) => {
      if (chrome.runtime.lastError) {
        console.error('TabCapture error:', chrome.runtime.lastError);
        alert('오디오 캡처 실패: ' + chrome.runtime.lastError.message);
        return;
      }

      if (!stream) {
        alert('오디오 스트림을 캡처할 수 없습니다.\n\n영상이 재생 중인지 확인해주세요.');
        return;
      }

      console.log('✅ 오디오 스트림 획득 성공');

      try {
        // MediaRecorder 설정
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        let audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (audioChunks.length === 0) return;

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('📦 오디오 청크 크기:', audioBlob.size, 'bytes');

          // 최소 크기 확인
          if (audioBlob.size > 1000) {
            // background로 오디오 데이터 전송
            const reader = new FileReader();
            reader.onload = () => {
              chrome.runtime.sendMessage({
                type: 'processAudio',
                audioData: reader.result
              });
            };
            reader.readAsDataURL(audioBlob);
          }

          audioChunks = [];
        };

        mediaRecorder.start();
        console.log('✅ MediaRecorder 시작됨');

        // 5초마다 청크 생성
        recordingInterval = setInterval(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.start();
          }
        }, 5000);

        // UI 업데이트
        isRecording = true;
        updateRecordingUI(true);
        clearNotes();
        console.log('✅ 녹음 시작 완료');

      } catch (error) {
        console.error('MediaRecorder error:', error);
        alert('MediaRecorder 오류: ' + error.message);
      }
    });
  } catch (error) {
    console.error('Start recording error:', error);
    alert('녹음 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 녹음 중지
 */
async function stopRecording() {
  console.log('⏹️ 녹음 중지...');

  // MediaRecorder 중지
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }

  // 인터벌 정리
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }

  mediaRecorder = null;

  // UI 업데이트
  isRecording = false;
  updateRecordingUI(false);
  console.log('✅ 녹음 중지 완료');

  // 세션 업데이트
  const { currentSession } = await chrome.storage.local.get(['currentSession']);
  if (currentSession) {
    currentSession.isRecording = false;
    await chrome.storage.local.set({ currentSession });
  }
}

/**
 * 녹음 UI 업데이트
 */
function updateRecordingUI(recording) {
  if (recording) {
    recordingStatus.textContent = '● 녹음 중...';
    recordingStatus.style.color = '#dc3545';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    recordingStatus.textContent = '● 대기 중';
    recordingStatus.style.color = '#6c757d';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

/**
 * 노트 목록 표시
 */
function displayNotes(notes) {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">녹음을 시작하면 여기에 노트가 표시됩니다.</div>';
    return;
  }

  // 최신 노트가 위로 오도록 역순 정렬
  const sortedNotes = [...notes].reverse();

  sortedNotes.forEach(note => {
    const noteItem = createNoteElement(note);
    notesList.appendChild(noteItem);
  });
}

/**
 * 노트 요소 생성
 */
function createNoteElement(note) {
  const div = document.createElement('div');
  div.className = 'note-item';

  // 타임스탬프
  const timestamp = document.createElement('div');
  timestamp.className = 'note-timestamp';
  timestamp.textContent = `⏰ ${note.timestamp}`;
  div.appendChild(timestamp);

  // 요약
  const summary = document.createElement('div');
  summary.className = 'note-summary';

  // 요약 내용을 리스트로 변환
  const lines = note.summary.split('\n').filter(line => line.trim());
  const ul = document.createElement('ul');
  lines.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line.replace(/^[•\-]\s*/, '');
    ul.appendChild(li);
  });
  summary.appendChild(ul);
  div.appendChild(summary);

  // 키워드
  if (note.keywords && note.keywords.length > 0) {
    const keywordsDiv = document.createElement('div');
    keywordsDiv.className = 'note-keywords';
    keywordsDiv.innerHTML = '🏷️ ';

    note.keywords.forEach(keyword => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = keyword;
      keywordsDiv.appendChild(tag);
    });

    div.appendChild(keywordsDiv);
  }

  // Notion 저장 상태
  if (note.notionSaved) {
    const saved = document.createElement('div');
    saved.className = 'notion-saved';
    saved.innerHTML = '✅ Notion에 저장됨';
    div.appendChild(saved);
  }

  return div;
}

/**
 * 노트 목록 지우기
 */
function clearNotes() {
  notesList.innerHTML = '<div class="empty-state">녹음을 시작하면 여기에 노트가 표시됩니다.</div>';
}

/**
 * 새 노트 추가
 */
function addNote(note) {
  // 빈 상태 메시지 제거
  const emptyState = notesList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // 새 노트를 맨 위에 추가
  const noteElement = createNoteElement(note);
  notesList.insertBefore(noteElement, notesList.firstChild);
}

/**
 * background.js로부터 메시지 처리
 */
function handleMessage(message) {
  console.log('Popup received message:', message);

  switch (message.type) {
    case 'newNote':
      addNote(message.note);
      break;

    case 'notionSaved':
      // 해당 노트에 저장 표시 추가
      updateNoteSavedStatus(message.timestamp);
      break;

    case 'error':
      showMessage('오류: ' + message.message, 'error');
      break;

    case 'notionError':
      showMessage('Notion 오류: ' + message.message, 'error');
      break;
  }
}

/**
 * 노트 저장 상태 업데이트
 */
function updateNoteSavedStatus(timestamp) {
  const notes = notesList.querySelectorAll('.note-item');
  notes.forEach(noteEl => {
    const timestampEl = noteEl.querySelector('.note-timestamp');
    if (timestampEl && timestampEl.textContent.includes(timestamp)) {
      // 이미 저장 표시가 있는지 확인
      if (!noteEl.querySelector('.notion-saved')) {
        const saved = document.createElement('div');
        saved.className = 'notion-saved';
        saved.innerHTML = '✅ Notion에 저장됨';
        noteEl.appendChild(saved);
      }
    }
  });
}

/**
 * 설정 패널 열기
 */
function openSettings() {
  settingsPanel.classList.remove('hidden');
}

/**
 * 설정 패널 닫기
 */
function closeSettings() {
  settingsPanel.classList.add('hidden');
  settingsMessage.classList.add('hidden');
}

/**
 * 설정 저장
 */
async function saveSettings() {
  const openaiKey = openaiKeyInput.value.trim();
  const notionToken = notionTokenInput.value.trim();
  const notionParentId = notionParentIdInput.value.trim();
  const lectureTitle = lectureTitleInput.value.trim();

  // 유효성 검사
  if (!openaiKey) {
    showSettingsMessage('OpenAI API 키를 입력해주세요.', 'error');
    return;
  }

  // 저장
  await chrome.storage.local.set({
    apiKeys: {
      openai: openaiKey,
      notion: notionToken
    },
    notion: {
      databaseId: notionParentId,
      currentPageId: '' // 새 세션 시작 시 새 페이지 생성
    }
  });

  // 현재 세션의 강의 제목 업데이트
  const { currentSession } = await chrome.storage.local.get(['currentSession']);
  if (currentSession) {
    currentSession.pageTitle = lectureTitle || '강의 노트';
    await chrome.storage.local.set({ currentSession });
  }

  showSettingsMessage('설정이 저장되었습니다.', 'success');

  // Notion 상태 업데이트
  await loadSettings();

  // 3초 후 패널 닫기
  setTimeout(() => {
    closeSettings();
  }, 2000);
}

/**
 * Notion 연결 테스트
 */
async function testNotionConnection() {
  const notionToken = notionTokenInput.value.trim();

  if (!notionToken) {
    showSettingsMessage('Notion Integration Token을 입력해주세요.', 'error');
    return;
  }

  try {
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = '테스트 중...';

    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = 'Notion 연결 테스트';

    if (response.ok) {
      showSettingsMessage('✅ Notion 연결 성공!', 'success');
    } else {
      const error = await response.json();
      showSettingsMessage('❌ Notion 연결 실패: ' + (error.message || '토큰을 확인해주세요.'), 'error');
    }
  } catch (error) {
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = 'Notion 연결 테스트';
    showSettingsMessage('❌ 연결 테스트 실패: ' + error.message, 'error');
  }
}

/**
 * 설정 메시지 표시
 */
function showSettingsMessage(message, type) {
  settingsMessage.textContent = message;
  settingsMessage.className = `message ${type}`;
  settingsMessage.classList.remove('hidden');

  // 5초 후 자동 숨김
  setTimeout(() => {
    settingsMessage.classList.add('hidden');
  }, 5000);
}

/**
 * 일반 메시지 표시 (임시 알림)
 */
function showMessage(message, type) {
  console.log(`[${type}] ${message}`);

  // 알림으로 표시
  if (type === 'error') {
    alert('❌ ' + message);
  } else if (type === 'success') {
    console.log('✅ ' + message);
  }
}

// 초기화 실행
document.addEventListener('DOMContentLoaded', init);
