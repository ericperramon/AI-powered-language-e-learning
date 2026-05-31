# GlossaAI Design System

Fuente: `styleguide.html` proporcionado como referencia de sistema visual.

## Principios
- **Approachable Intelligence**: la interfaz debe sentirse inteligente, calmada y accesible.
- **Refined Minimalism**: cada elemento debe cumplir una funcion clara; evitar decoracion innecesaria.
- **Sophisticated Calm**: usar contraste suave, superficies calidas neutras y jerarquia limpia para reducir carga cognitiva.
- **Tech-Forward Warmth**: estructura precisa con bordes suaves y senales de IA discretas, no estridentes.

## Tipografia
- Texto base: `Inter`, pesos `400`, `500`, `600`.
- Titulares y marca: `Montserrat`, pesos `600`, `700`.
- Los titulares de mas de 20px usan tracking ajustado (`letter-spacing: -0.02em`) mediante `.font-display`.
- Escala objetivo:
  - Display lg: 48/56, Montserrat 700.
  - Display sm: 36/44, Montserrat 700.
  - Headline lg: 30/38, Montserrat 600.
  - Headline md: 24/32, Montserrat 600.
  - Body lg: 18/28, Inter 400.
  - Body md: 16/24, Inter 400.
  - Body sm: 14/20, Inter 400.
  - Label md: 14/20, Inter 600.
  - Label sm: 12/16, Inter 500.

## Color
Los tokens viven en `app/globals.css` y deben usarse antes que colores hardcodeados.

- Superficie principal: `--background` / `--surface` `#FDFAF6` (blanco calido neutro).
- Texto principal: `--on-surface` `#1C1917`.
- Texto secundario: `--on-surface-variant` `#4A4540`.
- Outline: `--outline` `#7A7068`.
- Outline suave: `--outline-variant` `#C9C0B5`.
- Primary: `--primary` `#2A6F97` (azul acero).
- Primary hover/container: `--primary-container` `#3988B5`.
- Primary soft: `--primary-fixed` `#D6EDF7`.
- Secondary: `--secondary` `#7A5C3E` (marron calido, para bordes y texto en botones outline).
- Secondary container: `--secondary-container` `#F2E9D8` (crema calida, para chips y fondos suaves).
- Tertiary/ambar para momentos puntuales: `--tertiary` `#C47A3A`.
- Error: `--error` `#ba1a1a`.

Evitar volver a introducir paletas lavanda, morados arbitrarios o `slate` salvo que se documenten como extension del sistema.

## Espaciado, radios y elevacion
- Espaciado base: `4, 8, 16, 24, 32, 48, 64px`.
- Gutter de pagina: `24px`.
- Max width de contenido: `1280px`.
- Radios:
  - `--r-sm`: `4px`.
  - `--r-md`: `12px`.
  - `--r-lg`: `16px`.
  - `--r-xl`: `24px`.
  - `--r-full`: pill.
- Cards: fondo `--surface-container-lowest`, borde `--outline-variant`, radio `--r-lg`.
- Elevacion normal: `0 4px 20px rgba(0,0,0,0.06)`.
- Elevacion destacada: `0 10px 30px rgba(109,105,219,0.12)`.

## Componentes
- Botones:
  - Altura base `40px`.
  - Texto `14px`, `Inter 600`, tracking `0.01em`.
  - Radio `8px`.
  - Primary usa `--primary`; hover `--primary-container`.
  - Secondary transparente con borde `1.5px` en `--secondary`.
  - Ghost usa texto primary y hover `--primary-fixed`.
- Inputs/selects:
  - Altura base `44px`.
  - Fondo `--surface-container-low`.
  - Borde `1.5px` `--outline-variant`.
  - Focus con `--primary` y ring `rgba(42,111,151,0.15)`.
- Chips:
  - Pildora con `--secondary-container` y texto `--on-secondary-container`.
- Progreso:
  - Track `--surface-container-highest` o `--primary-fixed-dim`.
  - Fill `--primary`.
- Iconos:
  - Usar `lucide-react` con `strokeWidth={1.5}` por defecto.

## Implementacion
- Preferir tokens CSS (`var(--...)`) y clases utilitarias globales (`font-display`, `app-container`, `surface-card`) antes que colores Tailwind hardcodeados.
- Mantener el sistema en `app/globals.css`, `components/ui/*` y esta guia.
- Si se anaden nuevos patrones visuales, documentarlos aqui y evitar duplicar reglas extensas en `AGENTS.md`.
