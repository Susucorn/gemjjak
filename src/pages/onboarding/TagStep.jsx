import { Chip } from '../../components/ui/Chip'
import styles from './Onboarding.module.css'

function TagGroup({ title, hint, tags, selectedTags, onToggle }) {
  if (tags.length === 0) return null

  return (
    <section className={styles.tagGroup}>
      <h2 className={styles.groupTitle}>
        {title}
        {hint && <span className={styles.groupHint}>{hint}</span>}
      </h2>
      <div className={styles.chips}>
        {tags.map((tag) => (
          <Chip key={tag} selected={selectedTags.has(tag)} onClick={() => onToggle(tag)}>
            {selectedTags.has(tag) && <span aria-hidden="true">✓ </span>}
            {tag}
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

export function TagStep({ vocabulary, selectedGameIds, selectedTags, onToggle }) {
  const styleTags = uniqueTags(vocabulary, (item) => item.category === 'style')
  const activityTags = uniqueTags(
    vocabulary,
    (item) => item.category === 'activity' && selectedGameIds.has(item.game_id),
  )
  const wantTags = uniqueTags(vocabulary, (item) => item.category === 'want')

  return (
    <div className={styles.tagGroups}>
      <TagGroup
        title="플레이 스타일"
        hint="필수"
        tags={styleTags}
        selectedTags={selectedTags}
        onToggle={onToggle}
      />
      <TagGroup
        title="주로 하는 콘텐츠"
        hint="선택"
        tags={activityTags}
        selectedTags={selectedTags}
        onToggle={onToggle}
      />
      <TagGroup
        title="이런 사람을 찾아요"
        hint="선택"
        tags={wantTags}
        selectedTags={selectedTags}
        onToggle={onToggle}
      />
    </div>
  )
}
