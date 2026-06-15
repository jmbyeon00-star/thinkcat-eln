# ThinkCat-ELN 개발 노트

최종 갱신: 2026-06-12

## 서버 구성

| 서버 | OS | 역할 | 접속 |
|------|----|------|------|
| 개발 서버 (any-rnd-ai-a6000-01) | Ubuntu 20.04 | 코드 개발, 배포 실행 | 로컬 (192.168.1.20) |
| **davinci.financial** (58.229.208.152, 호스트명 qm541-0025) | Ubuntu 22.04 | frontend + backend + DB 운영 (Docker) | `ssh thinkcat@58.229.208.152` |
| **dell-l40s** (211.47.9.109) | Rocky Linux 9.6 | gpu_backend 운영 (Docker) | `ssh -p 20022 thinkcat@211.47.9.109` |

---

## 개발환경 실행 방법

```bash
# GPU 백엔드 (도커)
cd /home/yckim/development/thinkcat-eln
docker compose up   # 포트 8009

# 백엔드 (로컬)
cd backend && ./run.sh      # 포트 8008

# 프론트엔드 (로컬)
cd frontend && ./run.sh     # 포트 3003
```

> ⚠️ 프론트엔드 실행 시 `.next` 폴더 권한 에러 나면:
> `sudo rm -rf frontend/.next` 후 재실행

---

## 운영 배포 방법

```bash
cd /home/yckim/development/thinkcat-eln

./deploy_prod.sh          # 전체 배포 (davinci + L40S)
./deploy_prod.sh davinci  # frontend + backend만
./deploy_prod.sh l40s     # gpu_backend만
```

- davinci: rsync 후 `docker compose up -d --build` (재빌드 포함)
- L40S: rsync 후 `docker compose up -d --build`
- rsync 제외: `__pycache__`, `*.pyc`, `.env`, `.env.local`, `.next/`, `node_modules/`, `.venv/`
- **운영 서버의 `docker-compose.yml`은 rsync 대상이 아님** — 각 서버에서 직접 관리

### ⚠️ NEXT_PUBLIC_* 환경변수는 빌드 시점에 박힌다

Next.js의 `NEXT_PUBLIC_*` 변수는 `npm run build` 시 번들에 문자열로 치환됨.
`env_file`(컨테이너 실행 시)로는 전달 안 되므로 **build args로 전달해야 함**:

- `frontend/Dockerfile`: `ARG`/`ENV` 선언 (적용 완료)
- davinci `docker-compose.yml`: `build.args`에 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_GPU_BASE_URL` 전달 (적용 완료)
- 값 변경 시 **반드시 frontend 재빌드** 필요

### ⚠️ NEXT_PUBLIC_API_BASE_URL에 /api를 붙이면 안 됨

프론트 코드(`lib/api.ts`)가 `/api/...`로 시작하는 경로를 붙이므로
`NEXT_PUBLIC_API_BASE_URL=https://patents.thinkcat.kr` (`/api` 없이) 로 설정.
`/api`를 붙이면 `/api/api/...` 이중 경로로 404 발생 (2026-06-12 실제 발생/해결).

---

## 운영 서버 구조

### davinci `/home/thinkcat/docker/thinkcat-eln/`

```
docker-compose.yml       ← frontend(3003) + backend(8008), build args 포함
.env                     ← 운영 환경변수 (아래 참고)
frontend/  backend/      ← rsync 배포 대상
```

- DB는 컨테이너가 아니라 **davinci 호스트의 MySQL** 사용 (`DB_HOST=host.docker.internal`)
- 개발 DB dump를 import 완료 (불필요 테이블 정리됨)

**davinci .env 핵심 항목 (2026-06-12 기준):**
```
DB_HOST=host.docker.internal
DB_USER=thinkcat / DB_PASS=doslvkdlqm! / DB_NAME=thinkcateln
NEXTAUTH_URL=https://patents.thinkcat.kr
NEXT_PUBLIC_API_BASE_URL=https://patents.thinkcat.kr   ← /api 붙이지 말 것
NEXT_PUBLIC_GPU_BASE_URL=http://211.47.9.109:8009
GPU_BACKEND_URL=http://211.47.9.109:8009
BACKEND_URL=http://backend:8008    ← NextAuth 서버사이드용 (없으면 로그인 불가)
```

