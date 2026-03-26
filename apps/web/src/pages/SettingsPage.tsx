import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Cropper, { type Area } from 'react-easy-crop';
import { cn } from '@/lib/utils';
import {
  type AvatarSource,
  MAX_AVATAR_BYTES,
  ACCEPTED_AVATAR_MIMES,
  PRESET_AVATARS,
  cropImageToSquare,
  rasterizeImageUrlToPngFile,
} from '@/lib/avatar-crop';
import { ArrowLeft } from 'lucide-react';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(message) && message.length > 0) return message[0];
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, isLoading, updateProfile, changePassword } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileOk, setProfileOk] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [avatarSource, setAvatarSource] = useState<AvatarSource>({ kind: 'none' });
  const [avatarMode, setAvatarMode] = useState<'upload' | 'preset'>('upload');
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const cropPixelsRef = useRef<Area | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setAvatarSource({ kind: 'none' });
  }, [user?.id, user?.firstName, user?.lastName]);

  const previewUrl = avatarSource.kind === 'none' ? '' : avatarSource.previewUrl;
  const displayAvatarUrl = previewUrl || user?.avatarUrl || '';
  const canCrop = avatarSource.kind === 'upload' || avatarSource.kind === 'preset';
  const selectedAvatarLabel = useMemo(() => {
    if (avatarSource.kind === 'upload') return avatarSource.file.name;
    if (avatarSource.kind === 'preset') return avatarSource.suggestedName;
    return '';
  }, [avatarSource]);

  const resolveProfileAvatarFile = async (): Promise<File | undefined> => {
    if (avatarSource.kind === 'upload') return avatarSource.file;
    if (avatarSource.kind === 'preset') {
      return rasterizeImageUrlToPngFile(avatarSource.url, avatarSource.suggestedName);
    }
    return undefined;
  };

  const handleSaveProfile = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileError('');
    setProfileOk(false);
    setAvatarError('');
    setProfileLoading(true);
    try {
      const avatarFile = await resolveProfileAvatarFile();
      await updateProfile(firstName, lastName, avatarFile);
      if (avatarSource.kind === 'upload') URL.revokeObjectURL(avatarSource.previewUrl);
      setAvatarSource({ kind: 'none' });
      setProfileOk(true);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setProfileError(msg || t('common.error'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordOk(false);
    if (!STRONG_PASSWORD_REGEX.test(newPassword) || newPassword.length < 8) {
      setPasswordError(t('auth.passwordPolicyError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'));
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOk(true);
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, t('common.error')));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-5 sm:mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {t('dashboard.title')}
        </Link>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('settings.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1.5 max-w-2xl">{t('settings.description')}</p>
      </header>

      <div
        className={cn(
          'grid gap-4 sm:gap-5',
          user.hasPassword ? 'lg:grid-cols-2 lg:items-start lg:gap-6' : 'max-w-xl',
        )}
      >
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="space-y-1 pb-3 sm:pb-4">
            <CardTitle className="text-lg">{t('settings.profile')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-snug">
              {t('settings.profileHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
          <form onSubmit={handleSaveProfile} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.avatar')}</label>
              <div className="rounded-xl border border-border p-3 sm:p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex flex-col items-center gap-2 sm:w-[5.5rem] shrink-0">
                    <div className="h-20 w-20 sm:h-[4.5rem] sm:w-[4.5rem] rounded-full overflow-hidden border border-border bg-muted grid place-items-center text-sm font-semibold">
                      {displayAvatarUrl ? (
                        <img src={displayAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex w-full flex-wrap justify-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={!canCrop}
                        onClick={() => {
                          setCrop({ x: 0, y: 0 });
                          setZoom(1);
                          setCropOpen(true);
                        }}
                      >
                        {t('settings.crop')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={avatarSource.kind === 'none'}
                        onClick={() => {
                          if (avatarSource.kind === 'upload') URL.revokeObjectURL(avatarSource.previewUrl);
                          setAvatarSource({ kind: 'none' });
                        }}
                      >
                        {t('settings.removeAvatar')}
                      </Button>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={avatarMode === 'upload' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAvatarMode('upload')}
                      >
                        {t('settings.avatarUpload')}
                      </Button>
                      <Button
                        type="button"
                        variant={avatarMode === 'preset' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAvatarMode('preset')}
                      >
                        {t('settings.avatarGallery')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{t('settings.avatarFormats')}</p>
                    <p className="text-xs font-medium text-foreground/90 truncate" title={previewUrl ? selectedAvatarLabel : undefined}>
                      {previewUrl ? selectedAvatarLabel : t('settings.avatarKeep')}
                    </p>

                    {avatarMode === 'upload' ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={[...ACCEPTED_AVATAR_MIMES].join(',')}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setAvatarError('');
                            if (!(ACCEPTED_AVATAR_MIMES as readonly string[]).includes(f.type)) {
                              setAvatarError(t('settings.avatarTypeError'));
                              return;
                            }
                            if (f.size > MAX_AVATAR_BYTES) {
                              setAvatarError(t('settings.avatarSizeError'));
                              return;
                            }
                            const url = URL.createObjectURL(f);
                            setAvatarSource({ kind: 'upload', file: f, previewUrl: url });
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          {t('settings.chooseFile')}
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 max-w-[220px] sm:max-w-none">
                        {PRESET_AVATARS.map((a) => (
                          <button
                            key={a.url}
                            type="button"
                            className={cn(
                              'rounded-lg border border-border overflow-hidden aspect-square bg-muted hover:ring-2 hover:ring-ring min-h-[44px] min-w-[44px]',
                              avatarSource.kind === 'preset' && avatarSource.url === a.url ? 'ring-2 ring-ring' : '',
                            )}
                            onClick={() => {
                              setAvatarError('');
                              setAvatarSource({ kind: 'preset', url: a.url, previewUrl: a.url, suggestedName: a.name });
                            }}
                            title={a.name}
                            aria-label={a.name}
                          >
                            <img src={a.url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {avatarError && <p className="text-sm text-destructive">{avatarError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.email')}</label>
              <Input value={user.email} readOnly className="bg-muted h-10" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-2 min-w-0">
                <label className="text-sm font-medium">{t('auth.firstName')}</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required minLength={2} className="h-10" />
              </div>
              <div className="space-y-2 min-w-0">
                <label className="text-sm font-medium">{t('auth.lastName')}</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required minLength={2} className="h-10" />
              </div>
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            {profileOk && <p className="text-sm text-green-600 dark:text-green-500">{t('settings.profileSaved')}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={profileLoading} className="min-w-[7rem]">
                {profileLoading ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </form>

          {cropOpen && previewUrl && (
            <dialog
              open
              className="fixed inset-0 z-50 bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full"
              aria-label={t('settings.cropDialogTitle')}
              onClose={() => setCropOpen(false)}
            >
              <form method="dialog" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{t('settings.cropDialogTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('settings.cropDialogHint')}</div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCropOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black">
                      <Cropper
                        image={previewUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={(_, croppedAreaPixels) => {
                          cropPixelsRef.current = croppedAreaPixels;
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="settingsAvatarZoom" className="text-sm text-muted-foreground shrink-0">
                        {t('settings.zoom')}
                      </label>
                      <input
                        id="settingsAvatarZoom"
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCropOpen(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            setAvatarError('');
                            const pixels = cropPixelsRef.current;
                            if (!pixels) throw new Error('Crop not ready');
                            const blob = await cropImageToSquare(previewUrl, pixels, 512);
                            const file = new File([blob], 'avatar.png', { type: blob.type });
                            const url = URL.createObjectURL(file);
                            if (avatarSource.kind === 'upload') URL.revokeObjectURL(avatarSource.previewUrl);
                            setAvatarSource({ kind: 'upload', file, previewUrl: url });
                            setCropOpen(false);
                          } catch {
                            setAvatarError(t('settings.cropError'));
                          }
                        }}
                      >
                        {t('settings.applyCrop')}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </dialog>
          )}
        </CardContent>
      </Card>

      {user.hasPassword && (
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="space-y-1 pb-3 sm:pb-4">
            <CardTitle className="text-lg">{t('settings.passwordSection')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-snug">
              {t('settings.passwordHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.currentPassword')}</label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  showLabel={t('settings.showPassword')}
                  hideLabel={t('settings.hidePassword')}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-medium">{t('settings.newPassword')}</label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    pattern={STRONG_PASSWORD_REGEX.source}
                    title={t('auth.passwordPolicyHelp')}
                    autoComplete="new-password"
                    showLabel={t('settings.showPassword')}
                    hideLabel={t('settings.hidePassword')}
                  />
                  <p className="text-xs text-muted-foreground">{t('auth.passwordPolicyHelp')}</p>
                </div>
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-medium">{t('settings.confirmPassword')}</label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    showLabel={t('settings.showPassword')}
                    hideLabel={t('settings.hidePassword')}
                  />
                </div>
              </div>
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              {passwordOk && (
                <p className="text-sm text-green-600 dark:text-green-500">{t('settings.passwordChanged')}</p>
              )}
              <Button type="submit" variant="secondary" disabled={passwordLoading} className="min-w-[7rem]">
                {passwordLoading ? t('common.loading') : t('settings.changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
