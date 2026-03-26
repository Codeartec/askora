import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.language?.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(next);
  };
  const isEs = i18n.language?.startsWith('es');
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5"
      aria-label={isEs ? 'Cambiar idioma a inglés' : 'Switch language to Spanish'}
      title={isEs ? 'EN' : 'ES'}
    >
      <span aria-hidden className="text-base leading-none">
        {isEs ? '🇺🇸' : '🇪🇸'}
      </span>
    </Button>
  );
}
