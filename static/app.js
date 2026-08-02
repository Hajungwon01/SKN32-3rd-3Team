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
  if (pageId === 'admin-page') loadAdminDashboard();
}

// ===== 시작하기 (로그인 상태 분기) =====
function goToStart() {
  if (currentUser) {
    showPage('chat-page');
  } else {
    showPage('signup-page');
  }
}

// ===== 가이드 페이지 =====
const GUIDE_DATA = {
  'recycling': {
    title: '분리배출 가이드',
    icon: '#2D8B4E',
    color: '#E8F5EE',
    sections: [
      { heading: '분리배출 기본 원칙', items: ['비운다: 용기 속 내용물을 깨끗이 비운다', '헹군다: 물로 헹구는 등 이물질을 제거한다', '분리한다: 라벨, 뚜껑 등 다른 재질을 분리한다', '섞지 않는다: 재질별로 구분하여 해당 수거함에 배출한다'] },
      { heading: '종이류', items: ['골판지 상자: 테이프 제거 후 접어서 배출', '종이팩: 내용물 비우고 헹궈 말린 후 전용수거함 배출', '신문지: 반듯하게 펴서 묶어 배출', '비해당: 코팅 종이컵, 영수증, 사진용지 → 종량제봉투'] },
      { heading: '플라스틱류', items: ['페트병: 내용물 비우고 라벨 제거, 찌그러뜨려 뚜껑 닫고 배출', '투명 페트병: 별도 분리 배출 (라벨 반드시 제거)', '비닐류: 이물질 제거 후 비닐류로 배출', '비해당: 오염된 비닐, 식탁보, 고무장갑 → 종량제봉투'] },
      { heading: '유리병', items: ['음료·소주병: 헹군 후 분리배출', '빈용기보증금 대상 유리병: 소매점 반납하여 보증금 환급', '비해당: 깨진 유리(신문지 싸서 종량제봉투), 내열유리, 도자기류'] },
      { heading: '금속캔', items: ['알루미늄캔·철캔: 내용물 비우고 헹궈서 배출', '부탄가스·살충제: 통풍 장소에서 잔여 가스 제거 후 배출', '비해당: 알루미늄 호일(종량제봉투)'] },
    ]
  },
  'food-waste': {
    title: '음식물쓰레기 배출 가이드',
    icon: '#D4890B',
    color: '#FFF8E1',
    sections: [
      { heading: '음식물쓰레기 판별 기준', items: ['동물이 먹을 수 있는 것 → 음식물쓰레기', '동물이 먹을 수 없는 것 → 일반쓰레기(종량제봉투)'] },
      { heading: '음식물쓰레기 해당', items: ['과일 껍질 (수박, 귤, 사과 등)', '채소 자투리, 남은 밥·반찬', '달걀 내용물, 생선살'] },
      { heading: '일반쓰레기 해당 (주의)', items: ['쪽파·대파 뿌리, 양파 껍질, 옥수수 껍질·속대', '호두·밤·땅콩 등 딱딱한 껍데기', '소·돼지·닭 뼈, 생선 뼈', '조개·굴·전복 등 패류 껍데기', '달걀 껍데기', '한약재 찌꺼기, 티백'] },
      { heading: '배출 방법', items: ['물기를 최대한 제거한 후 배출', '전용 종량제봉투 또는 RFID 감량기 이용', '지역별 배출 요일·시간 확인'] },
    ]
  },
  'energy': {
    title: '에너지 절약 가이드',
    icon: '#3B7DD8',
    color: '#E8F0FB',
    sections: [
      { heading: '전기 절약', items: ['사용하지 않는 콘센트 뽑기 (대기전력 차단)', '에너지효율 1등급 가전제품 사용', '냉장고 적정 용량 유지 (60~70%)', 'LED 조명 사용, 불필요한 조명 끄기', '에어컨 적정 온도: 냉방 26°C, 난방 20°C'] },
      { heading: '가스 절약', items: ['샤워 시간 줄이기 (1분 줄이면 연 2만원 절약)', '보일러 외출 모드 활용', '겨울철 내복 착용 (체감온도 3°C 상승 효과)', '창문 틈새 단열 강화'] },
      { heading: '지원 제도', items: ['에너지바우처: 취약계층 냉·난방비 지원', '탄소포인트제: 에너지 절감 실적에 따라 포인트 지급', '한전 에너지캐시백: 전년 동기 대비 절감 시 캐시백', '그린리모델링: 노후 건축물 에너지 성능 개선 지원'] },
    ]
  },
  'region-seoul': {
    title: '서울특별시 분리배출 가이드',
    icon: '#2D8B4E',
    color: '#E8F5EE',
    sections: [
      { heading: '서울시 분리배출 특징', items: ['60여 개 품목 표준 배출 기준안 통일', '투명 페트병 별도 분리배출 의무화', '아파트·단독주택 동일 기준 적용'] },
      { heading: '품목별 요령', items: ['골판지: 테이프 제거 후 종이류로 분리배출', '보냉 택배 상자(비닐·알루미늄 안감): 종량제봉투', '투명 페트병: 라벨 제거 후 찌그러뜨려 별도 배출', '스티로폼: 이물질 제거 후 흰색만 분리배출'] },
      { heading: '배출 시간', items: ['해진 후 ~ 자정 사이 배출 권장', '재활용 배출일은 자치구별 상이 (주 2회 이상)'] },
      { heading: '문의', items: ['서울시 자원순환과: 02-2133-3735', '서울시 120 다산콜센터'] },
    ]
  },
  'region-cheonan': {
    title: '천안시 분리배출 가이드',
    icon: '#3B7DD8',
    color: '#E8F0FB',
    sections: [
      { heading: '천안시 분리배출 특징', items: ['요일별 배출제 시행 (지역에 따라 상이)', '투명 페트병 별도 분리배출', '대형 폐기물 사전 신고제 운영'] },
      { heading: '품목별 요령', items: ['비닐류: 이물질 제거 후 투명 비닐봉투에 모아 배출', '스티로폼: 택배 상자 테이프·운송장 제거 후 배출', '폐형광등·폐건전지: 주민센터·아파트 전용수거함 배출'] },
      { heading: '배출 요일', items: ['아파트: 단지 내 지정 요일 확인', '단독주택: 월·수·금 (재활용), 화·목·토 (일반)'] },
      { heading: '문의', items: ['천안시 자원순환과: 041-521-5252', '천안시 청소행정과: 041-521-5280'] },
    ]
  },
  'region-busan': {
    title: '부산 남구 분리배출 가이드',
    icon: '#D4890B',
    color: '#FFF8E1',
    sections: [
      { heading: '부산 남구 분리배출 특징', items: ['요일별 배출제 시행', '플라스틱류 수요일 배출', '스티로폼 별도 배출 의무화'] },
      { heading: '품목별 요령', items: ['플라스틱: 내용물 비우고 라벨 제거 후 수요일 배출', '종이류: 물기에 젖지 않게 묶어서 월요일 배출', '캔·고철: 내용물 비우고 화요일 배출', '스티로폼: 이물질 제거 후 금요일 배출'] },
      { heading: '음식물쓰레기', items: ['RFID 종량제 시행 지역 확대', '전용 용기 사용, 물기 제거 후 배출'] },
      { heading: '문의', items: ['부산 남구 자원순환과: 051-607-4471', '부산 남구청 홈페이지 > 분리배출 안내'] },
    ]
  },
};

