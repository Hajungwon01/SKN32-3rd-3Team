# SKN32-3rd-3Team


## 가상환경 사용할 경우
> python -m venv .venv

## 설치
> pip install -r requirements.txt 

## 서버 띄우기(가상환경인 경우)
```bash
(.venv)> uvicorn app.main:app --reload --port 8001
```

## 서버 띄우기(가상환경 아닌경우)
```bash
>python -m uvicorn app.main:app --reload --port 8001
```

## 데모용 로그인법(서버떠있는 상태로 별도 터미널창 켜서 실행)
register.json에 있는 id, 비밀번호로 임시 계정을 만든다. 파일로 읽는 이유는 명령어에서 문자열이 제대로 인식안되는 
```bash
> curl -X POST http://localhost:8001/api/auth/register -H "Content-Type: application/json" -d @register.json
```