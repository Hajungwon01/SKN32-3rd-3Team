// ===== State =====
let currentUser = null;
let chatSessions = [];
let currentSessionId = null;
let isTyping = false;

// ===== 지역별 데모 응답 데이터 =====
const REGION_LABELS = {
  'seoul': '서울',
  'cheonan': '천안',
  'busan-namgu': '부산 남구'
};

const DEMO_RESPONSES = {
  '배달 용기 분리수거 어떻게 해?': {
    'seoul': {
      guide: '배달 용기는 내용물을 깨끗이 비우고 물로 헹군 뒤, 재질에 따라 분리배출합니다. PP(폴리프로필렌) 용기는 플라스틱류, 알루미늄 용기는 캔류로 배출하세요. 서울시는 투명 페트병 별도 분리수거를 시행하고 있습니다.',
      law: '자원순환법 제15조(분리배출 의무)에 따라 재활용 가능 자원은 분리배출 의무 대상입니다. 서울시 자원순환 조례 제12조에 따른 배출 기준을 따릅니다.',
      tip: '기름기가 많이 묻은 용기는 키친타월로 한번 닦고 헹구면 재활용률이 높아집니다. 배달앱에서 "일회용 수저 안 받기"를 선택하면 탄소포인트도 적립됩니다.',
      source: '환경부 분리배출 가이드, 서울시 자원순환 조례'
    },
    'cheonan': {
      guide: '배달 용기는 내용물을 비우고 헹군 뒤 플라스틱류로 배출합니다. 천안시는 매주 월·수·금 재활용품 배출일에 맞춰 분리배출하세요. 검은색 용기는 재활용이 어려워 일반쓰레기로 배출합니다.',
      law: '자원순환법 제15조 및 천안시 폐기물 관리 조례에 따라 재활용 가능 포장재는 분리배출 의무가 있습니다.',
      tip: '천안시는 아파트와 단독주택의 배출일이 다를 수 있으니, 관할 주민센터에 확인하세요. 깨끗이 씻은 용기만 재활용됩니다.',
      source: '환경부 분리배출 가이드, 천안시 폐기물 관리 조례'
    },
    'busan-namgu': {
      guide: '배달 용기는 내용물을 비우고 헹군 뒤 재질별로 분리배출합니다. 부산 남구는 요일별 배출제를 시행하며, 플라스틱류는 수요일에 배출합니다. 스티로폼 용기는 이물질 제거 후 별도 배출하세요.',
      law: '자원순환법 제15조 및 부산광역시 남구 폐기물 관리 조례에 의거하여 재활용품 분리배출 의무가 부과됩니다.',
      tip: '부산 남구 클린하우스를 이용하면 24시간 배출 가능합니다. 남구청 홈페이지에서 요일별 배출 품목을 확인하세요.',
      source: '환경부 분리배출 가이드, 부산 남구 폐기물 관리 조례'
    }
  },
  '페트병 라벨 꼭 떼야 해?': {
    'seoul': {
      guide: '네, 페트병 라벨은 반드시 제거해야 합니다. 서울시는 2024년부터 투명 페트병 별도 분리배출을 의무화했습니다. 라벨을 떼고, 내용물을 비운 뒤 찌그러뜨려서 뚜껑을 닫아 배출하세요.',
      law: '자원순환법 시행규칙 제8조에 따라 투명 페트병은 별도 분리배출 대상이며, 라벨 제거가 의무입니다.',
      tip: '라벨 절취선이 있으면 쉽게 뗄 수 있어요. 절취선이 없으면 가위로 한 번만 자르면 쉽게 벗겨집니다.',
      source: '환경부 내 손안의 분리배출, 서울시 자원순환 안내'
    },
    'cheonan': {
      guide: '네, 라벨을 반드시 떼어주세요. 천안시도 투명 페트병 별도 분리배출을 시행 중입니다. 라벨을 제거하고 찌그러뜨려 투명 페트병 전용 수거함에 배출하세요.',
      law: '자원순환법 시행규칙에 따라 투명 페트병은 별도 분리 의무 대상입니다. 미이행 시 과태료가 부과될 수 있습니다.',
      tip: '천안시 공동주택은 투명 페트병 전용 수거함이 별도로 비치되어 있습니다. 단독주택은 투명 봉투에 담아 배출하세요.',
      source: '환경부 분리배출 가이드, 천안시 재활용 안내'
    },
    'busan-namgu': {
      guide: '네, 라벨 제거는 필수입니다. 부산 남구에서는 투명 페트병을 일반 플라스틱과 분리하여 별도 배출합니다. 라벨을 떼고 압착 후 뚜껑을 닫아주세요.',
      law: '자원순환법 시행규칙 및 부산시 조례에 따라 투명 페트병 별도 분리배출이 의무화되어 있습니다.',
      tip: '부산 남구 클린하우스에 투명 페트병 전용 수거함이 있습니다. 색깔 있는 페트병은 일반 플라스틱으로 배출하세요.',
      source: '환경부 분리배출 가이드, 부산 남구 자원순환 안내'
    }
  },
  '음식물쓰레기 배출 방법 알려줘': {
    'seoul': {
      guide: '서울시는 RFID 종량기(음식물 계량기)를 사용합니다. 아파트는 단지 내 RFID 기기에 카드를 태그하고 투입하세요. 단독주택은 전용 수거 용기에 담아 배출합니다. 배출 시간은 일몰 후~자정까지입니다.',
      law: '음식물류 폐기물 관리법 제4조에 따라 음식물쓰레기는 전용 용기에 배출해야 하며, 서울시 조례에 따라 RFID 종량제가 적용됩니다.',
      tip: '음식물쓰레기 물기를 최대한 제거하면 처리 비용이 줄어듭니다. 서울시 에코마일리지와 연계하면 추가 혜택을 받을 수 있어요.',
      source: '서울시 자원순환 포털, 음식물류 폐기물 관리법'
    },
    'cheonan': {
      guide: '천안시는 음식물쓰레기 종량제 봉투를 사용합니다. 전용 봉투(1L, 2L, 3L, 5L)를 구매하여 배출하세요. 배출일은 매일 가능하며, 일몰 후~자정 사이에 지정된 장소에 배출합니다.',
      law: '음식물류 폐기물 관리법 및 천안시 폐기물 관리 조례에 따라 전용 봉투 사용이 의무입니다.',
      tip: '천안시 음식물쓰레기 봉투는 읍면동 주민센터, 대형마트, 편의점에서 구매할 수 있습니다. 물기를 짜서 배출하면 봉투 절약에 도움이 됩니다.',
      source: '천안시 환경과, 음식물류 폐기물 관리법'
    },
    'busan-namgu': {
      guide: '부산 남구는 납부필증 방식으로 음식물쓰레기를 배출합니다. 전용 용기에 납부필증을 부착하여 배출하세요. 배출 시간은 일몰 후~자정이며, 공동주택은 단지 내 전용 수거 용기를 이용합니다.',
      law: '음식물류 폐기물 관리법 및 부산광역시 남구 조례에 따라 납부필증 부착 배출이 의무입니다.',
      tip: '남구청에서 음식물쓰레기 감량기 보급 사업을 진행하고 있으니 신청해 보세요. 가정용 감량기를 사용하면 배출량을 70%까지 줄일 수 있습니다.',
      source: '부산 남구청 환경과, 음식물류 폐기물 관리법'
    }
  },
  '뼈다귀는 음식물쓰레기야?': {
    'seoul': {
      guide: '아닙니다. 소·돼지·닭 등의 뼈다귀는 음식물쓰레기가 아닙니다. 일반쓰레기(종량제 봉투)로 배출하세요. 음식물쓰레기 판별 기준은 "동물이 먹을 수 있는가"입니다.',
      law: '환경부 고시 「음식물류 폐기물의 발생 억제 및 수집·운반·재활용에 관한 규정」에 따라 뼈, 껍데기류는 음식물쓰레기 제외 대상입니다.',
      tip: '헷갈리는 품목 정리: 뼈다귀(일반) / 달걀껍데기(일반) / 조개껍데기(일반) / 과일씨(일반) / 채소·과일 껍질(음식물). 냉장고 정리 시 참고하세요!',
      source: '환경부 분리배출 가이드'
    },
    'cheonan': {
      guide: '뼈다귀는 음식물쓰레기가 아닙니다. 천안시에서도 동일하게 일반쓰레기 종량제 봉투에 넣어 배출합니다. 크기가 큰 뼈는 잘게 부수어 배출하세요.',
      law: '환경부 고시에 따라 뼈, 껍질류 등은 음식물쓰레기에서 제외됩니다.',
      tip: '천안시 음식물쓰레기 비해당 품목: 뼈, 달걀/메추리알 껍데기, 조개/전복 껍데기, 견과류 껍질, 옥수수 껍질 등은 모두 일반쓰레기입니다.',
      source: '환경부 분리배출 가이드, 천안시 환경과'
    },
    'busan-namgu': {
      guide: '뼈다귀는 음식물쓰레기가 아닙니다. 부산 남구에서도 일반쓰레기 종량제 봉투로 배출하세요. 뼈, 껍데기류는 사료화·퇴비화가 불가능하여 음식물쓰레기에서 제외됩니다.',
      law: '환경부 음식물류 폐기물 관리 고시에 따라 동물의 뼈는 음식물쓰레기 분류에서 제외됩니다.',
      tip: '부산 남구 주민을 위한 꿀팁: 남구청 홈페이지에서 음식물쓰레기 분류 가이드 PDF를 다운받을 수 있습니다. 냉장고에 붙여두면 편리해요!',
      source: '환경부 분리배출 가이드, 부산 남구청'
    }
  }
};