### L40S `/home/thinkcat/docker/thinkcat-eln/`

```
docker-compose.yml       ← gpu(8009), NVIDIA GPU 할당, 볼륨 ./gpu_backend:/app
.env                     ← 운영 환경변수
gpu_backend/             ← rsync 배포 대상
```

**L40S 볼륨/경로 (2026-06-11 정리):**
- PDF 파일: 호스트 `/home/thinkcat/docker/elnfiles` → 컨테이너 `/elnfiles` (읽기전용)
- `.env`: `ELN_FILE_BASE_PATH=/elnfiles`
- `THINKCAT_DB_HOST=58.229.208.152` (운영 DB = davinci)

---

## SSL / Apache (davinci)

### 인증서 (2026-06-12 적용)

- **SignSecure 와일드카드** `*.thinkcat.kr` 사용 중
- 위치: `/etc/ssl/thinkcat/` (700, root 전용)
  - `_wildcard_.thinkcat.kr_2026060855D77.all.crt.pem` (체인 포함)
  - `_wildcard_.thinkcat.kr_2026060855D77.key.pem`
- **만료: 2027-06 — 수동 갱신 필요** (SignSecure에서 재발급 후 파일 교체 + `systemctl reload apache2`)
- Let's Encrypt는 발급했다가 와일드카드로 교체 후 삭제함 (`certbot delete` 완료)

### Apache vhost: `/etc/apache2/sites-available/patents.thinkcat.kr-le-ssl.conf` (443)

```apache
ServerName patents.thinkcat.kr
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"   ← 필수! (아래 참고)

ProxyPass /api/auth http://localhost:3003/api/auth   ← NextAuth
ProxyPass /api http://localhost:8008/api             ← FastAPI
ProxyPass / http://localhost:3003/                   ← Next.js
```

- 80 포트는 https로 301 리다이렉트
- `X-Forwarded-Proto` + backend uvicorn `--proxy-headers --forwarded-allow-ips=*` 조합으로
  FastAPI 307 리다이렉트가 https로 발급됨 (없으면 Mixed Content 차단으로 데이터 조회 실패)

---

## 프론트엔드 구조 (2026-06-12 개편)

- **메인 페이지**: 씽캣 지식재산 플랫폼 — 검색 서비스 4카드(사무소/특허/선행기술/R&D공고) 위,
  씽캣 ELN 통합 플랫폼 박스(파란 그라디언트, thinkcat.kr/portal 링크) 아래
- **헤더** (`components/layouts/AgentHeader.tsx` — Layout.tsx에서 사용, `Header.tsx`는 미사용):
  떠있는 카드형, 메인에서 메뉴 숨김 / 서브페이지에서 중앙 메뉴, 로고는 `public/logo.svg`
- **PageShell** (`components/layouts/PageShell.tsx`): 서비스 페이지 공통 레이아웃 (폭 max-w-6xl, 타이틀/여백 통일)
  — 사무소검색, 특허검색, 선행기술조사, R&D공고검색 4페이지 적용
- **auth/layout.tsx**: 로그인/회원가입 공통 중앙정렬+배경
- **폴더별 layout.tsx**: announcement, prior-art, agent (메타데이터)
- `/prior-art`: 선행기술조사 준비중 페이지 (기능 이식 예정 — ipforce에서 포팅)
- 보안 헤더: `next.config.mjs`의 `Permissions-Policy: geolocation=(self)` (위치 기능 허용)

---

## 알려진 이슈 / 제약

### 🔴 운영 특허검색(키워드 벡터 검색) 불가 — 네트워크 구조 문제

