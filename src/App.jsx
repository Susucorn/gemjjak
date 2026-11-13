import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import {
  GuestOnly,
  RequireAuth,
  RequireNotOnboarded,
  RequireOnboarded,
} from './components/routing/guards'
import { AuthProvider } from './contexts/AuthProvider'
import { Chat } from './pages/Chat'
import { Community } from './pages/Community'
import { Explore } from './pages/Explore'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Profile } from './pages/Profile'
import { PreferenceEdit } from './pages/profile/PreferenceEdit'
import { ProfileInfoEdit } from './pages/profile/ProfileInfoEdit'
import { ServerForm } from './pages/profile/ServerForm'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<RequireNotOnboarded />}>
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            <Route element={<RequireOnboarded />}>
              <Route element={<AppLayout />}>
                <Route index element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/chat/:roomId" element={<Chat />} />
                <Route path="/community" element={<Community />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* 프로필 수정 화면은 탭바 없이 전체 화면으로 띄운다. */}
              <Route path="/profile/edit/info" element={<ProfileInfoEdit />} />
              <Route path="/profile/edit/:section" element={<PreferenceEdit />} />
              <Route path="/profile/servers/new" element={<ServerForm />} />
              <Route path="/profile/servers/:serverId" element={<ServerForm />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
