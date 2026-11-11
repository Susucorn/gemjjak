import { Link } from 'react-router-dom'
import { BackIcon } from '../../components/ui/BackIcon'
import { Button } from '../../components/ui/Button'
import styles from '../onboarding/Onboarding.module.css'

/**
 * 프로필에서 들어가는 수정 화면의 공통 틀. 온보딩과 같은 모양에 하단 저장 버튼이 붙는다.
 * submitLabel을 비우면 저장 버튼을 그리지 않는다.
 */
export function EditScreen({
  title,
  description,
  children,
  error,
  requirement,
  submitLabel = '저장하기',
  isSaving = false,
  onSubmit,
  extraAction,
}) {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <Link to="/profile" className={styles.backButton} aria-label="프로필로 돌아가기">
            <BackIcon />
          </Link>
        </header>

        <section className={`${styles.intro} ${styles.introCompact}`}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </section>

        <div className={styles.body}>{children}</div>

        {onSubmit && (
          <footer className={styles.footer}>
            {error && (
              <p className={styles.alert} role="alert">
                {error}
              </p>
            )}
            {requirement && <p className={styles.requirement}>{requirement}</p>}
            <Button
              className={styles.nextButton}
              onClick={onSubmit}
              disabled={Boolean(requirement) || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? '저장 중…' : submitLabel}
            </Button>
            {extraAction}
          </footer>
        )}
      </div>
    </main>
  )
}