function openGuide(type) {
  const data = GUIDE_DATA[type];
  if (!data) return;

  const container = document.getElementById('guide-content');
  const sections = data.sections;
  // 섹션이 홀수면 마지막 하나를 full-width로
  const gridSections = sections.map((sec, i) => {
    const isLast = i === sections.length - 1 && sections.length % 2 === 1;
    return `<div class="guide-section${isLast ? ' full-width' : ''}">
        <h2>${sec.heading}</h2>
        <ul>${sec.items.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="guide-header" style="border-left: 4px solid ${data.icon}; background: ${data.color};">
      <h1>${data.title}</h1>
      <p>환경부 가이드라인 및 지역 조례 기반</p>
    </div>
    <div class="guide-sections-grid">
      ${gridSections}
    </div>
    <div class="guide-cta">
      <p>더 궁금한 점이 있으신가요?</p>
      <button class="btn btn-primary" onclick="goToStart()">챗봇에게 질문하기</button>
    </div>
  `;

  showPage('guide-page');
  container.scrollTop = 0;
}

// ===== Landing Page =====
function scrollToSection(e, id) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToChatWith(question, region) {
  if (!currentUser) {
    // 로그인 안 된 상태면 로그인 페이지로 → 로그인 후 챗봇 진입
    sessionStorage.setItem('pendingQuestion', question);
    sessionStorage.setItem('pendingRegion', region);
    showPage('login-page');
    return;
  }
  // 지역 설정
  const regionSelect = document.getElementById('region-select');
  if (region && regionSelect) {
    regionSelect.value = region;
  }
  showPage('chat-page');
  // 질문이 있으면 자동 전송
  if (question) {
    setTimeout(() => {
      document.getElementById('chat-input').value = question;
      sendMessage();
    }, 300);
  }
}

// ===== Auth =====
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || '로그인에 실패했습니다.');
      return;
    }
    const data = await res.json();
    currentUser = {
      email: data.email,
      name: data.name || data.email.split('@')[0],
      isAdmin: data.email.includes('admin'),
    };
    initChat();
    applyPendingChat();
  } catch (err) {
    alert('서버에 연결할 수 없습니다.');
  }
});

