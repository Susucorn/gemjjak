# 겜짝 (GemJjak)

게임 취향, 접속 시간대, 소개글을 바탕으로 궁합이 높은 게이머와 디스코드 커뮤니티를 추천하는 웹앱입니다.

- 프론트엔드: React, Vite, React Router, CSS Modules
- 백엔드: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- AI: Claude API (Edge Function에서만 호출)
- 배포: Vercel, Supabase Cloud

## 1. 로컬 실행

Node.js 22 이상이 필요합니다. 전역 설치는 필요 없고, Supabase CLI는 `npx supabase`로 씁니다.

```powershell
npm install
copy .env.example .env   # 값은 2-3단계에서 채웁니다
npm run dev
```

http://localhost:5173 을 엽니다.

Supabase를 연결하기 전에 화면만 보려면 로그인 검사를 건너뛰는 모드를 씁니다. 이 모드는 개발 서버에서만 동작하고 배포 빌드에는 적용되지 않습니다.

```powershell
npm run dev:noauth
```

| 명령어               | 설명                  |
| -------------------- | --------------------- |
| `npm run dev`        | 개발 서버             |
| `npm run dev:noauth` | 로그인 없이 화면 확인 |
| `npm run build`      | 배포 빌드             |
| `npm run lint`       | ESLint 검사           |
| `npm run format`     | Prettier 정리         |

## 2. Supabase 설정

Docker 없이 클라우드 프로젝트에 바로 연결합니다. 이 프로젝트의 Supabase CLI(3.x)는 `db push`의 기본 대상이 로컬이므로 `--remote`를 꼭 붙입니다.

### 2-1. 프로젝트 만들기

1. https://supabase.com 에서 New project를 만듭니다. 리전은 Northeast Asia (Seoul)을 권장합니다.
2. Database password를 안전한 곳에 저장합니다.
3. Project Settings > General에서 Project ID(ref)를 복사합니다.

### 2-2. JWT Signing Key 확인

Edge Function의 `@supabase/server`는 비대칭 JWT Signing Key만 지원합니다.

1. Project Settings > JWT Keys를 엽니다.
2. 현재 키가 ECC 또는 RSA면 그대로 둡니다.
3. Legacy HS256이면 새 비대칭 키를 만들어 현재 키로 교체합니다.

### 2-3. 환경 변수 채우기

Project Settings > API Keys에서 값을 복사해 `.env`에 넣습니다.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

secret 키나 service_role 키는 `.env`에 넣지 않습니다.

### 2-4. 연결, 마이그레이션, 시드

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote --include-seed
```

`--include-seed`가 `supabase/seed.sql`의 게임과 태그 목록을 넣습니다. 시드는 여러 번 실행해도 중복되지 않습니다.

`servers`는 실제 초대 링크가 필요해 시드에 없습니다. Table Editor에서 직접 추가합니다.

## 3. 디스코드 로그인 연결

1. https://discord.com/developers/applications 에서 New Application을 만듭니다.
2. OAuth2 메뉴에서 Client ID와 Client Secret을 복사합니다.
3. OAuth2 > Redirects에 아래 주소를 추가합니다.
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Supabase 대시보드 Authentication > Sign In / Providers > Discord를 켜고 Client ID와 Client Secret을 넣습니다.
5. Authentication > URL Configuration을 설정합니다.
   - Site URL: 배포 주소 (배포 전에는 `http://localhost:5173`)
   - Redirect URLs: `http://localhost:5173/**`, `https://<배포 주소>/**`

이메일 가입은 같은 Providers 메뉴의 Email에서 관리합니다. 기본 메일 서버는 시간당 발송량이 적으니 테스트 중 메일이 오지 않으면 발송 제한을 먼저 확인합니다.

## 4. Claude API 키 등록

1. https://platform.claude.com 에서 결제 수단을 등록하고 API 키를 발급합니다.
2. 키를 Supabase secrets에 등록합니다.

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=<발급받은 키>
```

키는 Edge Function에서만 읽습니다. `.env`, 코드, Vercel 환경 변수에 넣지 않습니다.

모델은 [supabase/functions/\_shared/claude.ts](supabase/functions/_shared/claude.ts)의 `CLAUDE_MODEL`에서 바꿉니다.

## 5. Edge Function 배포

Docker가 없어도 되도록 서버 측 번들링(`--use-api`)을 씁니다.

```powershell
npx supabase functions deploy --use-api
```

인증은 함수 안의 `withSupabase({ auth: 'user' })`가 처리하므로 `supabase/config.toml`의 `verify_jwt`는 `false`입니다.

`ai-search`는 문장을 탐색 필터로 바꿔 돌려주고, 사람 찾기와 궁합 계산은 브라우저가 합니다. `analyze-bio`는 아직 `501 not_implemented`를 반환하고, DB 함수 `search_players`는 쓰지 않습니다.

| 함수          | 입력                         | 출력                               |
| ------------- | ---------------------------- | ---------------------------------- |
| `analyze-bio` | `{ bio, game_ids }`          | `{ style, activities[], wants[] }` |
| `ai-search`   | `{ question }` + 로그인 토큰 | `{ conditions }` (games, genres, tags, weekdays, hours, summary) |

## 6. Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 올립니다. `.env`는 `.gitignore`에 포함되어 있습니다.
2. https://vercel.com 에서 Add New > Project로 저장소를 가져옵니다. Framework Preset은 Vite입니다.
3. Settings > Environment Variables에 두 값을 넣습니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy를 누릅니다.
5. 배포 주소를 Supabase의 Site URL과 Redirect URLs에 추가합니다 (3단계의 5번).

`vercel.json`은 `/explore` 같은 주소에서 새로고침해도 404가 나지 않게 모든 경로를 `index.html`로 보냅니다.

## 폴더 구조

```
src/
  App.jsx                 라우트 정의
  lib/supabaseClient.js   Supabase 클라이언트
  styles/                 디자인 토큰, 전역 스타일
  contexts/               AuthProvider (세션, 프로필 상태)
  hooks/                  useAuth 등 커스텀 훅
  services/               Supabase 호출 함수
  components/layout/      AppLayout, BottomTabBar, Sidebar
  components/routing/     로그인·온보딩 보호 라우트
  components/ui/          Card, Button, Chip, Avatar
  pages/                  화면
supabase/
  migrations/             SQL 마이그레이션
  seed.sql                게임, 태그 초기 데이터
  functions/              Edge Functions (_shared는 공통 코드)
```

## 디자인 토큰 사용 규칙

`#5865F2`와 `#6B7684`는 흰 배경에서만 대비 4.5:1을 넘습니다. 회색이나 연보라 배경 위 글자에는 `--color-primary-strong`, `--color-text-tertiary-on-gray`를 씁니다. 자세한 내용은 [src/styles/tokens.css](src/styles/tokens.css)에 있습니다.
