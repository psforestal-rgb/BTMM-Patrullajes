// WGS84 -> CRTM05 (EPSG:5367) y utilidades de distancia. Sin dependencias.
(function () {
  var a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  var k0 = 0.9999, lon0 = -84 * Math.PI / 180, FE = 500000, FN = 0;

  function toCRTM05(latDeg, lonDeg) {
    var phi = latDeg * Math.PI / 180, lam = lonDeg * Math.PI / 180;
    var s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
    var N = a / Math.sqrt(1 - e2 * s * s);
    var T = t * t, C = ep2 * c * c, A = (lam - lon0) * c;
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256) * phi
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * phi)
      + (15 * e2 * e2 / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * phi)
      - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * phi));
    var E = FE + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120);
    var Nn = FN + k0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
    return { x: Math.round(E), y: Math.round(Nn) };
  }

  function haversine(la1, lo1, la2, lo2) {
    var R = 6371008.8, r = Math.PI / 180;
    var dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2)
      + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function fmtCR(p) { return p ? p.x.toLocaleString('es-CR') + ' E / ' + p.y.toLocaleString('es-CR') + ' N' : ''; }

  window.SINAC_GEO = { toCRTM05: toCRTM05, haversine: haversine, fmtCR: fmtCR };
})();
