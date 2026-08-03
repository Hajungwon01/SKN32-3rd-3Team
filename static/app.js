// ===== State =====
let currentUser = null;
let chatSessions = [];
let currentSessionId = null;
let isTyping = false;

// ===== 지역별 데모 응답 데이터 =====
const REGION_LABELS = {
  'seoul': '서울',
  'cheonan': '천안',
  'busan_namgu': '부산 남구',
  'incheon_michuhol': '인천 미추홀구',
  'sejong': '세종',
  'jeju': '제주',
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
    'busan_namgu': {
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
    'busan_namgu': {
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
    'busan_namgu': {
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
    'busan_namgu': {
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
  sessionStorage.setItem('ecobot_last_page', pageId);
  if (pageId === 'admin-page') loadAdminDashboard();
}

// ===== 시작하기 (로그인 상태 분기) =====
function goToStart() {
  if (currentUser) {
    showPage('chat-page');
  } else {
    showPage('login-page');
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
  'region-incheon': {
    title: '인천 미추홀구 분리배출 가이드',
    icon: '#7B2D8B',
    color: '#F3E8FB',
    sections: [
      { heading: '미추홀구 분리배출 특징', items: ['요일별 배출제 시행 (재활용: 수·토)', '투명 페트병 별도 분리배출 의무화', '대형 폐기물 인터넷 신고제 운영'] },
      { heading: '품목별 요령', items: ['비닐류: 이물질 제거 후 투명 봉투에 모아 배출', '스티로폼: 테이프·운송장 제거 후 배출', '폐형광등·폐건전지: 주민센터·아파트 전용수거함 배출', '투명 페트병: 라벨 제거 후 찌그러뜨려 별도 배출'] },
      { heading: '배출 시간', items: ['재활용: 수요일·토요일 저녁 6시~자정', '일반쓰레기: 월·화·목·금 저녁 6시~자정'] },
      { heading: '문의', items: ['미추홀구 자원순환과: 032-880-4384', '인천시 환경콜센터: 032-440-3355'] },
    ]
  },
  'region-sejong': {
    title: '세종시 분리배출 가이드',
    icon: '#D44B0B',
    color: '#FDE8E8',
    sections: [
      { heading: '세종시 분리배출 특징', items: ['거점 수거 방식 (클린하우스) 운영', '공동주택 단지 내 분리수거장 설치', 'RFID 음식물쓰레기 종량제 시행'] },
      { heading: '품목별 요령', items: ['플라스틱: 내용물 비우고 라벨 제거 후 배출', '종이류: 물에 젖지 않게 묶어 배출', '유리병: 뚜껑 제거 후 색상별 분리배출', '의류: 의류수거함 또는 클린하우스 이용'] },
      { heading: '음식물쓰레기', items: ['RFID 전용 용기 사용', '물기 최대한 제거 후 배출', '뼈·껍데기·씨앗류는 일반쓰레기로 배출'] },
      { heading: '문의', items: ['세종시 환경과: 044-300-3543', '세종시청 홈페이지 > 분리배출 안내'] },
    ]
  },
  'region-jeju': {
    title: '제주도 분리배출 가이드',
    icon: '#0B8BD4',
    color: '#E8F4FB',
    sections: [
      { heading: '제주도 분리배출 특징', items: ['클린하우스(재활용도움센터) 거점 수거', '관광객 대상 분리배출 안내 강화', '해양쓰레기 수거 캠페인 운영'] },
      { heading: '품목별 요령', items: ['플라스틱: 내용물 비우고 라벨 제거 후 배출', '페트병: 투명·유색 분리, 라벨 제거 후 압축 배출', '스티로폼: 수산물 상자 등 이물질 제거 후 배출', '비닐: 깨끗이 씻어 투명 봉투에 모아 배출'] },
      { heading: '음식물쓰레기', items: ['종량제 봉투(노란색) 사용', '물기 최대한 제거 후 배출', '감귤 껍질은 음식물쓰레기로 배출 가능'] },
      { heading: '문의', items: ['제주시 청소행정과: 064-728-3794', '서귀포시 청소행정과: 064-760-3194', '제주특별자치도 환경보전국: 064-710-6421'] },
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
    sessionStorage.setItem('pendingQuestion', question);
    sessionStorage.setItem('pendingRegion', region);
    showPage('login-page');
    return;
  }
  const regionSelect = document.getElementById('region-select');
  if (region && regionSelect) {
    regionSelect.value = region;
  }
  showPage('chat-page');
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
  if (!email || !password) return;

  // ⚠️ 원래 여기가 완전 목업(이메일/비번만 있으면 무조건 통과, 백엔드 호출
  // 없음)이었다. 챗봇 대화 저장이 쿠키 기반 인증에 의존하다 보니, 로그인이
  // 가짜면 채팅 연결도 무의미해서 실제 API 호출로 같이 바꿨다.
  // 이건 원래 프론트 담당(B) 영역이라 손댄 범위가 커진 것 - 내일 공유 필요.
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      alert('로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.');
      return;
    }
    const user = await res.json();  // {id, email, name}
    currentUser = {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      isAdmin: !!user.isAdmin,
    };
    initChat();
    showPage('chat-page');
  } catch (err) {
    console.error('로그인 요청 실패:', err);
    alert('서버에 연결할 수 없습니다.');
  }
});

document.getElementById('signup-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
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
      body: JSON.stringify({ email, password, display_name: name }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || '회원가입에 실패했습니다.');
      return;
    }
    alert('회원가입이 완료되었습니다. 로그인해주세요.');
    showPage('login-page');
  } catch (err) {
    alert('서버에 연결할 수 없습니다.');
  }
});

