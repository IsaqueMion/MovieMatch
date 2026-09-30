import { Heart, Undo2, X as XIcon } from 'lucide-react'
import Dock, { type DockItemData } from '../ui/Dock'

type SwipeActionButtonsProps = {
  onDislike?: () => void
  onUndo?: () => void
  onLike?: () => void
  dislikeDisabled?: boolean
  undoDisabled?: boolean
  likeDisabled?: boolean
  interactive?: boolean
}

export default function SwipeActionButtons({
  onDislike, onUndo, onLike, dislikeDisabled = false, undoDisabled = false,
  likeDisabled = false, interactive = true,
}: SwipeActionButtonsProps) {
  const previewProps = interactive ? {} : { tabIndex: -1, 'aria-hidden': true as const }
  const items: DockItemData[] = [
    { id: 'dislike', icon: <XIcon />, label: 'Passo', onClick: onDislike, disabled: interactive && dislikeDisabled },
    { id: 'undo', icon: <Undo2 />, label: 'Desfazer', onClick: onUndo, disabled: interactive && undoDisabled },
    { id: 'like', icon: <><Heart className="empty" /><Heart className="filled" /></>, label: 'Quero ver', onClick: onLike, disabled: interactive && likeDisabled },
  ]
  const renderItem = (item: DockItemData) => <button type="button" className={`cinema-vote-button is-${item.id}`} onClick={item.onClick} disabled={item.disabled} aria-label={item.id === 'like' ? 'Like' : item.id === 'dislike' ? 'Dislike' : 'Desfazer'} title={item.id === 'like' ? 'Quero assistir' : item.id === 'dislike' ? 'Não quero assistir' : 'Desfazer último voto'} {...previewProps}><span className="cinema-vote-icon" aria-hidden="true">{item.icon}</span></button>
  return (
    <div className={`cinema-vote-actions ${interactive ? '' : 'is-preview'}`}>
      {interactive ? <Dock items={items} panelHeight={68} baseItemSize={50} magnification={70} distance={145} renderItem={renderItem} /> : items.map(item => <div key={item.id}>{renderItem(item)}</div>)}
    </div>
  )
}
