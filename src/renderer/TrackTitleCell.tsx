import { resolveTrackTitles, type TrackTitleFields } from '../core/title-display'

/** 列表主标题 + 副标题（CN/JP/EN），末尾艺人单独一列 */
export default function TrackTitleCell({ track }: { track: TrackTitleFields }) {
  const { primary, aliases } = resolveTrackTitles(track)
  return (
    <span className="title title-block">
      <span className="title-main">{primary}</span>
      {aliases.map((a) => (
        <span key={a.lang} className="title-alias">
          <span className="title-alias-tag">{a.tag}</span>
          <span className="title-alias-text">{a.text}</span>
        </span>
      ))}
    </span>
  )
}
