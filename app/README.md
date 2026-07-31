# 백엔드 설계 노트

> 이 문서는 "어떻게 동작하는가"가 아니라 **"왜 이렇게 짰는가"**를 남기기 위한 문서다.
> 코드만 보면 당연해 보이는 결정도 있고, 다른 선택지를 일부러 버린 것도 있다.
> 나중에 이 코드를 건드릴 팀원(RAG, 요약, 프론트, meetings 담당 전부)이
> "왜 굳이 이렇게 했지?"라는 질문에 매번 새로 답하지 않도록 여기에 적어둔다.

---

## 1. 인증: Bearer 토큰이 아니라 "쿠키에 담은 JWT"

`frontend/README.md`에 이미 합의돼 있던 계약: **인증은 세션 쿠키, JWT/Bearer 아님.**
프론트(`lib/api.ts`)는 로그인 응답에서 토큰을 저장하지도, `Authorization` 헤더에 실어 보내지도 않는다.
모든 요청에 `credentials: "include"`만 붙여서 브라우저가 쿠키를 알아서 실어 나르게 한다.

그런데 JWT 발급/검증 로직(`core/security.py`)은 이미 짜여 있었고 잘 동작한다. 그래서 **JWT 자체를 버리지 않고, 담는 그릇만 바꿨다.**

- 로그인 성공 시: `Authorization` 헤더로 토큰을 돌려주는 대신 `Set-Cookie`로 `access_token`이라는 `httpOnly` 쿠키에 담아 내려준다 (`routers/api.py`의 `_set_session_cookie`).
- 인증이 필요한 엔드포인트: 기존에는 `OAuth2PasswordBearer`가 `Authorization: Bearer ...` 헤더를 읽었는데, 지금은 `request.cookies.get("access_token")`으로 바꿨다.
- 프론트 입장에서는 로그인 이후로 토큰의 존재를 전혀 몰라도 되고, 로그아웃은 그냥 쿠키를 지우는 것으로 끝난다.

**왜 아예 세션(DB에 세션 저장)으로 안 갔나?** JWT 인프라(발급/검증/만료)가 이미 있는데 새로 만들 이유가 없었다. "쿠키 vs 헤더"는 그릇의 문제고, "JWT vs 서버 세션"은 그 안의 내용물 문제라서 둘을 분리해서 생각했다.

> ⚠️ `secure=False`로 박아뒀다. 로컬 http 개발 환경 기준이고, **https로 배포하면 반드시 `secure=True`로 바꿔야 한다.** 안 바꾸면 브라우저가 쿠키를 아예 안 보낼 수도 있고, 반대로 http에서 그대로 두면 쿠키가 평문으로 오간다.

---

## 2. 문서 스키마: `content` vs `content_text`, 왜 두 필드로 쪼갰나

프론트(`DocumentScreen.tsx`)에 이미 이렇게 주석이 달려 있었다:

> "content — 에디터 전용, 백엔드는 통째로 저장만 한다. content_text — 요약·RAG·검색이 읽는 평문."

이건 임의로 정한 게 아니라 **프론트-백엔드 사이에 이미 합의된 규칙**이고, 이유는 명확하다:

- `content`는 에디터(지금은 텍스트박스, 나중엔 TipTap)가 다루는 **임의의 JSON**이다. 백엔드가 이 구조를 알 필요도, 파싱할 필요도 없다. 그래서 타입도 `Any`로 뒀다.
- `content_text`는 그 JSON에서 사람이 읽는 텍스트만 뽑아낸 **순수 평문**이다. 요약(`gemini_service`)이나 RAG 청킹(`chunk_service`, 다른 팀원 담당)은 이 필드만 읽으면 되고, TipTap JSON 구조를 직접 파싱하는 코드를 따로 짤 필요가 없다.

**만약 이 필드를 안 나눴다면?** RAG나 요약 쪽에서 매번 `content`의 JSON 구조를 열어서 텍스트를 추출하는 코드를 짜야 했을 거고, 에디터 구조가 바뀔 때마다(예: TipTap 버전업) 그 파싱 코드도 같이 고쳐야 했을 거다. 지금 구조에서는 에디터가 뭐로 바뀌든 `content_text`만 정확히 채워주면 나머지는 안 건드려도 된다.

**DB에는 어떻게 저장하나?** `Document.content`는 `Text` 컬럼이라 문자열만 들어간다. 그래서 저장할 때 `json.dumps`, 돌려줄 때 `json.loads`로 왕복시킨다 (`document_service.py`의 `serialize_content`/`deserialize_content`). `content_text`는 이미 문자열이라 그대로 저장한다.

---

## 3. 문서 목록: 트리가 아니라 "평평한 리스트"인 이유

`Document` 모델엔 `parent_id`가 있어서 트리 구조를 만들 수 있고, 실제로 `GET /documents/tree`라는 재귀 트리 엔드포인트도 이미 있다. 그런데 **정작 프론트는 이 엔드포인트를 한 번도 호출하지 않는다.**

`Sidebar.tsx`를 보면:
```tsx
className={`nav-item${doc.parent_id ? " nav-item--child" : ""}`}
```
`parent_id`가 있으면 CSS로 살짝 들여쓰기만 할 뿐, 실제 트리를 그리지는 않는다. `App.tsx`도 `documents.list()` 결과를 그냥 전체 목록으로 쓰고, 첫 번째 문서(`list[0]`)를 초기 화면으로 잡는다 — 최상위 문서인지 아닌지 신경 안 쓴다.

