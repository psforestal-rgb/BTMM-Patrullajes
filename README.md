# Patrullajes SINAC

Aplicación web estática orientada exclusivamente al registro de patrullajes. Está preparada para publicarse directamente con **GitHub Pages** y funcionar como PWA.

## Funciones incluidas

- Inicio de patrullaje: fecha, hora, lugar de salida, encargado, personal, vehículo, kilometraje, combustible y revisión vehicular.
- Catálogos locales de personal y vehículos reutilizables entre patrullajes.
- Registro GPS continuo mientras la aplicación permanece activa.
- Conversión visible a **CR05 / CRTM05 (EPSG:5367)**. Se utiliza Proj4 cuando está disponible y se conserva un cálculo de respaldo.
- Mapa con OpenStreetMap e imagen aérea Esri con capa de etiquetas.
- Registro de observaciones georreferenciadas:
  - Daño ambiental: tipo de denuncia SITADA + tipo de infracción.
  - Vigilancia: Punto caliente / Finca del Estado / Al azar.
  - Monitoreo: Amenaza / Especie / Ecosistema.
  - Otro.
- Hasta tres fotografías por observación, comprimidas en el dispositivo y almacenadas en IndexedDB.
- Descripción amplia por observación.
- Fin de patrullaje: fecha, hora, lugar de regreso, kilometraje, combustible, revisión, observaciones generales y alimentación/hospedaje por funcionario.
- Exportación de respaldo JSON y GeoJSON.
- Borrador automático en el dispositivo.

## SITADA

Las etiquetas de **Tipo de Denuncia** se tomaron de la interfaz pública del SITADA consultada el 1 de septiembre de 2026. El nivel **Tipo de Infracción** es dependiente de la categoría y puede cambiar en el sistema institucional; por eso esta versión incorpora una lista auxiliar de infracciones públicamente documentadas y permite escribir otras sin perder información. El catálogo está aislado en `data/catalogs.js` para sustituirlo por un catálogo institucional completo cuando se disponga de él.

## Publicación en GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Copie todos los archivos de esta carpeta a la raíz del repositorio.
3. En **Settings → Pages**, seleccione **Deploy from a branch**.
4. Seleccione la rama `main` y carpeta `/ (root)`.
5. Abra la URL HTTPS de GitHub Pages.

La geolocalización del navegador requiere un **contexto seguro (HTTPS)**, por lo que GitHub Pages es apropiado.

## Limitaciones técnicas conocidas

- Los navegadores móviles no garantizan `watchPosition()` cuando la pantalla está bloqueada, la pestaña es suspendida o el navegador es cerrado. Esta aplicación no sustituye un registrador GNSS nativo para trazas continuas en segundo plano.
- OSM y la imagen aérea requieren conexión para descargar teselas nuevas. Las teselas ya consultadas pueden permanecer en caché, pero no se implementó todavía una descarga anticipada de cartografía offline.
- La generación del informe DOCX institucional no está incluida en esta iteración; el modelo de datos quedó preparado para incorporarla sin cambiar la captura de campo.

## Estructura

```text
index.html
assets/
  app.js
  geo.js
  geo-fallback.js
  storage.js
  styles.css
data/
  catalogs.js
manifest.webmanifest
sw.js
app-icon.svg
.nojekyll
```