function logout() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  currentUser = null;
  chatSessions = [];
  currentSessionId = null;
  showPage('login-page');
}

// ===== Chat Init =====
const DEFAULT_QUICK_QUESTIONS = [
  '배달 용기 분리수거 어떻게 해?',
  '페트병 라벨 꼭 떼야 해?',
  '음식물쓰레기 배출 방법 알려줘',
  '뼈다귀는 음식물쓰레기야?',
];
let quickQuestions = [...DEFAULT_QUICK_QUESTIONS];

let _popularCache = null;

async function fetchPopularQuestions(forceRefresh = false) {
  if (_popularCache && !forceRefresh) return _popularCache;
  try {
    const res = await fetch('/api/popular-questions?limit=5', { credentials: 'include' });
    if (!res.ok) return [];
    _popularCache = await res.json();
    return _popularCache;
  } catch (_) { return []; }
}

async function loadPopularQuestions(forceRefresh = false) {
  const data = await fetchPopularQuestions(forceRefresh);
  if (data.length >= 4) {
    quickQuestions = data.slice(0, 4).map(d => d.question);
    renderMessages();
  }
}

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

  // 대화 기록 복원 - 새로고침해도 이전 대화방들이 그대로 남아있도록.
  restoreAllSessions();

  // 인기 질문 로드
  loadPopularQuestions();
}

async function restoreAllSessions() {
  try {
    const res = await fetch('/api/chat/sessions', { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const groups = await res.json();

    if (!groups.length) {
      createNewSession();
      return;
    }

    chatSessions = groups.map(g => {
      const firstUserMsg = g.messages.find(m => m.role === 'user');
      const title = firstUserMsg
        ? (firstUserMsg.content.length > 20 ? firstUserMsg.content.substring(0, 20) + '...' : firstUserMsg.content)
        : '대화';
      return {
        id: g.session_id,
        title,
        region: g.region,
        messages: g.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'bot',
          content: m.content,
          tip: m.tip || '',
          source: m.source || '',
          sources: m.sources || [],
        })),
      };
    });
    currentSessionId = chatSessions[0].id;
    document.getElementById('region-select').value = chatSessions[0].region;

    renderChatList();
    renderMessages();
    updateRegionBadge();
  } catch (err) {
    console.error('대화 기록 복원 실패:', err);
    createNewSession();
  }
}