// 기본 응답 (매칭 안 될 때)
function getDefaultResponse(region) {
  const regionName = REGION_LABELS[region] || '서울';
  return {
    guide: `${regionName} 지역 환경 가이드를 기반으로 검색했습니다. 더 구체적인 질문을 해주시면 정확한 답변을 드릴 수 있습니다.`,
    law: '자원순환법 및 관련 시행령에 따라 분리배출 의무가 적용됩니다.',
    tip: '환경부 "내 손안의 분리배출" 앱을 설치하면 품목별 분리배출 방법을 사진으로 확인할 수 있어요!',
    source: '환경부 분리배출 가이드'
  };
}

// ===== Page Navigation =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

// ===== Auth =====
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  // 데모: 간단한 로그인 처리
  if (email && password) {
    currentUser = {
      email: email,
      name: email.split('@')[0],
      isAdmin: email.includes('admin')
    };
    initChat();
    showPage('chat-page');
  }
});

document.getElementById('signup-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-password-confirm').value;

  if (password !== confirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }

  alert('회원가입이 완료되었습니다. 로그인해주세요.');
  showPage('login-page');
});

function logout() {
  currentUser = null;
  chatSessions = [];
  currentSessionId = null;
  showPage('login-page');
}

// ===== Chat Init =====
function initChat() {
  if (!currentUser) return;

  // UI 업데이트
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();

  // 관리자 버튼 표시
  if (currentUser.isAdmin) {
    document.getElementById('admin-btn').style.display = 'block';
  }

  // 첫 세션 생성
  createNewSession();
}

