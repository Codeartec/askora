import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

const FLAG_EN = '/flags/english_flag.svg';
const FLAG_ES = '/flags/spanish_flag.svg';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.language?.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(next);
  };
  const isEs = i18n.language?.startsWith('es');
  const nextLabel = isEs ? 'EN' : 'ES';
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5"
      aria-label={isEs ? 'Cambiar idioma a inglés' : 'Switch language to Spanish'}
      title={nextLabel}
    >
      <img
        src={isEs ? FLAG_EN : FLAG_ES}
        alt=""
        width={16}
        height={16}
        decoding="async"
        className="h-4 w-4 shrink-0 rounded-[3px] object-cover ring-1 ring-border/40"
      />
      <span aria-hidden className="text-xs font-medium leading-none">
        {nextLabel}
      </span>
    </Button>
  );
}
