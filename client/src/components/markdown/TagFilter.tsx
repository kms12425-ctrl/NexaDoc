export default function TagFilter({ items, selected, onSelect }: { items: Array<{ tag: string; count: number }>; selected: string; onSelect: (tag: string) => void }) {
  if (!items.length) return null
  return <div className="markdown-tag-filter" role="group" aria-label="Filter by tag">
    <button type="button" className={!selected ? 'active' : ''} onClick={() => onSelect('')}>All</button>
    {items.map(({ tag, count }) => <button key={tag} type="button" className={selected === tag ? 'active' : ''} onClick={() => onSelect(selected === tag ? '' : tag)}>{tag} <span>{count}</span></button>)}
  </div>
}
