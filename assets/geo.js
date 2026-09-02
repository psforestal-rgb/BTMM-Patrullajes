(function () {
  const CRTM05_DEF = '+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-0.16959,0.35312,0.51846,-0.03385,0.16325,-0.03446,0.03693 +units=m +no_defs +type=crs';

  if (window.proj4) {
    try { window.proj4.defs('EPSG:5367', CRTM05_DEF); } catch (_) {}
  }

  function toCRTM05(lat, lon) {
    if (window.proj4) {
      const p = window.proj4('EPSG:4326', 'EPSG:5367', [lon, lat]);
      return { x: Math.round(p[0]), y: Math.round(p[1]), method: 'proj4/EPSG:5367' };
    }
    if (window.SINAC_GEO && window.SINAC_GEO.toCRTM05) {
      const p = window.SINAC_GEO.toCRTM05(lat, lon);
      return { x: p.x, y: p.y, method: 'fallback-TM' };
    }
    return null;
  }

  function haversine(a, b) {
    const R = 6371008.8;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const sa = Math.sin(dLat / 2);
    const sb = Math.sin(dLon / 2);
    const h = sa * sa + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * sb * sb;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function fmtCRTM(p) {
    if (!p) return '—';
    return `${Number(p.x).toLocaleString('es-CR')} E / ${Number(p.y).toLocaleString('es-CR')} N`;
  }

  window.PatrolGeo = { toCRTM05, haversine, fmtCRTM, CRTM05_DEF };
})();
