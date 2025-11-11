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

const recordingStatus = document.getElementById('recordingStatus');
const notesEditor = document.getElementById('notesEditor');
const settingsPanel = document.getElementById('settingsPanel');
const settingsMessage = document.getElementById('settingsMessage');

// 노트 액션 버튼
const copyNotesBtn = document.getElementById('copyNotesBtn');
const downloadNotesBtn = document.getElementById('downloadNotesBtn');
const clearNotesBtn = document.getElementById('clearNotesBtn');

// 설정 입력 필드
const openaiKeyInput = document.getElementById('openaiKey');
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

  // 노트 액션
  copyNotesBtn.addEventListener('click', copyNotes);
  downloadNotesBtn.addEventListener('click', downloadNotes);
  clearNotesBtn.addEventListener('click', confirmClearNotes);

  // 노트 자동 저장
  notesEditor.addEventListener('input', saveNotesToStorage);

  // background.js로부터 메시지 수신
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * 설정 불러오기
 */
async function loadSettings() {
  const { apiKeys } = await chrome.storage.local.get(['apiKeys']);

  if (apiKeys) {
    openaiKeyInput.value = apiKeys.openai || '';
  }
}

/**
 * 현재 세션 불러오기
 */
async function loadSession() {
  const { currentSession, savedNotes } = await chrome.storage.local.get(['currentSession', 'savedNotes']);

  if (currentSession) {
    // 강의 제목 설정
    lectureTitleInput.value = currentSession.pageTitle || '';

    // 녹음 상태 업데이트
    if (currentSession.isRecording) {
      isRecording = true;
      updateRecordingUI(true);
    }
  }

  // 저장된 노트 불러오기
  if (savedNotes) {
    notesEditor.innerHTML = savedNotes;
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
        // 오디오를 다시 재생 (사용자가 들을 수 있도록)
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(audioContext.destination);
        console.log('🔊 오디오 재생 시작');

        // MediaRecorder 설정
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        let audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('📼 오디오 데이터 수신:', event.data.size, 'bytes');
          }
        };

        mediaRecorder.onstop = async () => {
          console.log('⏹️ MediaRecorder 정지됨');
          console.log('📦 수집된 청크 개수:', audioChunks.length);

          if (audioChunks.length === 0) {
            console.warn('⚠️ 오디오 청크가 없습니다!');
            return;
          }

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('📦 오디오 Blob 크기:', audioBlob.size, 'bytes');

          // 최소 크기 확인
          if (audioBlob.size > 1000) {
            console.log('✅ 오디오 크기 충분 - background로 전송 시작');
            // background로 오디오 데이터 전송
            const reader = new FileReader();
            reader.onload = () => {
              console.log('📤 background로 메시지 전송 중...');
              chrome.runtime.sendMessage({
                type: 'processAudio',
                audioData: reader.result
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('❌ 메시지 전송 실패:', chrome.runtime.lastError);
                } else {
                  console.log('✅ background로 메시지 전송 완료');
                }
              });
            };
            reader.onerror = (error) => {
              console.error('❌ FileReader 오류:', error);
            };
            reader.readAsDataURL(audioBlob);
          } else {
            console.warn('⚠️ 오디오 크기가 너무 작습니다:', audioBlob.size, 'bytes');
          }

          audioChunks = [];
        };

        mediaRecorder.start();
        console.log('✅ MediaRecorder 시작됨');

        // 30초마다 청크 생성 (더 많은 내용)
        recordingInterval = setInterval(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.start();
          }
        }, 30000); // 30초

        // UI 업데이트
        isRecording = true;
        updateRecordingUI(true);
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
 * 새 노트 추가
 */