// ===== Sessions =====
function createNewSession() {
  const region = document.getElementById('region-select').value;
  const session = {
    id: Date.now(),
    title: '새 대화',
    region: region,
    messages: []
  };
  chatSessions.unshift(session);
  currentSessionId = session.id;
  renderChatList();
  renderMessages();
  updateRegionBadge();
}

function switchSession(sessionId) {
  currentSessionId = sessionId;
  const session = chatSessions.find(s => s.id === sessionId);
  if (session) {
    document.getElementById('region-select').value = session.region;
  }
  renderChatList();
  renderMessages();
  updateRegionBadge();
}

function deleteSession(sessionId, e) {
  e.stopPropagation();
  if (chatSessions.length <= 1) {
    chatSessions = [];
    createNewSession();
    return;
  }
  chatSessions = chatSessions.filter(s => s.id !== sessionId);
  if (currentSessionId === sessionId) {
    currentSessionId = chatSessions[0].id;
    const session = chatSessions[0];
    document.getElementById('region-select').value = session.region;
  }
  renderChatList();
  renderMessages();
  updateRegionBadge();
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  list.innerHTML = chatSessions.map(s => `
    <div class="chat-item ${s.id === currentSessionId ? 'active' : ''}"
         onclick="switchSession(${s.id})">
      <span class="chat-item-icon">💬</span>
      <span>${s.title}</span>
      <button class="chat-item-delete" onclick="deleteSession(${s.id}, event)" title="삭제">✕</button>
    </div>
  `).join('');
}

// ===== Region =====
document.getElementById('region-select').addEventListener('change', function() {
  updateRegionBadge();
  const session = chatSessions.find(s => s.id === currentSessionId);
  if (session) {
    session.region = this.value;
  }
});

