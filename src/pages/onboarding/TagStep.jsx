import { Chip } from '../../components/ui/Chip'
import styles from './Onboarding.module.css'

/** items: [{ key, label, selected, onToggle }] */
function ChipGroup({ title, hint, description, items }) {
  if (items.length === 0) return null

  return (
    <section className={styles.tagGroup}>
      <h2 className={styles.groupTitle}>
        {title}
        {hint && <span className={styles.groupHint}>{hint}</span>}
      </h2>
      {description && <p className={styles.groupDescription}>{description}</p>}
      <div className={styles.chips}>
        {items.map((item) => (
          <Chip key={item.key} selected={item.selected} onClick={item.onToggle}>
            {item.selected && <span aria-hidden="true">✓ </span>}
            {item.label}
          </Chip>
        ))}
      </div>
    </section>
  )
}

/** 같은 이름의 태그가 여러 게임에 있을 수 있어(예: 랭크) 이름 기준으로 한 번만 보여 준다. */
function uniqueTags(vocabulary, predicate) {
  return [...new Set(vocabulary.filter(predicate).map((item) => item.tag))]
}

export function TagStep({
  genres,
  selectedGenreIds,
  onToggleGenre,
  vocabulary,
  selectedGameIds,
  selectedTags,
  onToggleTag,
}) {
  const tagItems = (tags) =>
    tags.map((tag) => ({
      key: tag,
      label: tag,
      selected: selectedTags.has(tag),
      onToggle: () => onToggleTag(tag),
    }))

  return (
    <div className={styles.tagGroups}>
      <ChipGroup
        title="좋아하는 장르"
        hint="필수"
        description="같은 게임을 하지 않아도 장르가 맞으면 추천해 드려요."
        items={genres.map((genre) => ({
          key: genre.id,
          label: genre.name,
          selected: selectedGenreIds.has(genre.id),
          onToggle: () => onToggleGenre(genre.id),
        }))}
      />
      <ChipGroup
        title="플레이 스타일"
        hint="필수"
        items={tagItems(uniqueTags(vocabulary, (item) => item.category === 'style'))}
      />
      <ChipGroup
        title="주로 하는 콘텐츠"
        hint="선택"
        items={tagItems(
          uniqueTags(
            vocabulary,
            (item) => item.category === 'activity' && selectedGameIds.has(item.game_id),
          ),
        )}
      />
      <ChipGroup
        title="이런 사람을 찾아요"
        hint="선택"
        items={tagItems(uniqueTags(vocabulary, (item) => item.category === 'want'))}
      />
    </div>
  )
}
