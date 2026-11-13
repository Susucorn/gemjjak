import { useState } from 'react'
import { AddDialog } from '../../components/ui/AddDialog'
import { Chip } from '../../components/ui/Chip'
import { normalize } from './gameSearch'
import { MAX_CUSTOM_GENRES, MAX_CUSTOM_TAGS, MAX_LABEL_LENGTH } from './preferenceRules'
import styles from './Onboarding.module.css'

/**
 * items: [{ key, label, selected, onToggle }]
 * onOpenAdd를 넘기면 칩 끝에 [+ 추가] 칩을 붙인다. canAdd가 false면 한도에 다다른 것이다.
 */
function ChipGroup({ title, hint, description, items, onOpenAdd, canAdd, limitText }) {
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
        {onOpenAdd && canAdd && (
          <button
            type="button"
            className={styles.addChip}
            onClick={onOpenAdd}
            aria-label={`${title} 직접 추가`}
          >
            + 추가
          </button>
        )}
      </div>
      {onOpenAdd && !canAdd && <p className={styles.groupDescription}>{limitText}</p>}
    </section>
  )
}

/** 같은 이름의 태그가 여러 게임에 있을 수 있어(예: 랭크) 이름 기준으로 한 번만 보여 준다. */
function uniqueTags(vocabulary, predicate) {
  return [...new Set(vocabulary.filter(predicate).map((item) => item.tag))]
}

const TAG_GROUPS = [
  {
    category: 'style',
    title: '플레이 스타일',
    hint: '필수',
    placeholder: '예: 공략러, 소통 위주',
  },
  {
    category: 'activity',
    title: '주로 하는 콘텐츠',
    hint: '선택',
    placeholder: '예: 레이드, 길드전',
  },
  {
    category: 'want',
    title: '이런 사람을 찾아요',
    hint: '선택',
    placeholder: '예: 같이 공부하며 성장할 사람',
  },
]

export function TagStep({
  genres,
  selectedGenreIds,
  onToggleGenre,
  customGenres,
  onAddCustomGenre,
  onRemoveCustomGenre,
  vocabulary,
  selectedGameIds,
  selectedTags,
  onToggleTag,
  customTags,
  onAddCustomTag,
  onRemoveCustomTag,
}) {
  // 지금 열려 있는 입력 창: 'genre' | 'style' | 'activity' | 'want' | null
  const [adding, setAdding] = useState(null)

  // 콘텐츠 태그는 고른 게임의 것만 보여 준다.
  const optionsOf = (category) =>
    uniqueTags(
      vocabulary,
      (item) =>
        item.category === category &&
        (category !== 'activity' || selectedGameIds.has(item.game_id)),
    )

  // 입력한 장르가 기존 장르와 같으면 그 장르를 고른다.
  function addGenre(name) {
    const existing = genres.find((genre) => normalize(genre.name) === normalize(name))
    if (existing) {
      if (!selectedGenreIds.has(existing.id)) onToggleGenre(existing.id)
    } else if (!customGenres.some((item) => normalize(item) === normalize(name))) {
      onAddCustomGenre(name)
    }
  }

  // 입력한 태그가 같은 분류의 기존 태그와 같으면 그 태그를 고른다.
  function addTag(category, name) {
    const existing = optionsOf(category).find((tag) => normalize(tag) === normalize(name))
    if (existing) {
      if (!selectedTags.has(existing)) onToggleTag(existing)
    } else if (!customTags[category].some((item) => normalize(item) === normalize(name))) {
      onAddCustomTag(category, name)
    }
  }

  const openGroup = TAG_GROUPS.find((group) => group.category === adding)

  return (
    <div className={styles.tagGroups}>
      <ChipGroup
        title="좋아하는 장르"
        hint="필수"
        description="같은 게임을 하지 않아도 장르가 맞으면 추천해 드려요."
        items={[
          ...genres.map((genre) => ({
            key: `id-${genre.id}`,
            label: genre.name,
            selected: selectedGenreIds.has(genre.id),
            onToggle: () => onToggleGenre(genre.id),
          })),
          ...customGenres.map((name) => ({
            key: `custom-${name}`,
            label: name,
            selected: true,
            onToggle: () => onRemoveCustomGenre(name),
          })),
        ]}
        onOpenAdd={() => setAdding('genre')}
        canAdd={customGenres.length < MAX_CUSTOM_GENRES}
        limitText={`장르는 ${MAX_CUSTOM_GENRES}개까지 직접 추가할 수 있어요.`}
      />

      {TAG_GROUPS.map((group) => (
        <ChipGroup
          key={group.category}
          title={group.title}
          hint={group.hint}
          items={[
            ...optionsOf(group.category).map((tag) => ({
              key: `tag-${tag}`,
              label: tag,
              selected: selectedTags.has(tag),
              onToggle: () => onToggleTag(tag),
            })),
            ...customTags[group.category].map((name) => ({
              key: `custom-${name}`,
              label: name,
              selected: true,
              onToggle: () => onRemoveCustomTag(group.category, name),
            })),
          ]}
          onOpenAdd={() => setAdding(group.category)}
          canAdd={customTags[group.category].length < MAX_CUSTOM_TAGS}
          limitText={`${MAX_CUSTOM_TAGS}개까지 직접 추가할 수 있어요.`}
        />
      ))}

      {adding === 'genre' && (
        <AddDialog
          title="좋아하는 장르 추가"
          description="목록에 없는 장르를 입력해 주세요."
          placeholder="예: 레이싱, 리듬게임"
          maxLength={MAX_LABEL_LENGTH}
          onSave={addGenre}
          onClose={() => setAdding(null)}
        />
      )}
      {openGroup && (
        <AddDialog
          title={`${openGroup.title} 추가`}
          description="목록에 없는 내용을 입력해 주세요."
          placeholder={openGroup.placeholder}
          maxLength={MAX_LABEL_LENGTH}
          onSave={(name) => addTag(openGroup.category, name)}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}