function updateRegionBadge() {
  const region = document.getElementById('region-select').value;
  document.getElementById('region-badge').textContent = REGION_LABELS[region];
}

// ===== Messages =====
function renderMessages() {
  const container = document.getElementById('chat-messages');
  const session = chatSessions.find(s => s.id === currentSessionId);

  if (!session || session.messages.length === 0) {
    container.innerHTML = `
      <div class="welcome-message" id="welcome-message">
        <div class="welcome-icon">🌿</div>
        <h3>Ecobot에 오신 것을 환영합니다</h3>
        <p>환경 실천에 관한 질문을 해보세요!</p>
        <div class="quick-questions">
          <button class="quick-q" onclick="sendQuickQuestion('배달 용기 분리수거 어떻게 해?')">배달 용기 분리수거 어떻게 해?</button>
          <button class="quick-q" onclick="sendQuickQuestion('페트병 라벨 꼭 떼야 해?')">페트병 라벨 꼭 떼야 해?</button>
          <button class="quick-q" onclick="sendQuickQuestion('음식물쓰레기 배출 방법 알려줘')">음식물쓰레기 배출 방법 알려줘</button>
          <button class="quick-q" onclick="sendQuickQuestion('뼈다귀는 음식물쓰레기야?')">뼈다귀는 음식물쓰레기야?</button>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = session.messages.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="message user">
          <div class="message-avatar">${currentUser.name[0].toUpperCase()}</div>
          <div class="message-content">${msg.content}</div>
        </div>`;
    } else {
      return `
        <div class="message bot">
          <div class="message-avatar">🌿</div>
          <div class="message-content">
            <div class="response-section">
              <div class="section-title guide"><span class="section-icon">📋</span> 가이드 근거</div>
              <p>${msg.guide}</p>
            </div>
            <div class="response-section">
              <div class="section-title law"><span class="section-icon">📄</span> 법률 근거</div>
              <p>${msg.law}</p>
            </div>
            <div class="response-section">
              <div class="section-title tip"><span class="section-icon">💡</span> 실천 팁</div>
              <p>${msg.tip}</p>
            </div>
            <span class="source-tag">출처: ${msg.source}</span>
          </div>
        </div>`;
    }
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// ===== Send Message =====
function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isTyping) return;

  addUserMessage(text);
  input.value = '';
  simulateBotResponse(text);
}

function sendQuickQuestion(text) {
  if (isTyping) return;
  addUserMessage(text);
  simulateBotResponse(text);
}

function addUserMessage(text) {
  const session = chatSessions.find(s => s.id === currentSessionId);
  if (!session) return;

  session.messages.push({ role: 'user', content: text });

  // 첫 메시지면 제목 업데이트
  if (session.messages.length === 1) {
    session.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
    renderChatList();
  }

  renderMessages();
}

function simulateBotResponse(question) {
  isTyping = true;
  const container = document.getElementById('chat-messages');

  // 타이핑 인디케이터
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="message-avatar">🌿</div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  // 응답 생성 (1.5초 딜레이)
  setTimeout(() => {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const region = session.region;
    let response;

    // 데모 응답 매칭
    if (DEMO_RESPONSES[question] && DEMO_RESPONSES[question][region]) {
      response = DEMO_RESPONSES[question][region];
    } else {
      // 부분 매칭 시도
      const matchedKey = Object.keys(DEMO_RESPONSES).find(key =>
        question.includes(key.substring(0, 5)) || key.includes(question.substring(0, 5))
      );
      if (matchedKey && DEMO_RESPONSES[matchedKey][region]) {
        response = DEMO_RESPONSES[matchedKey][region];
      } else {
        response = getDefaultResponse(region);
      }
    }

    session.messages.push({
      role: 'bot',
      guide: response.guide,
      law: response.law,
      tip: response.tip,
      source: response.source
    });

    // 타이핑 인디케이터 제거 후 렌더링
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();

    isTyping = false;
    renderMessages();
  }, 1500);
}

// Enter 키로 전송
document.getElementById('chat-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 새 대화 버튼
document.getElementById('new-chat-btn').addEventListener('click', createNewSession);

// ===== Admin Tab Switching =====
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[data-tab="${tabName}"]`).classList.add('active');

  document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
}