// ===== Sessions =====
function createNewSession() {
  const region = document.getElementById('region-select').value;
  const session = {
    id: String(Date.now()),
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
         onclick="switchSession('${s.id}')">
      <span class="chat-item-icon">💬</span>
      <span>${s.title}</span>
      <button class="chat-item-delete" onclick="deleteSession('${s.id}', event)" title="삭제">✕</button>
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
          ${quickQuestions.map(q => `<button class="quick-q" onclick="sendQuickQuestion('${q.replace(/'/g, "\\'")}')">${q}</button>`).join('')}
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
    } else if (msg.content !== undefined) {
      // 실제 백엔드(/api/chat) 응답 형식: {answer, tip, source, sources}
      const tipHtml = msg.tip
        ? `<div class="response-tip"><div class="tip-label"><span class="tip-icon">💡</span> 실천 팁</div><p>${msg.tip}</p></div>`
        : '';
      const sourceLabel = msg.source || (msg.sources && msg.sources.length
        ? msg.sources.map(s => s.title).join(', ')
        : '');
      const sourcesHtml = sourceLabel ? `<div class="response-source">출처: ${sourceLabel}</div>` : '';
      return `
        <div class="message bot">
          <div class="message-avatar">🌿</div>
          <div class="message-content">
            <div class="response-answer">
              <div class="answer-label"><span class="answer-icon">📋</span> 답변</div>
              <p>${msg.content}</p>
            </div>
            ${tipHtml}
            ${sourcesHtml}
          </div>
        </div>`;
    } else {
      return `
        <div class="message bot">
          <div class="message-avatar">🌿</div>
          <div class="message-content">
            <div class="response-answer">
              <div class="answer-label"><span class="answer-icon">📋</span> 가이드 근거</div>
              <p>${msg.guide}</p>
            </div>
            <div class="response-answer">
              <div class="answer-label"><span class="answer-icon">📄</span> 법률 근거</div>
              <p>${msg.law}</p>
            </div>
            <div class="response-tip">
              <div class="tip-label"><span class="tip-icon">💡</span> 실천 팁</div>
              <p>${msg.tip}</p>
            </div>
            <div class="response-source">출처: ${msg.source}</div>
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
  askBackend(text);  // 대화 기록 저장/복원 기능 - 실제 백엔드 호출로 교체
}

function sendQuickQuestion(text) {
  if (isTyping) return;
  addUserMessage(text);
  askBackend(text);
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

async function askBackend(question) {
  isTyping = true;
  const container = document.getElementById('chat-messages');

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

  const session = chatSessions.find(s => s.id === currentSessionId);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // 실제 ChatRequest 스키마: {question, region}. region-select 드롭다운 값을
      // 그대로 보낸다 - 화면엔 이미 있던 드롭다운인데 원래 백엔드로 전달을
      // 안 하고 있었음(목업이라 상관없었음). 이제 실제로 전달되게 연결.
      body: JSON.stringify({
        question,
        region: session ? session.region : 'seoul',
        session_id: session ? String(session.id) : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();  // {answer, tip, source, sources}

    if (session) {
      session.messages.push({
        role: 'bot',
        content: data.answer,
        tip: data.tip || '',
        source: data.source || '',
        sources: data.sources || [],
      });
    }
  } catch (err) {
    console.error('챗봇 응답 실패:', err);
    if (session) {
      session.messages.push({
        role: 'bot',
        content: '답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        sources: [],
      });
    }
  }

  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();

  isTyping = false;
  renderMessages();

  // 질문 후 인기 질문 갱신
  loadPopularQuestions(true);
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

  if (tabName === 'documents') loadAdminDocuments();
}

// ===== Admin Dashboard =====
async function loadAdminDashboard() {
  loadAdminStats();
  loadAdminRegionStats();
  loadAdminTopQuestions();
  loadAdminDailyTrend();
  loadAdminDocuments();
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('stat-total').textContent = d.total.toLocaleString();
    document.getElementById('stat-today').textContent = d.today.toLocaleString();
    document.getElementById('stat-users').textContent = d.active_users.toLocaleString();
    document.getElementById('stat-success').textContent = d.success_rate + '%';
    const diffEl = document.getElementById('stat-today-diff');
    if (diffEl) {
      const diff = d.today_diff;
      diffEl.textContent = diff > 0 ? `+${diff} vs 어제` : diff < 0 ? `${diff} vs 어제` : '어제와 동일';
    }
    const weekEl = document.getElementById('stat-week-change');
    if (weekEl) {
      const wc = d.week_change;
      weekEl.textContent = wc > 0 ? `+${wc}% vs 지난주` : wc < 0 ? `${wc}% vs 지난주` : '지난주와 동일';
    }
  } catch (_) {}
}

async function loadAdminRegionStats() {
  try {
    const res = await fetch('/api/admin/region-stats', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('region-stats-container');
    if (!data.length) { container.innerHTML = '<p class="stat-placeholder">질문 데이터가 없습니다.</p>'; return; }
    const total = data.reduce((s, r) => s + r.count, 0);
    const colors = ['#4A7C59', '#6B9E78', '#8FBC8F'];
    container.innerHTML = data.map((r, i) => {
      const pct = total > 0 ? Math.round(r.count / total * 100) : 0;
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
          <span>${r.label}</span><span>${r.count}건 (${pct}%)</span>
        </div>
        <div style="background:#eee;border-radius:4px;height:8px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${colors[i % colors.length]};border-radius:4px"></div>
        </div>
      </div>`;
    }).join('');
  } catch (_) {}
}