```
브라우저 ──①──> GPU백엔드(L40S:8009) ──②──> Neo4j/ES(192.168.1.116, 개발 내부망)
```
- ① L40S 8009 포트가 외부 미개방 + https 페이지에서 http 호출(Mixed Content)
- ② L40S(타지역)에서 개발서버 내부망(.116) 접근 불가 — Neo4j, ES 모두
- 해결 후보: davinci Apache로 GPU 프록시(`/gpu` → L40S, 단 L40S 포트포워딩 선행 필요),
  Neo4j/ES를 외부 접근 가능한 곳으로 이전 등 — **미해결, 논의 필요**

### ✅ Milvus davinci 이전 완료 (2026-06-15) — 구 thinkcat 서버 도커 제거 대응

- **배경**: 구 thinkcat 서버(q381-1830, 175.125.94.218, CentOS 7)의 도커 엔진이 제거되어 Milvus 정지 →
  ipforce 백엔드가 `collection_service.py`의 import 시점 연결에서 크래시 → 로그인 불가 (2026-06-12 확인)
- **이전 결과**: davinci `/home/thinkcat/docker/milvus/` 에 standalone compose로 기동
  (etcd v3.5.0 + minio RELEASE.2022-01-08 + milvus **v2.3.0**, 볼륨 `./volumes/{etcd,milvus,minio}`)
  - 외부 개방 포트: **19530(서비스) + 9091(헬스)만** (etcd·minio는 내부 전용 — 구서버보다 강화)
  - 데이터 검증: 9개 컬렉션(a~h_collection + y_collection), 총 ~140만 엔티티 생존
- **클라이언트 재지정**: 양쪽 `.env` `MILVUS_HOST=58.229.208.152`로 변경,
  코드 fallback 기본값 5곳을 `localhost`로 정리(운영 IP 코드 제거),
  import 시점 connect 위험 3곳(ipforce collection_service·backend/gpu patent_navigation)을 try/except로 보호
- **검증**: ipforce 백엔드 재생성 후 "Successfully connected to Milvus at 58.229.208.152:19530" + 로그인 401 정상
- **남은 일**: ① ipforce gpu_backend 컨테이너 재생성(새 .env 반영, 특허 내비게이션용) ② L40S thinkcat-eln gpu_backend `.env` 변경 후 재배포 ③ davinci `/home/thinkcat/milvus_volumes.tar.gz`(9.1G) 정리 ④ 구서버 44GB(`/etc/docker/volumes/` 구세대 스택)는 보험으로 당분간 보존

### OCR(note/extract)은 운영에서 정상

- Java 서버 ↔ L40S가 같은 인트라넷이라 내부 호출로 동작 (외부 개방 불필요)
- `__pdf` 확장자 없는 파일도 처리됨 (임시 .pdf 복사 방식, note_service.py)

### Neo4j 위치

- Neo4j 실서버: `192.168.1.116:7687` (ES와 같은 서버)
- `gpu_backend/.../neo4j_service.py`에서 `NEO4J_URI` 환경변수로 설정 가능 (기본값 .116)
- ~~192.168.1.149 하드코딩~~ → 2026-06-12 수정됨 (.149는 ipforce 서버라 Neo4j 없음)

---

## 완료된 작업 (날짜순)

### ~2026-06-10 (이전)
- davinci/L40S 서버 구축, deploy_prod.sh, DB dump 이전, Apache 설정 등 (이력 생략)

### 2026-06-11
- 운영 로그인 문제 해결: `BACKEND_URL` 누락 + `NEXTAUTH_URL` 불일치
- L40S 환경 정리: `ELN_FILE_BASE_PATH=/elnfiles`, 볼륨 경로 통일, `THINKCAT_DB_HOST`=davinci
- marker-pdf 0.2.15 / surya-ocr 0.4.14 고정 + `--build` 배포로 OCR 해결
- gpu_backend requirements에 elasticsearch, neo4j 추가 (누락 패키지)
- 운영 DB `research_note_contents` 테이블 생성
- `__pdf` 확장자 파일 OCR 처리 코드 (note_service.py)
- OCR 동기/비동기 모두 운영 검증 완료, Java팀 연동 안내 메일 작성

