import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { loadExploreState, saveExploreState } from '../../lib/exploreFilters'
import styles from '../Explore.module.css'

/**
 * 결과를 한 페이지에 데스크톱 6명(3×2), 모바일 4명(2×2)씩 묶어 넘긴다.
 * 데스크톱은 옆으로, 모바일은 아래로 한 페이지씩 넘어간다. 버튼으로도 넘긴다.
 * 한 페이지에 다 들어가면 그냥 보여 준다.
 * 보던 페이지는 저장해 두고, 프로필을 보고 돌아오면 그 페이지에서 다시 시작한다.
 */
export function ResultPages({ searchAt, results, renderCard }) {
  const isWide = useMediaQuery('(min-width: 768px)')
  const perPage = isWide ? 6 : 4
  const pages = []
  for (let i = 0; i < results.length; i += perPage) pages.push(results.slice(i, i + perPage))

  const trackRef = useRef(null)
  const [page, setPage] = useState(() => {
    const saved = loadExploreState()
    return saved?.pageOf === searchAt ? Math.min(saved.page ?? 0, pages.length - 1) : 0
  })
  const current = Math.min(page, pages.length - 1)

  // 모바일은 세로로 넘기므로 한 페이지 높이를 재서 상자 높이로 쓴다(가장 큰 페이지 기준).
  const [pageHeight, setPageHeight] = useState(null)
  useLayoutEffect(() => {
    const track = trackRef.current
    if (isWide || !track) return
    function measure() {
      const lists = [...track.children]
      for (const list of lists) list.style.height = 'auto'
      setPageHeight(Math.max(...lists.map((list) => list.offsetHeight)))
      for (const list of lists) list.style.height = ''
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isWide, results])

  // 저장해 둔 페이지로 바로 옮긴다. 화면 크기가 바뀌어 페이지 수가 달라져도 맞춘다.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    if (isWide) track.scrollLeft = current * track.clientWidth
    else track.scrollTop = current * track.clientHeight
    // 처음 그릴 때, 한 페이지 인원이나 높이가 바뀔 때만 옮긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perPage, pageHeight])

  useEffect(() => saveExploreState({ page: current, pageOf: searchAt }), [current, searchAt])

  function handleScroll(event) {
    const track = event.currentTarget
    setPage(
      isWide
        ? Math.round(track.scrollLeft / track.clientWidth)
        : Math.round(track.scrollTop / track.clientHeight),
    )
  }

  function goTo(index) {
    const track = trackRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduceMotion ? 'auto' : 'smooth'
    if (isWide) track.scrollTo({ left: index * track.clientWidth, behavior })
    else track.scrollTo({ top: index * track.clientHeight, behavior })
  }

  if (pages.length <= 1) {
    return (
      <ul className={styles.grid}>
        {results.map((item) => (
          <li key={item.player.id}>{renderCard(item)}</li>
        ))}
      </ul>
    )
  }

  return (
    <div className={styles.pager}>
      <div className={styles.pagerBar}>
        <p className={styles.pagerCount} aria-live="polite">
          {!isWide && <span className={styles.pagerHint}>아래로 넘겨 보세요 · </span>}
          {current + 1} / {pages.length}
        </p>
        <div className={styles.pagerButtons}>
          <button
            type="button"
            className={`${styles.pagerButton} ${isWide ? '' : styles.pagerButtonVertical}`}
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="이전 게이머"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.pagerButton} ${isWide ? '' : styles.pagerButtonVertical}`}
            onClick={() => goTo(current + 1)}
            disabled={current === pages.length - 1}
            aria-label="다음 게이머"
          >
            ›
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className={isWide ? styles.pageTrack : styles.pageTrackVertical}
        style={!isWide && pageHeight ? { height: pageHeight } : undefined}
        onScroll={handleScroll}
      >
        {pages.map((items, index) => (
          <ul
            key={index}
            className={`${styles.grid} ${styles.resultPage}`}
            style={!isWide && pageHeight ? { height: pageHeight } : undefined}
            aria-label={`${index + 1}페이지`}
          >
            {items.map((item) => (
              <li key={item.player.id}>{renderCard(item)}</li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