그래서 `GET /documents`를 파라미터 없이 부르면 **owner의 문서 전체를 평평하게** 반환하도록 바꿨다. 원래는 `parent_id`를 안 주면 최상위 문서만 걸러서 돌려줬는데, 그러면 자식 문서들이 사이드바에 통째로 안 보이는 문제가 있었다. 다만 `?parent_id=3` 처럼 명시적으로 특정 부모를 지정하면 그 자식들만 거르는 예전 동작은 그대로 남겨뒀다 — 나중에 진짜 트리 UI가 붙을 때를 위한 여지다.

`/documents/tree`는 지금 프론트가 안 쓰지만 그냥 남겨뒀다. 죽은 코드이긴 한데, 굳이 지울 이유도 없고 나중에 트리 뷰가 필요해지면 바로 쓸 수 있다.

---

## 4. 요약 엔드포인트: 왜 `/documents/{id}/summary`를 새로 만들었나

프론트는 `POST /documents/{id}/summary`를 호출하는데(`documentsApi.summarize`), 원래 있던 건 `/gemini/summarize`(문서 id가 아니라 임의의 `prompt` 문자열을 받는 엔드포인트)뿐이었다. 그래서:

- `/documents/{id}/summary`를 새로 만들었다. 이 엔드포인트는 그 문서의 `content_text`를 읽어서 `gemini_service.generate_summary()`에 넘기고, 결과를 응답으로 주는 동시에 `Document.summary` 컬럼에도 저장한다 (재조회해도 남아있도록).
- `/gemini/summarize`는 그대로 뒀다. 문서에 안 묶인 임의 텍스트를 요약하고 싶을 때(예: meetings 파이프라인에서 문서화 전에 미리 요약해보는 경우) 쓸 자리로 남겨뒀다.

**`gemini_service.py`는 지금 스텁이다.** 원래 이 파일 자체가 저장소에 없어서(요약 담당 팀원이 아직 안 만든 상태), 로그인 라우터를 연결하자마자 `ImportError`로 서버가 안 뜨는 상태였다. 그래서 `generate_summary(prompt)` 함수 하나만 최소한으로 채워뒀다 — `GEMINI_API_KEY`가 없으면 "요약 기능 준비 중" 문자열을 돌려주는 정도다. 실제 Gemini 연동은 요약 담당 팀원 몫이고, 이 스텁은 그냥 덮어써도 된다.

RAG 팀원 문서(`RAG_수정_파일구조.md`)를 보면 `answer_with_context(question, context)`라는 별도 함수를 이 파일에 추가할 계획이라고 되어 있다. 그건 `generate_summary`와는 이름도 역할도 다른 별개 함수라 지금 스텁과 충돌은 없다. 다만 이 파일이 "요약 담당 + RAG 담당" 두 역할이 같이 건드리는 파일이 됐으니, 작업 전에 서로 최신 코드를 받고 시작하는 게 좋다.

---

## 5. 그 밖에 고쳐야만 했던 버그들 (기능 추가 아님, 순수 버그 수정)

아래 세 가지는 로그인/문서 API를 실제로 동작시키려다 보니 어쩔 수 없이 마주친, **역할과 무관한 인프라 버그**다.

| 파일 | 문제 | 증상 |
|---|---|---|
| `app/models.py` | `Document.children` 관계에서 `remote_side`가 반대쪽에 붙어 있어서 `delete-orphan` cascade 설정이 SQLAlchemy 규칙에 어긋남 | `User`만 조회해도(연관된 `Document` 매퍼까지 같이 설정하려다) 500 에러. **모든 DB 쿼리가 막혀 있던 상태.** |
| `requirements.txt` | 설치돼 있던 `bcrypt`(5.x)가 `passlib`(1.7.4, 사실상 유지보수 종료)와 호환이 안 됨 | 비밀번호 해시/검증 시도할 때마다 `ValueError` |
| `requirements.txt` | `pydantic`의 `EmailStr`를 쓰는데 `email-validator` 패키지가 애초에 없었음 | 회원가입/로그인 스키마 임포트 자체가 실패 |
| `.env` | 루트에 파일 자체가 없어서 `DATABASE_URL`, `SECRET_KEY` 필수값이 비어있었음 | 앱 설정 로딩(`core/config.py`) 단계에서 죽음 |

이 네 가지는 누구 역할이라서 고친 게 아니라, **어떤 역할이든 DB에 손대는 순간 똑같이 겪었을 문제**라 지금 고쳐뒀다.

---

## 6. 아직 안 된 것 (다음에 손볼 사람을 위한 메모)

- `meetings`(녹취록), `chat`(RAG 챗봇) 엔드포인트는 `routers/api.py`에 아직 없다. 프론트는 이미 `/meetings`, `/chat` 경로를 호출하도록 짜여 있어서, 화면 전환하면 404가 날 것이다.
- `gemini_service.py`의 실제 Gemini 연동, RAG 쪽 4개 신규 서비스(`chunk_service`, `embedding_service`, `vector_store_service`, `rag_service`)는 이 문서 작성 시점 기준 아직 없다 (`RAG_수정_파일구조.md` 참고).
- MySQL이 아니라 로컬 SQLite(`sqlite:///./data/app.db`)로 임시 설정해뒀다. 팀에서 쓰기로 한 실제 DB가 있으면 `.env`의 `DATABASE_URL`만 바꾸면 된다 (`pymysql`은 이미 `requirements.txt`에 있음).