function applyPendingChat() {
  const pendingQ = sessionStorage.getItem('pendingQuestion');
  const pendingR = sessionStorage.getItem('pendingRegion');
  if (pendingR) {
    const regionSelect = document.getElementById('region-select');
    if (regionSelect) regionSelect.value = pendingR;
  }
  sessionStorage.removeItem('pendingQuestion');
  sessionStorage.removeItem('pendingRegion');
  showPage('chat-page');
  if (pendingQ) {
    setTimeout(() => {
      document.getElementById('chat-input').value = pendingQ;
      sendMessage();
    }, 300);
  }
}

document.getElementById('signup-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name')?.value || '';
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-password-confirm').value;

  if (password !== confirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: name || email.split('@')[0] }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || '회원가입에 실패했습니다.');
      return;
    }
    alert('회원가입이 완료되었습니다. 로그인해주세요.');
    showPage('login-page');
  } catch (err) {
    alert('서버에 연결할 수 없습니다.');
  }
});

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (_) {}
  currentUser = null;
  chatSessions = [];
  currentSessionId = null;
  showPage('landing-page');
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
            <div class="response-answer">
              <div class="answer-label"><span class="answer-icon">📋</span> 답변</div>
              <p>${msg.answer}</p>
            </div>
            ${msg.tip ? `
            <div class="response-tip">
              <div class="tip-label"><span class="tip-icon">💡</span> 실천 팁</div>
              <p>${msg.tip}</p>
            </div>` : ''}
            ${msg.source ? `<div class="response-source">출처: ${msg.source}</div>` : ''}
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
  fetchBotResponse(text);
}

function sendQuickQuestion(text) {
  if (isTyping) return;
  addUserMessage(text);
  fetchBotResponse(text);
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

async function fetchBotResponse(question) {
  isTyping = true;
  const container = document.getElementById('chat-messages');
  const session = chatSessions.find(s => s.id === currentSessionId);
  if (!session) { isTyping = false; return; }

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

  // region 매핑: 프론트의 'busan-namgu' → 백엔드의 'busan_namgu'
  const regionMap = { 'busan-namgu': 'busan_namgu' };
  const region = regionMap[session.region] || session.region;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ question, region }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '답변 생성에 실패했습니다.');
    }

    const data = await res.json();
    session.messages.push({
      role: 'bot',
      answer: data.answer || '',
      tip: data.tip || '',
      source: data.source || '',
    });
  } catch (err) {
    session.messages.push({
      role: 'bot',
      answer: `오류가 발생했습니다: ${err.message}`,
      tip: '서버 상태를 확인하거나 잠시 후 다시 시도해 주세요.',
      source: '',
    });
  }

  // 타이핑 인디케이터 제거 후 렌더링
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();

  isTyping = false;
  renderMessages();
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

// ===== Admin Dashboard Data =====
const REGION_COLORS = ['#2D8B4E', '#3B7DD8', '#D4890B', '#8B5CF6', '#E5484D'];

async function loadAdminDashboard() {
  await Promise.all([loadStats(), loadRegionStats(), loadTopQuestions(), loadDailyTrend(), loadDocuments()]);
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('stat-total').textContent = d.total.toLocaleString();
    document.getElementById('stat-today').textContent = d.today.toLocaleString();
    document.getElementById('stat-users').textContent = d.active_users.toLocaleString();
    document.getElementById('stat-success').textContent = d.success_rate + '%';

    const weekEl = document.getElementById('stat-week-change');
    weekEl.textContent = (d.week_change >= 0 ? '+' : '') + d.week_change + '% vs 지난주';
    if (d.week_change > 0) weekEl.classList.add('up');

    const todayEl = document.getElementById('stat-today-diff');
    const diff = d.today_diff;
    todayEl.textContent = (diff >= 0 ? '+' : '') + diff + ' vs 어제';
    if (diff > 0) todayEl.classList.add('up');
  } catch (_) {}
}

