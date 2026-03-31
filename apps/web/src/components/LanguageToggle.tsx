import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

function FlagUS(props: Readonly<React.SVGProps<SVGSVGElement>>) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden focusable="false" {...props}>
      <rect width="64" height="48" fill="#b22234" />
      <rect y="4" width="64" height="4" fill="#fff" />
      <rect y="12" width="64" height="4" fill="#fff" />
      <rect y="20" width="64" height="4" fill="#fff" />
      <rect y="28" width="64" height="4" fill="#fff" />
      <rect y="36" width="64" height="4" fill="#fff" />
      <rect y="44" width="64" height="4" fill="#fff" />
      <rect width="28" height="20" fill="#3c3b6e" />
    </svg>
  );
}

function FlagES(props: Readonly<React.SVGProps<SVGSVGElement>>) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden focusable="false" {...props}>
      <rect width="64" height="48" fill="#aa151b" />
      <rect y="12" width="64" height="24" fill="#f1bf00" />
    </svg>
  );
}

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
      {isEs ? (
        <FlagUS className="h-4 w-4 shrink-0 rounded-[3px]" />
      ) : (
        <FlagES className="h-4 w-4 shrink-0 rounded-[3px]" />
      )}
      <span aria-hidden className="text-xs font-medium leading-none">
        {nextLabel}
      </span>
    </Button>
  );
}
