import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageSquare, Zap, Shield, BarChart3 } from 'lucide-react';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="relative isolate space-y-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 bottom-0 inset-x-0 w-full -z-10 overflow-hidden md:-top-8"
      >
        <div className="absolute -top-24 left-[10%] h-[min(55vh,420px)] w-[min(90vw,520px)] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] blur-3xl animate-aurora-a" />
        <div className="absolute top-[20%] -right-[10%] h-[min(45vh,360px)] w-[min(80vw,440px)] rounded-full bg-teal-500/10 blur-3xl animate-aurora-b" />
        <div className="absolute bottom-0 left-[25%] h-[min(40vh,320px)] w-[min(70vw,380px)] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] blur-3xl animate-aurora-c" />
      </div>

      <section className="relative py-14 md:py-20">
        <div className="absolute -top-6 inset-x-0 bottom-0 -mx-4 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_6%,transparent),transparent_65%)] pointer-events-none md:-top-8" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center md:flex-row md:items-center md:justify-center gap-8 md:gap-10 lg:gap-12">
          <div className="order-2 md:order-1 flex shrink-0 justify-center px-2">
            <img
              src="/askora_bot.png"
              alt=""
              width={406}
              height={468}
              decoding="async"
              loading="lazy"
              className="h-auto w-[200px] sm:w-[220px] md:w-[min(100%,260px)] max-w-[280px] animate-askora-float drop-shadow-[0_16px_32px_rgba(109,40,217,0.14)]"
            />
          </div>
          <div className="order-1 md:order-2 flex min-w-0 flex-col items-center text-center md:max-w-md lg:max-w-lg">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">{t('common.appName')}</h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('common.tagline')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {!user && (
                <>
                  <Link to="/register">
                    <Button size="lg">{t('auth.register')}</Button>
                  </Link>
                  <Link to="/join">
                    <Button size="lg" variant="outline">
                      {t('pool.join')}
                    </Button>
                  </Link>
                </>
              )}
              {user && (
                <Link to="/join">
                  <Button size="lg">{t('pool.join')}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="home-purpose-heading"
        className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/70 p-8 shadow-sm backdrop-blur-sm sm:p-10 md:p-12"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center md:max-w-3xl">
          <h2
            id="home-purpose-heading"
            className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl sm:leading-tight"
          >
            {t('home.purpose.title')}
          </h2>
          <span
            className="mt-5 block h-1 w-14 shrink-0 rounded-full bg-primary/35 md:mt-6"
            aria-hidden
          />
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-relaxed md:mt-6">
            {t('home.purpose.body')}
          </p>
        </div>
      </section>
      <section
        className="relative"
        aria-labelledby="home-features-heading"
      >
        <h2
          id="home-features-heading"
          className="text-center text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          {t('home.features.heading')}
        </h2>
        <ul className="mt-8 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-10 lg:grid-cols-4 lg:gap-6">
          {[
            { icon: MessageSquare, title: t('home.features.realtime.title'), desc: t('home.features.realtime.desc') },
            { icon: Zap, title: t('home.features.ai.title'), desc: t('home.features.ai.desc') },
            { icon: Shield, title: t('home.features.moderation.title'), desc: t('home.features.moderation.desc') },
            { icon: BarChart3, title: t('home.features.analytics.title'), desc: t('home.features.analytics.desc') },
          ].map(({ icon: Icon, title, desc }) => (
            <li key={title} className="min-h-0">
              <Card className="flex h-full flex-col items-center gap-0 border-border/80 bg-card/80 p-6 text-center shadow-none backdrop-blur-sm transition-[box-shadow,transform] duration-200 hover:border-border hover:shadow-md sm:p-7">
                <div className="mb-4 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="text-base font-semibold leading-snug">{title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
