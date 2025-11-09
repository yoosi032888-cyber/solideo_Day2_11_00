/**
 * Notion API 래퍼
 *
 * Notion 페이지 생성 및 블록 추가 기능
 */

const NotionAPI = {
  NOTION_VERSION: '2022-06-28',
  BASE_URL: 'https://api.notion.com/v1',

  /**
   * 새 Notion 페이지 생성
   * @param {string} token - Notion Integration Token
   * @param {string} parentId - 부모 페이지 또는 데이터베이스 ID
   * @param {string} title - 페이지 제목
   * @returns {Promise<string>} 생성된 페이지 ID
   */
  async createPage(token, parentId, title) {
    const url = `${this.BASE_URL}/pages`;

    // 현재 날짜 포맷팅
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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': this.NOTION_VERSION,
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
    } catch (error) {
      console.error('Notion createPage error:', error);
      throw error;
    }
  },

  /**
   * 기존 페이지에 블록 추가
   * @param {string} token - Notion Integration Token
   * @param {string} pageId - 페이지 ID
   * @param {string} timestamp - 타임스탬프
   * @param {string} summary - 요약 내용
   * @param {string[]} keywords - 키워드 배열
   */
  async appendBlocks(token, pageId, timestamp, summary, keywords) {
    const url = `${this.BASE_URL}/blocks/${pageId}/children`;

    // 요약 내용을 줄바꿈으로 분리
    const summaryLines = summary.split('\n').filter(line => line.trim());

    const blocks = [
      // 타임스탬프 헤더
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
      // 요약 내용 (각 줄을 bullet point로)
      ...summaryLines.map(line => ({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            text: { content: line.replace(/^[•\-]\s*/, '') }
          }]
        }
      })),
      // 키워드 callout
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
      // 구분선
      {
        object: 'block',
        type: 'divider',
        divider: {}
      }
    ];

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': this.NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ children: blocks })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Notion API Error: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Notion appendBlocks error:', error);
      throw error;
    }
  },

  /**
   * Notion 연결 테스트
   * @param {string} token - Notion Integration Token
   * @returns {Promise<boolean>}
   */
  async testConnection(token) {
    try {
      const response = await fetch(`${this.BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': this.NOTION_VERSION
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }
};

// 익스포트
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotionAPI;
}
