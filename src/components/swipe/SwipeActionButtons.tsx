import { Heart, Undo2, X as XIcon } from 'lucide-react'

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
  return (
    <div className={`cinema-vote-actions ${interactive ? '' : 'is-preview'}`}>
      <button type="button" className="cinema-vote-button is-dislike" onClick={onDislike}
        disabled={interactive && dislikeDisabled} aria-label="Dislike" title="Não quero assistir" {...previewProps}>
        <span className="cinema-vote-icon" aria-hidden="true"><XIcon /></span>
      </button>
      <button type="button" className="cinema-vote-button is-undo" onClick={onUndo}
        disabled={interactive && undoDisabled} aria-label="Desfazer" title="Desfazer último voto" {...previewProps}>
        <span className="cinema-vote-icon" aria-hidden="true"><Undo2 /></span>
      </button>
      <button type="button" className="cinema-vote-button is-like" onClick={onLike}
        disabled={interactive && likeDisabled} aria-label="Like" title="Quero assistir" {...previewProps}>
        <span className="cinema-vote-icon" aria-hidden="true"><Heart className="empty" /><Heart className="filled" /></span>
      </button>
    </div>
  )
}