### 2026-06-12
- 메인화면/헤더/서비스 페이지 전면 개편 (위 "프론트엔드 구조" 참고)
- 선행기술조사 메뉴/페이지 신설 (준비중)
- 개발 검색 복구: Neo4j 주소 수정 (.149 → .116, 환경변수화)
- **운영 정상화**: SSL(와일드카드) 적용, NEXT_PUBLIC build args, /api 중복 제거,
  X-Forwarded-Proto + proxy-headers(Mixed Content 해결), geolocation 허용
- 운영 도메인 https://patents.thinkcat.kr 전 메뉴 데이터 조회 정상 확인
- **로그인/회원가입 포털 경로 변경** (통합 계정 1단계, 미배포):
  - `AgentHeader.tsx` 로그인/회원가입 버튼 4곳 → `https://www.thinkcat.kr/portal/login`·`/portal/signup`
  - `/auth/signup` 페이지 → 포털 가입으로 리다이렉트 (기존 폼: `page.form-backup.tsx.bak`)
  - `/auth/signin`·middleware는 유지 — SSO 연동 전까지 기존 사용자 로그인 통로 (전부 막으면 로그인 수단 소멸)

### 2026-06-15
- **Milvus davinci 이전 완료** (위 "알려진 이슈" 참고)
- **선행기술조사(invalidation) 기능 ipforce→thinkcat-eln 포팅** ✅ 런타임 검증까지 완료:
  - backend: `models/invalidation.py`, `schemas/invalidation_schema.py`, `crud/crud_invalidation_history.py`,
    `services/invalidation/`(7파일+프롬프트), `api/routers/invalidation_router.py`(1782줄) 이식.
    `config.py`에 `GPU_BACKEND_URL` 추가, main/init_db 등록. `pdfplumber` 추가. 21라우트·INVAL_* 7테이블 확인
  - gpu_backend: `core/llm/invalidation/`(10파일), `models/stanine_techdna.py`, `api/services/invalidation_service.py`,
    `api/routers/invalidation_router.py` 이식. main 등록. `anthropic==0.89.0` 추가. 10라우트 확인
  - frontend: pages router → app router 변환. `lib/invalidation_api.ts` 복사(BFF 불필요 — eln rewrite/Apache가 backend 직결),
    `next.config` proxyTimeout 추가. 4페이지 → `app/[locale]/prior-art/{page,analysis,report,patent/[id]}`.
    변환 규칙: `'use client'`, `useRouter`=@/routing, `useSearchParams`/`useParams`=next/navigation, `<Head>` 제거,
    `router.isReady` 제거, 경로 `/invalidation`→`/prior-art`·`/search/applicationNum`→`/applicationNum`. tsc 통과
  - UI는 ipforce 그대로(사용자 선택). 기존 `/prior-art` 준비중 page.tsx 교체(layout.tsx 유지)
  - **런타임 검증 통과**: 개발 DB에 INVAL_* 7테이블 생성, gpu 컨테이너 재생성(.env MILVUS davinci 반영 + `anthropic` 설치),
    `CLAUDE_API_KEY`를 thinkcat-eln `.env`에 추가(ipforce에서 복사). prepare-from-text end-to-end 성공 —
    Claude 정돈 + Milvus(davinci) 선행특허 검색 3건(유사도 0.78~0.80) 정상
  - **LLM 모델 4-6→4-8 업그레이드**(비용 동일, 더 우수): 양쪽 gpu `invalidation_service.py` 기본값 +
    ipforce backend config 2곳을 `claude-opus-4-8`로 변경. thinkcat-eln gpu 4-8 재검증 완료
  - **IPFORCE 브랜딩 정리 완료**(2026-06-15): 포팅 3페이지(patent/[id]·analysis·report) 푸터·헤더의 "IPFORCE"→"씽캣",
    "© 2026 IPFORCE"→"© 2026 THINKCAT-ELN"(기존 Footer.tsx와 통일), 로고박스 "I"→"씽". tsc 통과
  - **남은 것**: 운영 배포 시 INVAL_* 테이블 생성·frontend 재빌드
  - **개발 gpu .env 주의**: `CLAUDE_API_KEY`/`ANTHROPIC_API_KEY` thinkcat-eln `.env`에 추가됨.
    thinkcat-eln gpu 재생성 시마다 `anthropic`(requirements엔 있음, 이미지 미반영) 재설치 필요 — 운영 배포는 `--build`로 한 번에 해결.
    (ipforce gpu는 requirements에 anthropic 있어 이미지 포함 → 재생성해도 유지)

