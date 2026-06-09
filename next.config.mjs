/** @type {import('next').NextConfig} */

// Cabeceras de seguridad (auditoría pre-deploy).
// En desarrollo, next dev necesita 'unsafe-eval' (recarga en caliente) y
// websockets locales; en producción la política es más estricta.
const esDesarrollo = process.env.NODE_ENV === 'development';

// Content-Security-Policy: a qué puede conectarse y qué puede ejecutar el
// navegador en esta web. Lo importante:
//  · connect-src: solo nuestro dominio y Supabase (datos + auth + realtime).
//  · frame-ancestors 'none': nadie puede meter Wefty en un iframe (clickjacking).
//  · script-src 'unsafe-inline': lo exige el runtime de Next.js (hidratación);
//    aun así, ningún script de dominios externos puede ejecutarse.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${esDesarrollo ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const cabecerasSeguridad = [
  { key: 'Content-Security-Policy', value: csp },
  // Refuerzo del frame-ancestors para navegadores antiguos.
  { key: 'X-Frame-Options', value: 'DENY' },
  // El navegador no debe "adivinar" tipos de archivo distintos al declarado.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Al salir hacia otros sitios, no filtrar la URL completa de origen.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Funciones del navegador que esta app no usa: apagadas.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Exigir HTTPS durante 2 años una vez visitada (Vercel sirve siempre HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
