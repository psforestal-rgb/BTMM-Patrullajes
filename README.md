# Patrullajes SINAC · ACC · BTMM

Aplicación web estática para el **Informe de gira / patrullaje** del Bloque Tapantí Macizo de la Muerte (Área de Conservación Central, SINAC). Está pensada para publicarse con **GitHub Pages** y funcionar como PWA instalable, incluyendo generación sin conexión del documento Word institucional.

## Historial de esta versión

Esta versión reconstruye el sitio a partir de dos entregas anteriores que se habían separado:

1. Un primer prototipo (canvas de diseño de Claude) con membrete institucional, generación de Word (.docx), tema oscuro/claro y mapa CRTM05 sin conexión, pero sin catálogos de personal/vehículo ni la taxonomía oficial de SITADA.
2. Una segunda versión (código estático plano) que agregó catálogos de personal y vehículo, kilometraje/combustible, viáticos por funcionario y la clasificación oficial de hallazgos SITADA — pero cuyo despliegue en este repositorio estaba **roto**: `index.html` referenciaba `assets/` y `data/` que nunca se habían extraído del zip subido, por lo que la página cargaba sin estilos ni funciones.

Esta versión fusiona ambas: conserva el diseño, el membrete y la exportación a Word de la primera, e incorpora los catálogos operativos y la taxonomía SITADA de la segunda.

## Funciones incluidas

- **Informe de gira institucional**: identificación (oficio, ASP, destinatario, actividad), fecha/hora de gira, tipo de acción/resultados/evidencia general, ubicación administrativa y narrativa de resultados y recomendaciones.
- **Personal y vehículo**: catálogos locales reutilizables de personal y vehículos, encargado y personal participante, kilometraje y combustible inicial/final, revisión vehicular, lugar de salida/regreso.
- **Viáticos por funcionario**: tabla de desayuno/almuerzo/cena/hospedaje por cada persona participante.
- **GPS y CRTM05**: captura puntual y registro continuo del recorrido (cada ~25 m o 30 s), con conversión a **CR05 / CRTM05 (EPSG:5367)** vía Proj4 cuando está disponible y cálculo de respaldo sin dependencias si no lo está.
- **Mapa sin conexión**: cuadrícula CRTM05 dibujada en `<canvas>` con los puntos del recorrido, más la opción de cargar una imagen georreferenciada (hoja cartográfica u ortofoto) indicando sus esquinas en CRTM05 — funciona completamente sin internet.
- **Mapa en línea opcional**: OpenStreetMap e imagen aérea Esri (Leaflet), colapsado por defecto, para cuando sí hay conexión.
- **Hallazgos georreferenciados** con la clasificación oficial:
  - Daño ambiental: tipo de denuncia SITADA + tipo de infracción.
  - Vigilancia: Punto caliente / Finca del Estado / Al azar.
  - Monitoreo: Amenaza / Especie / Ecosistema.
  - Otro.
  - Hasta 3 fotografías por hallazgo, comprimidas en el dispositivo y almacenadas en IndexedDB.
- **Personas relacionadas** (contactos, imputados, informantes, testigos) y **acompañantes** externos a la institución.
- **Fotografías generales** no ligadas a un hallazgo puntual (equipo, vehículo, panorámicas).
- **Generación de informe Word (.docx)** con membrete oficial SINAC/MINAE, franjas decorativas, tablas de personas/hallazgos/viáticos y registro fotográfico — construido en el dispositivo con JSZip (vendorizado localmente, sin depender de una CDN) y **funciona sin conexión**.
- **Vista previa** del informe en dos formatos: resumen legible y documento tamaño carta.
- Exportación de respaldo JSON (con fotografías incluidas) e importación, y exportación GeoJSON del recorrido y los hallazgos.
- Tema oscuro/claro y borrador automático en el dispositivo (localStorage + IndexedDB).

## Decisiones de fusión (para que quede explícito qué se decidió y por qué)

