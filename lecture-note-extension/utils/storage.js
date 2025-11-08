/**
 * Chrome Storage API 래퍼
 *
 * 로컬 스토리지에 데이터를 저장하고 불러오는 유틸리티 함수들
 */

const StorageUtil = {
  /**
   * API 키 가져오기
   */
  async getApiKeys() {
    const result = await chrome.storage.local.get(['apiKeys']);
    return result.apiKeys || { openai: '', notion: '' };
  },

  /**
   * API 키 저장
   */
  async saveApiKeys(apiKeys) {
    await chrome.storage.local.set({ apiKeys });
  },

  /**
   * Notion 설정 가져오기
   */
  async getNotionConfig() {
    const result = await chrome.storage.local.get(['notion']);
    return result.notion || { databaseId: '', currentPageId: '' };
  },

  /**
   * Notion 설정 저장
   */
  async saveNotionConfig(config) {
    await chrome.storage.local.set({ notion: config });
  },

  /**
   * 현재 세션 가져오기
   */
  async getCurrentSession() {
    const result = await chrome.storage.local.get(['currentSession']);
    return result.currentSession || {
      isRecording: false,
      startTime: null,
      pageTitle: '',
      notes: []
    };
  },

  /**
   * 현재 세션 저장
   */
  async saveCurrentSession(session) {
    await chrome.storage.local.set({ currentSession: session });
  },

  /**
   * 세션 노트 추가
   */
  async addNote(note) {
    const session = await this.getCurrentSession();
    session.notes.push(note);
    await this.saveCurrentSession(session);
  },

  /**
   * 세션 초기화
   */
  async clearSession() {
    await chrome.storage.local.set({
      currentSession: {
        isRecording: false,
        startTime: null,
        pageTitle: '',
        notes: []
      }
    });
  },

  /**
   * 모든 데이터 가져오기
   */
  async getAllData() {
    return await chrome.storage.local.get(null);
  }
};

// 익스포트 (다른 스크립트에서 사용 가능하도록)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtil;
}
