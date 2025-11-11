/**
 * Background Service Worker
 *
 * 오디오 캡처, Whisper API, GPT-4 API, Notion API 통신 담당
 */

// 전역 변수
let keepAliveInterval = null;

// Service Worker를 계속 활성 상태로 유지
function keepAlive() {
  keepAliveInterval = setInterval(() => {
    console.log('Keep-alive ping');
  }, 20000); // 20초마다
}

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log('LectureNote AI Extension installed/updated');
  keepAlive();
});

// Service Worker 시작 시 실행
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker started');
  keepAlive();
});

/**
 * 오디오를 Whisper API로 전송하여 텍스트 변환
 */
async function processAudio(audioBlob) {
  console.log('=== processAudio 시작 ===');
  console.log('Audio blob size:', audioBlob.size, 'bytes');

  try {
    // API 키 가져오기
    const { apiKeys } = await chrome.storage.local.get(['apiKeys']);
    console.log('API keys loaded:', apiKeys ? 'Yes' : 'No');

    if (!apiKeys || !apiKeys.openai) {
      const errorMsg = 'OpenAI API 키가 설정되지 않았습니다.';
      console.error(errorMsg);
      chrome.runtime.sendMessage({
        type: 'error',
        message: errorMsg + '\n\n설정에서 API 키를 입력해주세요.'
      });
      return;
    }

    console.log('Whisper API 호출 시작...');

    // FormData 생성
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');

    // Whisper API 호출
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.openai}`
      },
      body: formData
    });

    console.log('Whisper API 응답 상태:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      throw new Error(`Whisper API 오류 (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    const text = data.text;

    console.log('✅ 텍스트 변환 완료:', text.substring(0, 100) + '...');

    // 텍스트가 있으면 GPT-4로 요약
    if (text && text.trim().length > 10) {
      await summarizeText(text);
    } else {
      console.log('⚠️ 텍스트가 너무 짧아서 요약을 건너뜁니다.');
    }
  } catch (error) {
    console.error('❌ processAudio 오류:', error);
    // 에러를 popup에 전달
    chrome.runtime.sendMessage({
      type: 'error',
      message: '오디오 처리 오류: ' + error.message
    });
  }
}

/**
 * GPT-4 API로 텍스트 요약 및 키워드 추출
 */
async function summarizeText(text) {
  console.log('=== summarizeText 시작 ===');
  console.log('텍스트 길이:', text.length, '자');

  try {
    // API 키 가져오기
    const { apiKeys } = await chrome.storage.local.get(['apiKeys']);
    if (!apiKeys || !apiKeys.openai) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    console.log('GPT-4 API 호출 시작...');

    // GPT-4 API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.openai}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '당신은 강의 필기 도우미입니다. 주어진 텍스트를 간단하게 정리하고 핵심 단어를 추출하세요. 텍스트가 짧아도 상관없습니다.\n\n출력 형식:\n• [핵심 내용 1]\n• [핵심 내용 2]\n\n키워드: [단어1, 단어2, 단어3]\n\n절대 하지 말 것: "정보가 부족하다", "더 많은 내용이 필요하다" 같은 말. 주어진 것만 정리하세요.'
          },
          {
            role: 'user',
            content: '예시: AI 기술의 발전'
          },
          {
            role: 'assistant',
            content: '• AI 기술의 발전\n\n키워드: AI, 기술, 발전'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    console.log('GPT-4 API 응답 상태:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      throw new Error(`GPT-4 API 오류 (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    console.log('✅ 요약 완료:', summary);

    // 요약과 키워드 분리
    const parts = summary.split('\n\n');
    const summaryText = parts[0];
    const keywordsLine = parts[1] || '';
    const keywords = keywordsLine.replace('키워드:', '').trim().split(',').map(k => k.trim()).filter(k => k);

    // 타임스탬프 생성
    const now = new Date();
    const timestamp = now.toLocaleTimeString('ko-KR', { hour12: false });

    // 노트 객체 생성
    const note = {
      timestamp,
      originalText: text,
      summary: summaryText,
      keywords,
      notionSaved: false
    };

    console.log('📝 노트 생성:', note);

    // 스토리지에 저장
    const { currentSession } = await chrome.storage.local.get(['currentSession']);
    if (currentSession) {
      currentSession.notes.push(note);
      await chrome.storage.local.set({ currentSession });
      console.log('💾 스토리지에 저장 완료');
    }

    // popup에 업데이트 전달
    console.log('📤 팝업에 메시지 전송...');
    chrome.runtime.sendMessage({
      type: 'newNote',
      note
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('⚠️ 팝업이 닫혀 있습니다:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ 팝업에 메시지 전송 완료');
      }
    });

    // Notion에 저장
    await saveToNotion(note);
  } catch (error) {
    console.error('❌ summarizeText 오류:', error);
    chrome.runtime.sendMessage({
      type: 'error',
      message: '요약 처리 오류: ' + error.message
    });
  }
}

/**
 * Notion에 노트 저장
 */