async function loadRegionStats() {
  try {
    const res = await fetch('/api/admin/region-stats', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('region-stats-container');

    if (data.length === 0) {
      container.innerHTML = '<p class="stat-placeholder">아직 질문 데이터가 없습니다.</p>';
      return;
    }

    const maxCount = Math.max(...data.map(r => r.count));
    container.innerHTML = data.map((r, i) => `
      <div class="region-bar">
        <span class="region-bar-label">${r.label}</span>
        <div class="region-bar-track">
          <div class="region-bar-fill" style="width: ${Math.round(r.count / maxCount * 100)}%; background: ${REGION_COLORS[i % REGION_COLORS.length]};"></div>
        </div>
        <span class="region-bar-value">${r.count}</span>
      </div>
    `).join('');
  } catch (_) {}
}

async function loadTopQuestions() {
  try {
    const res = await fetch('/api/admin/top-questions?limit=5', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('top-questions-container');

    if (data.length === 0) {
      container.innerHTML = '<p class="stat-placeholder">아직 질문 데이터가 없습니다.</p>';
      return;
    }

    container.innerHTML = '<div class="top-questions-list">' + data.map((q, i) => `
      <div class="top-question-item">
        <span class="top-question-rank">${i + 1}</span>
        <span class="top-question-text">${q.question.length > 25 ? q.question.substring(0, 25) + '...' : q.question}</span>
        <span class="top-question-count">${q.count}</span>
      </div>
    `).join('') + '</div>';
  } catch (_) {}
}

async function loadDailyTrend() {
  try {
    const res = await fetch('/api/admin/daily-trend', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('daily-chart-container');

    const maxCount = Math.max(...data.map(d => d.count), 1);
    container.innerHTML = '<div class="daily-bars">' + data.map((d, i) => {
      const height = Math.max(4, Math.round(d.count / maxCount * 100));
      const isToday = i === data.length - 1;
      return `
        <div class="daily-bar-col">
          <span class="daily-bar-count">${d.count}</span>
          <div class="daily-bar" style="height: ${height}px; opacity: ${isToday ? 1 : 0.5 + (i / data.length) * 0.4};"></div>
          <span class="daily-bar-label ${isToday ? 'today' : ''}">${isToday ? '오늘' : d.day}</span>
        </div>`;
    }).join('') + '</div>';
  } catch (_) {}
}

async function loadDocuments() {
  try {
    const res = await fetch('/api/admin/documents', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    // 인덱스 상태
    const statusEl = document.getElementById('index-status');
    if (data.index_exists) {
      statusEl.innerHTML = '<span class="index-dot active"></span><span>인덱스 상태: <strong>정상</strong> (' + data.total_chunks + ' chunks)</span>';
    } else {
      statusEl.innerHTML = '<span class="index-dot"></span><span>인덱스 상태: <strong>미생성</strong></span>';
    }

    // 문서 테이블
    const tbody = document.getElementById('doc-table-body');
    if (data.documents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="stat-placeholder">인덱싱된 문서가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = data.documents.map(d => `
      <tr>
        <td>${d.title}</td>
        <td><span class="type-badge ${d.source_type}">${d.type_label}</span></td>
        <td>${d.region_label}</td>
        <td>${d.chunk_count}</td>
      </tr>
    `).join('');
  } catch (_) {}
}

async function rebuildIndex() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '재빌드 중...';
  try {
    const res = await fetch('/api/rag/rebuild', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    alert('인덱스 재빌드 완료: ' + data.indexed_chunks + ' chunks');
    await loadDocuments();
  } catch (err) {
    alert('재빌드 실패: ' + err.message);
  }
  btn.disabled = false;
  btn.textContent = '🔄 인덱스 재빌드';
}

// ===== File Upload =====
async function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  await uploadFile(file);
  input.value = '';
}

async function uploadFile(file) {
  const allowed = ['.txt', '.md', '.pdf'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    alert('허용되지 않는 파일 형식입니다. (.txt, .md, .pdf만 가능)');
    return;
  }

  const progressEl = document.getElementById('upload-progress');
  const barEl = document.getElementById('upload-progress-bar');
  const textEl = document.getElementById('upload-progress-text');
  progressEl.classList.remove('hidden');
  barEl.style.width = '30%';
  textEl.textContent = `"${file.name}" 업로드 중...`;

  try {
    const formData = new FormData();
    formData.append('file', file);

    barEl.style.width = '60%';
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    barEl.style.width = '90%';
    const data = await res.json();

    if (!res.ok) {
      textEl.textContent = '업로드 실패: ' + (data.detail || '알 수 없는 오류');
      setTimeout(() => progressEl.classList.add('hidden'), 3000);
      return;
    }

    barEl.style.width = '100%';
    textEl.textContent = `"${data.filename}" 업로드 완료! (${data.indexed_chunks || 0} chunks)`;
    await loadDocuments();
    setTimeout(() => progressEl.classList.add('hidden'), 3000);
  } catch (err) {
    textEl.textContent = '업로드 실패: ' + err.message;
    setTimeout(() => progressEl.classList.add('hidden'), 3000);
  }
}

// Drag & Drop
document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('upload-area');
  if (!area) return;

  ['dragenter', 'dragover'].forEach(evt => {
    area.addEventListener(evt, e => { e.preventDefault(); area.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    area.addEventListener(evt, e => { e.preventDefault(); area.classList.remove('drag-over'); });
  });
  area.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
});

// ===== 페이지 로드 시 세션 복원 =====
(async function checkSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      currentUser = {
        email: data.email,
        name: data.name || data.email.split('@')[0],
        isAdmin: data.email.includes('admin'),
      };
      initChat();
    }
  } catch (_) {}
})();