- El **modo de captura GPS** se simplificó a uno solo: el registro continuo automático (25 m / 30 s) del prototipo con catálogos, activado con un botón dedicado en la pestaña "Ruta". Se eliminó el segundo concepto de "modo patrullaje" con intervalo/distancia configurable del primer prototipo (30 min / 1 km) por ser redundante con el anterior y para no confundir con dos formas distintas de iniciar el registro.
- Los **hallazgos** ahora combinan ambas versiones: conservan la clasificación oficial SITADA (Daño ambiental/Vigilancia/Monitoreo/Otro) y, además, cada uno admite hasta 3 fotografías propias (antes solo existían fotografías generales sin vincular a un hallazgo).
- Los **viáticos** se manejan por funcionario en tabla (como en la versión con catálogos), en vez del campo global de desayuno/almuerzo del primer prototipo; el Word institucional refleja esta tabla.
- La navegación es por **pestañas libres** (Gira / Acción / Ruta / Campo / Informe), como en el primer prototipo, en vez del asistente de 4 pasos con bloqueo de la versión con catálogos — se puede completar cualquier sección en cualquier momento. La validación de campos obligatorios para generar el Word se mantiene como control de calidad antes de exportar.
- Las imágenes institucionales (logo MINAE/SINAC y franjas decorativas) se extrajeron como archivos PNG en `assets/img/` en vez de vivir como texto base64 dentro del JavaScript, para que el navegador y el Service Worker las cacheen de forma nativa.

## SITADA

Las etiquetas de **Tipo de Denuncia** se tomaron de la interfaz pública del SITADA consultada el 1 de septiembre de 2026. El nivel **Tipo de Infracción** es dependiente de la categoría y puede cambiar en el sistema institucional; por eso esta versión incorpora una lista auxiliar de infracciones públicamente documentadas y permite escribir otras sin perder información. El catálogo está aislado en `data/catalogs.js` para sustituirlo por un catálogo institucional completo cuando se disponga de él.

## Publicación en GitHub Pages

1. Cree un repositorio nuevo en GitHub (o use este).
2. En **Settings → Pages**, seleccione **Deploy from a branch**.
3. Seleccione la rama `main` (o la rama publicada) y carpeta `/ (root)`.
4. Abra la URL HTTPS de GitHub Pages.

La geolocalización del navegador requiere un **contexto seguro (HTTPS)**, por lo que GitHub Pages es apropiado.

## Limitaciones técnicas conocidas

- Los navegadores móviles no garantizan `watchPosition()` cuando la pantalla está bloqueada, la pestaña es suspendida o el navegador es cerrado. Esta aplicación no sustituye un registrador GNSS nativo para trazas continuas en segundo plano.
- El mapa en línea (OpenStreetMap/Esri) requiere conexión para descargar teselas nuevas; para uso garantizado sin conexión, use el mapa de cuadrícula CRTM05 (por defecto) y, si lo necesita, cargue de antemano una imagen georreferenciada del área de interés.
- Leaflet y Proj4 se cargan desde CDN (`unpkg.com` / `cdn.jsdelivr.net`); si el dispositivo nunca tuvo conexión para descargarlos una primera vez, el mapa en línea no estará disponible y la conversión CRTM05 usará el cálculo de respaldo local (misma fórmula, sin Proj4). El resto de la aplicación —incluida la generación del Word— no depende de ninguna CDN.

## Estructura

```text
index.html
assets/
  app.js            lógica de la aplicación
  report.js         vista previa e informe Word (.docx)
  geo.js            conversión CRTM05 (Proj4 + respaldo)
  geo-fallback.js   conversión CRTM05 sin dependencias
  storage.js        IndexedDB (fotografías y mapa base)
  styles.css
  vendor/
    jszip.min.js    JSZip 3.10.1 (MIT), vendorizado para funcionar sin conexión
  img/
    sinac-logo.png
    informe-corner-top.png
    informe-corner-bottom.png
data/
  catalogs.js       catálogos institucionales y SITADA
manifest.webmanifest
sw.js
app-icon.svg
.nojekyll
```