function addNote(note) {
  console.log('📝 addNote 호출됨:', {
    timestamp: note.timestamp,
    summaryLength: note.summary ? note.summary.length : 0,
    summaryPreview: note.summary ? note.summary.substring(0, 50) : '(없음)'
  });

  // 현재 노트 내용에 새로운 노트 추가
  const noteHtml = formatNoteAsHtml(note);
  console.log('📄 HTML 생성 완료, 길이:', noteHtml.length);

  // 기존 내용 뒤에 추가 (최신이 아래로)
  notesEditor.innerHTML = notesEditor.innerHTML + noteHtml;
  console.log('✅ 노트 에디터에 추가 완료');

  // 자동 스크롤 (최신 내용으로)
  notesEditor.scrollTop = notesEditor.scrollHeight;

  // 스토리지에 저장
  saveNotesToStorage();
}

/**
 * 노트를 HTML로 포맷
 */
function formatNoteAsHtml(note) {
  let html = `<h3>⏰ ${note.timestamp}</h3>`;

  // 요약 내용
  const lines = note.summary.split('\n').filter(line => line.trim());
  html += '<ul>';
  lines.forEach(line => {
    const cleanLine = line.replace(/^[•\-]\s*/, '');
    html += `<li>${cleanLine}</li>`;
  });
  html += '</ul>';

  // 키워드
  if (note.keywords && note.keywords.length > 0) {
    html += `<div class="keywords">🏷️ 키워드: ${note.keywords.join(', ')}</div>`;
  }

  html += '<hr>';
  return html;
}

/**
 * 노트를 스토리지에 저장
 */
async function saveNotesToStorage() {
  await chrome.storage.local.set({ savedNotes: notesEditor.innerHTML });
}

/**
 * 노트 복사
 */
async function copyNotes() {
  const text = notesEditor.innerText;

  if (!text || text.trim().length === 0) {
    alert('복사할 노트가 없습니다.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showMessage('노트가 클립보드에 복사되었습니다!', 'success');
  } catch (error) {
    console.error('복사 실패:', error);
    alert('복사에 실패했습니다.');
  }
}

/**
 * 노트 다운로드
 */
function downloadNotes() {
  const text = notesEditor.innerText;

  if (!text || text.trim().length === 0) {
    alert('다운로드할 노트가 없습니다.');
    return;
  }

  // 녹음 중이면 자동으로 정지
  if (isRecording) {
    console.log('📥 다운로드 시작 - 녹음 자동 정지');
    stopRecording();
  }

  // 강의 제목과 날짜로 파일명 생성
  const title = lectureTitleInput.value.trim() || '강의노트';
  const date = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
  const filename = `${title}_${date}.txt`;

  // 다운로드
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  showMessage('노트가 다운로드되었습니다! (녹음 자동 정지)', 'success');
}

/**
 * 노트 지우기 확인
 */
function confirmClearNotes() {
  if (confirm('모든 노트를 지우시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
    notesEditor.innerHTML = '';
    saveNotesToStorage();
    showMessage('노트가 지워졌습니다.', 'success');
  }
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
      // Notion 오류는 콘솔에만 표시 (사용자를 방해하지 않음)
      console.warn('⚠️ Notion 오류:', message.message);
      console.log('💡 노트는 팝업에서 확인할 수 있습니다.');
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
  const lectureTitle = lectureTitleInput.value.trim();

  // 유효성 검사
  if (!openaiKey) {
    showSettingsMessage('OpenAI API 키를 입력해주세요.', 'error');
    return;
  }

  // 저장
  await chrome.storage.local.set({
    apiKeys: {
      openai: openaiKey
    }
  });

  // 현재 세션의 강의 제목 업데이트
  const { currentSession } = await chrome.storage.local.get(['currentSession']);
  if (currentSession) {
    currentSession.pageTitle = lectureTitle || '강의 노트';
    await chrome.storage.local.set({ currentSession });
  }

  showSettingsMessage('설정이 저장되었습니다.', 'success');

  // 2초 후 패널 닫기
  setTimeout(() => {
    closeSettings();
  }, 2000);
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
