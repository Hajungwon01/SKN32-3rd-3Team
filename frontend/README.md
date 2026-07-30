# 프론트엔드 (역할 B)

mock 위에서 MVP 5개 기능이 전부 화면에 뜨는 walking skeleton.
백엔드가 하나도 없어도 `npm run dev` 하나로 전 구간이 돌아간다.

```bash
npm install
npm run dev        # http://localhost:5173
```

로그인 화면에서 비밀번호에 아무 값이나 넣으면 통과한다.

## 실서버로 전환

`.env.development`에서 한 줄만 바꾼다.

```
VITE_USE_MOCK=false
```

Vite dev server가 `/api`를 `localhost:8000`으로 프록시한다(`vite.config.ts`).
세션 쿠키를 쓰기 때문에 이 프록시가 없으면 로그인이 유지되지 않는다.

## 배포

```bash
npm run build      # 산출물이 ../app/static/ 에 떨어진다
```

FastAPI가 `app/static/`을 서빙하므로 서버는 하나만 띄우면 된다.
과정 실습 코드의 디렉터리 관례를 그대로 따른다.

## 저장소 설정 (B안: 빌드 산출물을 커밋)

프론트 빌드 결과를 저장소에 넣는다. 그래야 Node를 모르는 팀원도
`uvicorn app.main:app` 한 줄로 화면까지 볼 수 있다.

**루트 `.gitignore`에서 `app/static/`을 제외하지 말 것.**

```gitignore
frontend/node_modules
__pycache__/
.env
vector_store/
# app/static/ 은 커밋한다 (B안)
```

**루트 `.gitattributes`** — 번들 diff를 PR에서 접어 둔다.

```gitattributes
app/static/** linguist-generated=true
```

**규칙 둘.**

1. `npm run build`는 **B만 실행한다.** 여러 명이 빌드하면 번들 파일명 해시가
   달라져서 매번 충돌한다.
2. `app/static/`을 손으로 고치지 않는다. 다음 빌드에서 통째로 지워진다
   (`emptyOutDir: true`).

빌드는 기능 커밋마다 하지 말고 마일스톤에서 `build:` 커밋 하나로 몰아서 한다.

## 백엔드(A)가 넣을 정적 파일 마운트

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routers import api

app = FastAPI()

app.include_router(api.router, prefix="/api")

# 반드시 라우터 등록 뒤에 마운트한다.
# 순서가 바뀌면 "/" 마운트가 /api 요청까지 가로챈다.
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
```

나중에 react-router를 넣으면 알 수 없는 경로가 404가 되므로,
그때 index.html로 떨어뜨리는 catch-all 라우트를 추가해야 한다.

## 구조

```
src/
  types/api.ts          API 계약. 백엔드에 넘길 명세이자 프론트의 타입
  lib/
    api.ts              모든 네트워크 호출의 유일한 통로. mock 스위치가 여기 있다
    mock.ts             가짜 백엔드. STT는 22초에 걸쳐 단계가 넘어간다
    useMeeting.ts       종료 상태까지 폴링하는 훅
  session.tsx           로그인 상태 + 부팅 시 세션 확인
  components/
    Sidebar.tsx         문서·녹취록 목록, 진행 중인 작업 표시
    PipelineStages.tsx  전사 파이프라인 단계 표시
  screens/
    LoginScreen.tsx
    DocumentScreen.tsx  제목 + 본문 + 저장 + 요약
    MeetingScreen.tsx   업로드 → 진행률 → 취소 → 만들어진 문서
    ChatScreen.tsx      질문 → 답변 + 근거 문서
  App.tsx               앱 셸, 화면 전환, 전역 작업 감시자
```

## 백엔드(A)에 전할 것

`src/types/api.ts`가 명세다. 그중 협의가 필요한 건 셋뿐이다.

1. **인증은 세션 쿠키.** JWT/Bearer 아님. FastAPI 튜토리얼이 `OAuth2PasswordBearer`를
   기본으로 안내하므로 미리 맞추지 않으면 어긋난다.
2. **필드명은 snake_case.** 프론트에 변환 계층을 두지 않는다.
3. **문서 저장은 `content` + `content_text` 두 필드.**
   `content`는 에디터 전용이라 백엔드가 해석할 필요 없이 통째로 저장만 하면 되고,
   요약·RAG·검색이 읽는 건 `content_text`다. 이것만 지금 확정돼야 한다 —
   나중에 추가하면 기존 문서의 평문이 비어 있어서 재색인이 필요해진다.

## 아직 안 한 것 (의도된 것)

- **에디터는 `<textarea>`.** TipTap은 관통이 끝난 뒤. 바뀌어도 저장 계약은 그대로다.
- **라우터 없음.** 화면 전환이 상태다. 문서 링크·뒤로가기가 필요해지면
  `App.tsx`와 `Sidebar.tsx` 두 파일만 고치면 된다.
  (그때 위의 SPA catch-all 라우트도 함께 필요해진다.)
- **브라우저 녹음 없음.** 파일 업로드가 끝까지 동작한 뒤에 MediaRecorder를 붙인다.
- **문서 트리 계층/드래그앤드롭 없음.** `parent_id`는 스키마에만 있고 화면은 평면 목록.
