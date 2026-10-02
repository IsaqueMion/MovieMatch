import { translate as t, useLocale } from '../../hooks/useLocale'
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
  useLocale()
  const previewProps = interactive ? {} : { tabIndex: -1, 'aria-hidden': true as const }
  const items: DockItemData[] = [
    { id: 'dislike', icon: <XIcon />, label: t("Passo"), shortcut: '←', onClick: onDislike, disabled: interactive && dislikeDisabled },
    { id: 'undo', icon: <Undo2 />, label: t("Desfazer"), shortcut: '⌫', onClick: onUndo, disabled: interactive && undoDisabled },
    { id: 'like', icon: <><Heart className="empty" /><Heart className="filled" /></>, label: t("Quero assistir"), shortcut: '→', onClick: onLike, disabled: interactive && likeDisabled },
  ]
  const renderItem = (item: DockItemData) => <button type="button" className={`cinema-vote-button is-${item.id}`} onClick={item.onClick} disabled={item.disabled} aria-label={item.id === 'like' ? t("Quero assistir") : item.id === 'dislike' ? t("Passo") : t("Desfazer")} title={item.id === 'like' ? t("Quero assistir") : item.id === 'dislike' ? t("Não quero assistir") : t("Desfazer último voto")} {...previewProps}><span className="cinema-vote-icon" aria-hidden="true">{item.icon}</span></button>
  return (
    <div className={`cinema-vote-actions ${interactive ? '' : 'is-preview'}`}>
      {interactive ? <Dock label={t('Seu voto')} items={items} panelHeight={68} baseItemSize={50} magnification={70} distance={145} renderItem={renderItem} /> : items.map(item => <div key={item.id}>{renderItem(item)}</div>)}
    </div>
  )
}