- **gpu_backend 구조 표준화 `app/api/services` → `app/services`** (포팅 후속, 사용자 합의):
  - 대상 3곳: thinkcat-eln backend, thinkcat-eln gpu_backend, ipforce gpu_backend (ipforce backend는 이미 표준화됨)
  - 각각 서비스 `.py` + `data`/`model`/`stdSc` 폴더를 `services/`로 이동, import 절대(`app.api.services`)+상대(`from ..services`) 모두 `app.services`로 치환
  - 라우터는 `api/routers` 유지(인터페이스 계층 표준). **표준 = api/는 라우터까지, 비즈니스 로직(service)은 api 밖**
  - **부수 효과(버그 수정)**: ipforce gpu `patent_citation/npecheck_service`가 모델을 `/app/app/services/model`(절대경로)에서 찾는데 파일은 `api/services/model`에 있어 깨져 있던 것 → 표준화로 정합성 회복
  - 검증: 3곳 모두 import 체인 정상, 라우트 유지(eln backend 58·invalidation 21, gpu 10). ipforce gpu 재생성으로 davinci+4-8+services 일괄 반영
  - **빈 잔재 정리**: 표준화로 `app/routers`(라우터는 api/routers에 있어 빈 껍데기)도 불필요 → gpu 2곳은 도커로 삭제 완료.
    thinkcat-eln backend `app/api/services`·`app/routers`는 root 소유 `__pycache__` 때문에 사용자가 `sudo rm -rf`로 정리 완료

- **통합 로그인(SSO) — Backend Phase 1 완료·실증** (자바팀 AuthServer JWT 방식, 문서 `_docs/jwt-subdomain-integration.md`):
  - **방식**: `auth.thinkcat.kr`가 발급한 access_token(JWT)을 `.thinkcat.kr` 쿠키로 공유 → eln은 HS256 시크릿으로 검증만(회원관리·발급·갱신·로그아웃은 AuthServer 전담)
  - **모델/DB 변경**: `USER_INFO_TB`에서 인증 컬럼(certification, email/phone_verification_*) 제거, `password` NULL 허용(통합 사용자는 비번 없음).
    개발 DB ALTER 완료(백업 `USER_INFO_TB_bak_20260615`). 운영 davinci DB도 동일 ALTER 필요
  - **코드**: `models/user.py`·`schemas/user.py`·`crud/user.py`(JIT `get_or_create_user_by_email` 추가)·`user_router.py`(verify/resend/echo 제거, register 간소화, login은 password 보유자만) 정리.
    `utils/security.py`: `_verify_authserver_token`(HS256·iss·aud·exp·tokenType=ACCESS 검증) 추가, `get_jwt_identity`·`get_current_user_from_request`를 **쿠키(AuthServer) 우선 + 헤더(자체) 폴백**으로 교체.
    `config.py`에 `AUTH_JWT_*` 설정, `.env`에 `AUTH_JWT_SECRET`(자바팀 시크릿, gitignore)
  - **인증 동작**: 운영=통합 쿠키, 개발=자체 헤더 토큰 — 코드 한 벌로 둘 다 동작 (개발은 `.thinkcat.kr` 도메인 아니라 통합 쿠키 못 받음)
  - **JIT 정책**: 유효 토큰(서명검증 통과=AuthServer 로그인 필수)만 생성, email로 매핑(기존 계정 연결), 없으면 생성(role="user" 고정=권한상승 차단, 비번 null). 비회원 임의생성 불가
  - **✅ 실증(2026-06-15)**: 실제 포털 로그인 토큰(yckim@anyfive.com)으로 검증 통과 — 시크릿 진짜(문서 예시값=실제값), 보호라우트 200, 기존 eln user(id=5) 정확히 매핑. 위조서명·REFRESH토큰 차단 확인