async function loadAdminTopQuestions() {
  try {
    const res = await fetch('/api/admin/top-questions?limit=5', { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const container = document.getElementById('top-questions-container');
    if (!data.length) { container.innerHTML = '<p class="stat-placeholder">질문 데이터가 없습니다.</p>'; return; }
    container.innerHTML = data.map((q, i) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
        <span><strong>${i + 1}.</strong> ${q.question.length > 30 ? q.question.substring(0, 30) + '...' : q.question}</span>
        <span style="color:#888;white-space:nowrap;margin-left:8px">${q.count}건</span>
      </div>`
    ).join('');
  } catch (_) {
    const container = document.getElementById('top-questions-container');
    container.innerHTML = '<p class="stat-placeholder">질문 데이터를 불러올 수 없습니다.</p>';
  }
}

async function loadAdminDailyTrend() {
  try {
    const res = await fetch('/api/admin/daily-trend?days=7', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('daily-chart-container');
    if (!data.length) { container.innerHTML = '<p class="stat-placeholder">데이터가 없습니다.</p>'; return; }
    const maxCount = Math.max(...data.map(d => d.count), 1);
    container.innerHTML = `<div style="display:flex;align-items:flex-end;gap:12px;height:160px;padding:10px 0">
      ${data.map(d => {
        const h = Math.max(d.count / maxCount * 130, 4);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <span style="font-size:11px;color:#666">${d.count}</span>
          <div style="width:100%;max-width:40px;height:${h}px;background:#4A7C59;border-radius:4px 4px 0 0"></div>
          <span style="font-size:11px;color:#888">${d.date}<br>${d.day}</span>
        </div>`;
      }).join('')}
    </div>`;
  } catch (_) {}
}

async function loadAdminDocuments() {
  try {
    const res = await fetch('/api/admin/documents', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const statusEl = document.getElementById('index-status');
    if (statusEl) {
      statusEl.innerHTML = data.index_exists
        ? `<span class="index-dot" style="background:#4A7C59"></span><span>인덱스 활성 (${data.total_chunks}개 청크)</span>`
        : `<span class="index-dot" style="background:#ccc"></span><span>인덱스 없음</span>`;
    }
    const tbody = document.getElementById('doc-table-body');
    if (!data.documents || !data.documents.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="stat-placeholder">문서가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = data.documents.map(d =>
      `<tr><td>${d.title}</td><td>${d.type_label}</td><td>${d.region_label}</td><td>${d.chunk_count}</td></tr>`
    ).join('');
  } catch (_) {}
}

async function rebuildIndex() {
  if (!confirm('인덱스를 재빌드하시겠습니까?')) return;
  try {
    const res = await fetch('/api/rag/rebuild', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('재빌드 실패');
    const data = await res.json();
    alert(`인덱스 재빌드 완료 (${data.indexed_chunks || 0}개 청크)`);
    loadAdminDocuments();
  } catch (err) {
    alert('인덱스 재빌드에 실패했습니다: ' + err.message);
  }
}

// ===== 페이지 로드 시 세션 복원 =====
(async function checkSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return;  // 로그인 안 됨 → 랜딩 페이지 유지
    const user = await res.json();
    currentUser = {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      isAdmin: !!user.isAdmin,
    };
    initChat();
    // 새로고침: sessionStorage에 저장된 마지막 페이지 복원
    const lastPage = sessionStorage.getItem('ecobot_last_page');
    if (lastPage && document.getElementById(lastPage)) {
      showPage(lastPage);
    } else {
      // 서버 재시작(sessionStorage 없음): 랜딩 페이지
      showPage('landing-page');
    }
  } catch (_) {}
})();

// ===== 사이드바 리사이즈 =====
(function initSidebarResize() {
  const handle = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('sidebar');
  if (!handle || !sidebar) return;

  let dragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const newWidth = Math.min(500, Math.max(200, e.clientX));
    sidebar.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();