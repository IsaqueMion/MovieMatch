import { Languages } from 'lucide-react'
import { useLocale } from '../../hooks/useLocale'
import type { Language } from '../../lib/locale'

export default function LanguageSelect() {
  const { language, setLanguage, t } = useLocale()
  return <label className="language-select"><Languages size={16} aria-hidden="true" /><span className="sr-only">{t('Idioma da interface')}</span><select aria-label={t('Idioma da interface')} value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
}
