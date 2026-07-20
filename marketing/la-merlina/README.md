# La Mérlina — landing de inversión (Valle de Uco)

Página de campaña para **La Mérlina**, barrio privado de parcelas en La Consulta,
Valle de Uco (Mendoza), sobre la Ruta del Vino. Comercializa Brunella Picone · Grupo Banker.

## Archivo
- `la-merlina.html` — página autocontenida (HTML + CSS + JS inline, sin dependencias
  ni fuentes externas). Se abre directo en el navegador o se sirve como estático.

## Personalizar
- **WhatsApp:** reemplazá todos los `https://wa.me/549XXXXXXXXXX` por el número real
  de Brunella (formato internacional sin `+`).
- **Video del hero:** hoy el fondo es un render procedural (canvas) como placeholder.
  Para usar el video real de la obra/drone:
  1. Poné el archivo en `assets/hero.mp4` (y un `assets/hero-poster.jpg`).
  2. En `la-merlina.html`, descomentá el bloque `<!-- HERO VIDEO -->` y borrá el
     `<canvas id="andes">`.
- **Fotos:** las secciones están pensadas para sumar fotos reales de las parcelas,
  las vistas y las bodegas cuando las tengas.

## Versión cinematográfica (a futuro)
La skill `scroll-world` quedó instalada en `.claude/skills/scroll-world/`. Cuando tengas
fotos/clips de la obra, se puede generar una versión con scroll-scrub (la cámara vuela por
el Valle) invocando `/scroll-world` en Claude Code.
