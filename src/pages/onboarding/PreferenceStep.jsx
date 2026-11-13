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
        customGames={prefs.customGames}
        onToggle={(id) => update('gameIds', (ids) => toggleInSet(ids, id))}
        onAddCustom={(name) => update('customGames', (names) => [...names, name])}
        onRemoveCustom={(name) =>
          update('customGames', (names) => names.filter((item) => item !== name))
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
        customGenres={prefs.customGenres}
        onAddCustomGenre={(name) => update('customGenres', (names) => [...names, name])}
        onRemoveCustomGenre={(name) =>
          update('customGenres', (names) => names.filter((item) => item !== name))
        }
        vocabulary={options.vocabulary}
        selectedGameIds={prefs.gameIds}
        selectedTags={prefs.tags}
        onToggleTag={(tag) => update('tags', (tags) => toggleInSet(tags, tag))}
        customTags={prefs.customTags}
        onAddCustomTag={(category, name) =>
          update('customTags', (all) => ({ ...all, [category]: [...all[category], name] }))
        }
        onRemoveCustomTag={(category, name) =>
          update('customTags', (all) => ({
            ...all,
            [category]: all[category].filter((item) => item !== name),
          }))
        }
      />
    )
  }

  return (
    <TimeStep
      hours={prefs.hours}
      onChangeDays={(days, change) =>
        update('hours', (hours) => ({
          ...hours,
          ...Object.fromEntries(days.map((day) => [day, change(new Set(hours[day]))])),
        }))
      }
    />
  )
}
