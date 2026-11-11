import { GameStep } from './GameStep'
import { TagStep } from './TagStep'
import { TimeStep } from './TimeStep'
import { toggleInSet } from './preferenceRules'

/**
 * 취향 입력 한 단계를 그린다. 온보딩과 프로필 수정이 함께 쓴다.
 * step: 0 게임, 1 장르·스타일, 2 접속 시간
 * onChange는 setState처럼 (prev) => next 함수를 받는다.
 */
export function PreferenceStep({ step, options, prefs, onChange }) {
  const update = (key, fn) => onChange((prev) => ({ ...prev, [key]: fn(prev[key]) }))

  if (step === 0) {
    return (
      <GameStep
        games={options.games}
        genreNameById={new Map(options.genres.map((genre) => [genre.id, genre.name]))}
        selectedIds={prefs.gameIds}
        requestedGames={prefs.requestedGames}
        onToggle={(id) => update('gameIds', (ids) => toggleInSet(ids, id))}
        onRequest={(name) => update('requestedGames', (names) => [...names, name])}
        onRemoveRequest={(name) =>
          update('requestedGames', (names) => names.filter((item) => item !== name))
        }
      />
    )
  }

  if (step === 1) {
    return (
      <TagStep
        genres={options.genres}
        selectedGenreIds={prefs.genreIds}
        onToggleGenre={(id) => update('genreIds', (ids) => toggleInSet(ids, id))}
        vocabulary={options.vocabulary}
        selectedGameIds={prefs.gameIds}
        selectedTags={prefs.tags}
        onToggleTag={(tag) => update('tags', (tags) => toggleInSet(tags, tag))}
      />
    )
  }

  return (
    <TimeStep
      hours={prefs.hours}
      onToggleHour={(dayType, hour) =>
        update('hours', (hours) => ({ ...hours, [dayType]: toggleInSet(hours[dayType], hour) }))
      }
      onSetHours={(dayType, next) => update('hours', (hours) => ({ ...hours, [dayType]: next }))}
    />
  )
}