async function saveToNotion(note) {
  try {
    console.log('=== saveToNotion 시작 ===');

    // API 키와 설정 가져오기
    const { apiKeys, notion } = await chrome.storage.local.get(['apiKeys', 'notion']);

    if (!apiKeys || !apiKeys.notion) {
      console.log('⚠️ Notion API 키가 설정되지 않았습니다. Notion 저장을 건너뜁니다.');
      return;
    }

    if (!notion || !notion.currentPageId) {
      // 새 페이지 생성 필요
      const { currentSession } = await chrome.storage.local.get(['currentSession']);
      const pageTitle = currentSession.pageTitle || '강의 노트';

      // 부모 페이지/데이터베이스 ID 필요
      if (!notion || !notion.databaseId) {
        console.log('⚠️ Notion 부모 페이지 ID가 설정되지 않았습니다.');
        console.log('💡 Notion 저장을 원하시면 설정에서 부모 페이지 ID를 입력하세요.');
        return;
      }

      // 페이지 생성 (notion-api.js의 함수 사용)
      const pageId = await createNotionPage(apiKeys.notion, notion.databaseId, pageTitle);

      // pageId 저장
      notion.currentPageId = pageId;
      await chrome.storage.local.set({ notion });
    }

    // 블록 추가 (notion-api.js의 함수 사용)
    await appendNotionBlocks(
      apiKeys.notion,
      notion.currentPageId,
      note.timestamp,
      note.summary,
      note.keywords
    );

    // 저장 성공 표시
    note.notionSaved = true;

    // popup에 알림
    chrome.runtime.sendMessage({
      type: 'notionSaved',
      timestamp: note.timestamp
    });

    console.log('✅ Notion에 저장 완료');
  } catch (error) {
    console.error('❌ Notion 저장 오류:', error);

    // 사용자에게 친절한 오류 메시지
    let userMessage = 'Notion 저장에 실패했습니다.';

    if (error.message.includes('Could not find')) {
      userMessage += '\n\n해결 방법:\n1. Notion 페이지에서 "..." 클릭\n2. "연결 추가" 선택\n3. Integration 선택';
    } else if (error.message.includes('unauthorized')) {
      userMessage += '\n\nNotion Integration Token을 확인해주세요.';
    }

    console.log('⚠️ ' + userMessage);
    console.log('💡 노트는 팝업에서 확인할 수 있습니다.');

    // 오류를 popup에 전달하지만 프로그램은 계속 실행
    chrome.runtime.sendMessage({
      type: 'notionError',
      message: userMessage
    }, () => {
      // 에러 무시
      if (chrome.runtime.lastError) {
        console.log('팝업이 닫혀 있습니다.');
      }
    });
  }
}

/**
 * Notion 페이지 생성 헬퍼
 */
async function createNotionPage(token, parentId, title) {
  const NOTION_VERSION = '2022-06-28';
  const url = 'https://api.notion.com/v1/pages';

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR');
  const fullTitle = `${title} - ${dateStr}`;

  const body = {
    parent: parentId.includes('-') && parentId.length === 36
      ? { page_id: parentId }
      : { database_id: parentId },
    properties: {
      title: {
        title: [{
          text: { content: fullTitle }
        }]
      }
    },
    children: [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{
            text: { content: '📚 강의 노트' }
          }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: `생성 시간: ${now.toLocaleString('ko-KR')}` }
          }]
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Notion API Error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Notion 블록 추가 헬퍼
 */
async function appendNotionBlocks(token, pageId, timestamp, summary, keywords) {
  const NOTION_VERSION = '2022-06-28';
  const url = `https://api.notion.com/v1/blocks/${pageId}/children`;

  const summaryLines = summary.split('\n').filter(line => line.trim());

  const blocks = [
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{
          text: { content: `⏰ ${timestamp}` },
          annotations: { color: 'blue' }
        }]
      }
    },
    ...summaryLines.map(line => ({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{
          text: { content: line.replace(/^[•\-]\s*/, '') }
        }]
      }
    })),
    {
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji: '🏷️' },
        color: 'gray_background',
        rich_text: [{
          text: { content: `키워드: ${keywords.join(', ')}` },
          annotations: { bold: true }
        }]
      }
    },
    {
      object: 'block',
      type: 'divider',
      divider: {}
    }
  ];

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ children: blocks })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Notion API Error: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * 메시지 리스너
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type);

  switch (message.type) {
    case 'processAudio':
      // popup에서 전송한 오디오 데이터 처리
      (async () => {
        try {
          console.log('📥 오디오 데이터 수신');

          // base64 데이터를 Blob으로 변환
          const response = await fetch(message.audioData);
          const audioBlob = await response.blob();

          console.log('📦 Blob 변환 완료, 크기:', audioBlob.size, 'bytes');

          // 오디오 처리
          await processAudio(audioBlob);

          sendResponse({ success: true });
        } catch (error) {
          console.error('❌ processAudio 메시지 처리 오류:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // 비동기 응답

    case 'getSession':
      chrome.storage.local.get(['currentSession'], (result) => {
        sendResponse(result.currentSession || null);
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

console.log('Background service worker loaded');

// 스크립트 로드 시 keep-alive 시작
keepAlive();
