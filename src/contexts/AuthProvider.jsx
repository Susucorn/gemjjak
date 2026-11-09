import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchProfile } from '../services/profileService'
import { AuthContext } from './authContext'

// npm run dev:noauth 전용. import.meta.env.DEV 조건 때문에 배포 빌드에서는 항상 false다.
const DEV_SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === 'true'

const DEV_AUTH_VALUE = {
  user: { id: 'dev-user' },
  profile: { id: 'dev-user', nickname: '개발자', onboarded: true },
  profileError: null,
  isSessionLoading: false,
  isProfileLoading: false,
  refreshProfile: async () => {},
}

async function readProfile(userId) {
  try {
    return { userId, profile: await fetchProfile(userId), error: null }
  } catch (error) {
    return { userId, profile: null, error }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(supabase) && !DEV_SKIP_AUTH)
  const [profileResult, setProfileResult] = useState({ userId: null, profile: null, error: null })

  const user = session?.user ?? null
  const userId = user?.id ?? null

  useEffect(() => {
    if (!supabase || DEV_SKIP_AUTH) return undefined

    // 구독 직후 INITIAL_SESSION 이벤트가 오므로 getSession을 따로 부르지 않는다.
    // 이 콜백 안에서 supabase를 await하면 교착될 수 있어 프로필 조회는 아래 effect로 분리했다.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsSessionLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return undefined

    let isStale = false
    readProfile(userId).then((result) => {
      if (!isStale) setProfileResult(result)
    })

    return () => {
      isStale = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (userId) setProfileResult(await readProfile(userId))
  }, [userId])

  const value = useMemo(() => {
    if (DEV_SKIP_AUTH) return DEV_AUTH_VALUE

    const isCurrentProfile = profileResult.userId === userId
    return {
      user,
      profile: isCurrentProfile ? profileResult.profile : null,
      profileError: isCurrentProfile ? profileResult.error : null,
      isSessionLoading,
      isProfileLoading: Boolean(userId) && !isCurrentProfile,
      refreshProfile,
    }
  }, [user, userId, profileResult, isSessionLoading, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
