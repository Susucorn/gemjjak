import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { FullScreenStatus } from './FullScreenStatus'

function Loading() {
  return <FullScreenStatus>불러오는 중이에요</FullScreenStatus>
}

/** 로그인한 사용자만 통과한다. */
export function RequireAuth() {
  const { user, isSessionLoading } = useAuth()
  const location = useLocation()

  if (isSessionLoading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** 프로필을 읽기 전에는 판단하지 않는다. 조회 실패를 온보딩 미완료로 취급하지 않기 위해서다. */
function ProfileGate({ children }) {
  const { profileError, isProfileLoading, refreshProfile } = useAuth()

  if (isProfileLoading) return <Loading />
  if (profileError) {
    return (
      <FullScreenStatus>
        프로필을 불러오지 못했어요
        <Button onClick={refreshProfile}>다시 시도</Button>
      </FullScreenStatus>
    )
  }
  return children
}

/** RequireAuth 안에서 쓴다. 온보딩을 마친 사용자만 통과한다. */
export function RequireOnboarded() {
  const { profile } = useAuth()

  return (
    <ProfileGate>
      {profile?.onboarded ? <Outlet /> : <Navigate to="/onboarding" replace />}
    </ProfileGate>
  )
}

/** RequireAuth 안에서 쓴다. 온보딩을 마친 사용자가 /onboarding에 다시 오면 홈으로 보낸다. */
export function RequireNotOnboarded() {
  const { profile } = useAuth()

  return <ProfileGate>{profile?.onboarded ? <Navigate to="/" replace /> : <Outlet />}</ProfileGate>
}

/** 이미 로그인했다면 /login을 건너뛴다. */
export function GuestOnly() {
  const { user, isSessionLoading } = useAuth()

  if (isSessionLoading) return <Loading />
  return user ? <Navigate to="/" replace /> : <Outlet />
}
