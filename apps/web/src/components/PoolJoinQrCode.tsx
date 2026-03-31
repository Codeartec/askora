import * as ReactQR from 'react-qr-code';
import type { QRCodeProps } from 'react-qr-code';

function isRenderableComponent(x: unknown): x is React.ComponentType<QRCodeProps> {
  return (
    typeof x === 'function' ||
    (typeof x === 'object' &&
      x !== null &&
      '$$typeof' in x &&
      typeof (x as { $$typeof?: unknown }).$$typeof === 'symbol')
  );
}

function resolveQrComponent(): React.ComponentType<QRCodeProps> {
  const m = ReactQR as unknown as Record<string, unknown>;
  if (isRenderableComponent(m.QRCode)) return m.QRCode;

  const d = m.default;
  if (isRenderableComponent(d)) return d;
  if (d && typeof d === 'object') {
    const inner = d as Record<string, unknown>;
    if (isRenderableComponent(inner.default)) return inner.default as React.ComponentType<QRCodeProps>;
    if (isRenderableComponent(inner.QRCode)) return inner.QRCode as React.ComponentType<QRCodeProps>;
  }
  throw new Error('react-qr-code: could not resolve a valid component export');
}

const QrResolved = resolveQrComponent();

export function PoolJoinQrCode(props: QRCodeProps) {
  return <QrResolved {...props} />;
}
