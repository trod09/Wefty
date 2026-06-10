// Icono para iOS (180×180). Next lo genera como PNG en el build usando
// ImageResponse (viene incluido en Next, sin librerías nuevas). Mismo diseño
// que app/icon.svg, pero a sangre completa y sin esquinas redondeadas: iOS
// aplica su propia máscara redondeada encima.
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F1014',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64">
          <path
            fill="#FAFAF7"
            d="M12 20 L19 20 L24.5 38 L32 26 L39.5 38 L45 20 L52 20 L39.5 46 L32 34 L24.5 46 Z"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