- **통합 로그인(SSO) — Frontend Phase 2 완료** (코드 작업, 운영 배포 시 실검증):
  - **핵심 설계**: `useSession`이 17곳에 퍼져 있어 전부 교체 대신, **통합 쿠키를 NextAuth 세션으로 연결**하는 방식 채택 → 기존 코드 무수정
  - backend `GET /api/user/me` 추가 (쿠키 우선+헤더 폴백으로 현재 사용자 반환, 통합 쿠키는 HttpOnly라 프론트가 직접 못 읽음)
  - `lib/auth.ts` authorize에 **`__sso__` 경로** 추가: username=`__sso__`면 비번 대신 브라우저 쿠키를 backend `/api/user/me`로 전달해 검증
  - `Providers`에 **SsoBootstrap**: NextAuth 미인증 상태에서 `/api/user/me` 확인 → 통합 쿠키 있으면 `signIn('credentials',{username:'__sso__'})` 자동 호출 → NextAuth 세션 생성 (→ patents에서도 로그인 상태)
  - `middleware.ts`: 보호경로 비로그인 시 통합쿠키(`access_token`) 있으면 통과, 없으면 `NEXT_PUBLIC_AUTH_LOGIN_URL` 있으면(운영) AuthServer로 `redirect`, 없으면(개발) 자체 signin
  - **`/ko/ko/prior-art` 이중 locale 404 수정**: middleware callbackUrl을 `pathWithoutLocale` 기준으로, signin 페이지 인증 후 리다이렉트를 `router.push`(locale 자동붙음)→`window.location.href`(raw)로 변경
  - 검증: tsc 통과, `/api/user/me` 비로그인 401(SsoBootstrap 조용히 통과), 라우트 등록 확인
  - **운영 `.env` 추가 필요**: `NEXT_PUBLIC_AUTH_LOGIN_URL`(AuthServer 로그인 URL, redirect 파라미터 지원). 개발은 비워둠(자체 signin)
  - **남은 것**: 운영 배포(backend+DB ALTER+frontend 재빌드) 후 실제 `.thinkcat.kr` 쿠키 공유 동작 확인. 통합 로그아웃(AuthServer logout 연동)은 추후

---

## 미결 항목

### 🔴 우선
1. ~~Milvus davinci 이전~~ ✅ 2026-06-15 완료 (위 "알려진 이슈" 참고). 후속: gpu_backend 재생성/L40S 재배포/tar 정리
2. ~~선행기술조사 기능 이식~~ ✅ 2026-06-15 코드 포팅 완료(위 완료작업 참고). **남은 것: 런타임 테스트**
   - 개발환경(backend run.sh + frontend run.sh + gpu 도커) 기동 → INVAL_* 테이블 생성(`python -m app.init_db`) →
     `/prior-art`에서 아이디어 입력 → 선행특허 검색 → LLM 분석 → 보고서 생성까지 실제 동작 확인
   - gpu_backend 표준화(api/services → services)는 이 테스트 후 별도 진행 (사용자 합의)
3. **운영 특허검색 네트워크 문제** (위 "알려진 이슈" 참고)
4. **통합 계정(SSO) 연동** — 로그인/회원가입을 thinkcat.kr 포털(자바팀)과 통합
   - 1단계 완료(2026-06-12): 헤더 버튼·signup 페이지를 포털로 보냄 (미배포, frontend 재빌드 필요)
   - 2단계(방향 합의됨): **authorization code 핸드오프** — 포털 로그인 후 일회용 코드로 복귀 →
     eln 백엔드가 서버 간 검증 → NextAuth 세션 발급. 자바팀에 코드 발급 + 검증 API 2개 요청 필요
   - 결정 대기: 기존 회원 이메일 매칭 연결(JIT 프로비저닝), role 관리 주체, 통합 로그아웃

### 🟡 운영/관리
- SSL 만료(2027-06) 수동 갱신 일정 관리
- 로그인 실패 시 안내 없이 리다이렉트되는 UX 개선 (에러 메시지 표시)
- Nominatim(위치→주소 변환) 트래픽 증가 시 카카오/네이버 API 전환 검토
