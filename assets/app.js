(() => {
  'use strict';

  const C = window.PATRULLAJE_CATALOGS;
  const LS_STATE = 'patrullajes-sinac:v4:current';
  const LS_CATALOG = 'patrullajes-sinac:v4:catalog';
  const LS_THEME = 'patrullajes-sinac:v4:theme';
  const TRACK_MIN_METERS = 25;
  const TRACK_MAX_SECONDS = 30;
  const TABS = ['gira', 'accion', 'ruta', 'campo', 'informe'];

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const isoNow = () => new Date().toISOString();
  const todayStr = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  const nowTime = () => new Date().toTimeString().slice(0, 5);
  const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const escapeAttr = v => escapeHtml(v).replace(/`/g, '&#96;');
  const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  let state = loadState();
  let catalogs = loadCatalogs();
  let currentTab = 'gira';
  let editingFindingId = null;
  let pendingFindingPhotoBlobs = [null, null, null];
  let watchId = null, pollTimer = null, lastWatchFix = null;
  let onlineMap = null, onlineMapReady = false, onlineTrackLine = null, onlineObsLayer = null, onlineCurrentMarker = null;
  let basemapImg = null;
  let toastTimer, saveTimer, formSaveTimer;

  // ---------- state ----------
  function blankState() {
    return {
      version: 4, id: uid('PAT'), status: 'draft',
      report: { reportDate: '', reportNumber: '', asp: '', recipient: '', activity: 'Patrullaje de Prevención, Protección y Control', tourDate: '', startTime: '', endTime: '', kilometers: '' },
      location: { province: '', canton: '', district: '', hamlet: '', exactAddress: '', mapSheet: '', crtmX: '', crtmY: '' },
      lugarSalida: '', lugarSalidaOtro: '', lugarRegreso: '', lugarRegresoOtro: '',
      encargado: '', personnel: [],
      vehiculo: '', odometroInicial: null, odometroFinal: null, combustibleInicial: '', combustibleFinal: '', vehiculoCheckInicio: false, vehiculoCheckFin: false,
      allowances: {},
      actions: [], results: [], evidence: [], actionOther: '', resultOther: '', evidenceOther: '',
      gps: null, gpsMeta: 'Sin captura de ubicación.',
      track: [], patrolActive: false,
      basemapKey: null, bounds: null, routeDescription: '',
      contacts: [], findings: [], companions: [], generalPhotos: [],
      resultsNarrative: '', recommendations: '',
      responsibleName: '', responsibleId: '', responsiblePosition: '', signatureText: 'Firmado de forma digital', cc: 'Archivo', unit: '',
      theme: null,
      createdAt: isoNow(), updatedAt: isoNow()
    };
  }
  function loadState() {
    try { const raw = JSON.parse(localStorage.getItem(LS_STATE)); return raw && raw.version === 4 ? Object.assign(blankState(), raw) : blankState(); }
    catch (_) { return blankState(); }
  }
  function loadCatalogs() {
    const defaults = { personnel: [], vehicles: [] };
    try { return Object.assign(defaults, JSON.parse(localStorage.getItem(LS_CATALOG) || '{}')); }
    catch (_) { return defaults; }
  }
  function saveCatalogs() { localStorage.setItem(LS_CATALOG, JSON.stringify(catalogs)); }
  function saveState() {
    state.updatedAt = isoNow();
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    $('#saveLabel').textContent = 'Guardado ' + new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
    updateProgress();
  }
  function queueSave() { $('#saveLabel').textContent = 'Guardando…'; clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 500); }

  function toast(msg, ms = 2600) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------- theme ----------
  function setTheme(t) {
    document.body.setAttribute('data-theme', t);
    localStorage.setItem(LS_THEME, t);
    state.theme = t;
    $('#themeBtn').textContent = t === 'light' ? '☾' : '☀';
  }

  // ---------- tabs ----------
  function goTab(tab) {
    currentTab = tab;
    $$('.tabpanel').forEach(p => p.classList.toggle('current', p.id === 'tab-' + tab));
    $$('.nav-btn').forEach(b => b.classList.toggle('current', b.dataset.tab === tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'informe') renderPreview();
    if (tab === 'ruta') { drawOfflineMap(); if (onlineMapReady) setTimeout(() => onlineMap.invalidateSize(), 50); }
  }

  // ---------- generic form binding ----------
  function formData() {
    const out = {};
    $$('#patrolForm [name]').forEach(el => { out[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return out;
  }
  function applyFormValue(name, value) {
    const el = $(`#patrolForm [name="${name}"]`);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value ?? '';
  }

  function updateProgress() {
    const ess = $$('#patrolForm [data-essential]');
    let done = ess.filter(e => String(e.value || '').trim()).length;
    const total = ess.length + 1;
    if (state.actions.length) done++;
    const pct = Math.round(done / total * 100);
    $('#progressBar').style.width = pct + '%';
  }

  // ---------- populate static selects ----------
  function populateStaticSelects() {
    const options = (arr, first = 'Seleccione…') => `<option value="">${first}</option>` + arr.map(v => `<option>${escapeHtml(v)}</option>`).join('');
    $('#lugarSalida').innerHTML = options(C.lugares);
    $('#lugarRegreso').innerHTML = options(C.lugares, 'Se define al finalizar…');
    $('#combustibleInicial').innerHTML = options(C.combustibles);
    $('#combustibleFinal').innerHTML = options(C.combustibles);
    $('#fSitadaType').innerHTML = options(C.sitadaTipos, 'Seleccione tipo SITADA…');
    $('#sitadaInfractionList').innerHTML = C.sitadaInfraccionesComunes.map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
    $('#aspList').innerHTML = C.asp.map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
    $('#cRole').innerHTML = C.roles.map(v => `<option>${escapeHtml(v)}</option>`).join('');
    $('#actionChips').innerHTML = chipsHtml('actions', C.acciones);
    $('#resultChips').innerHTML = chipsHtml('results', C.resultados);
    $('#evidenceChips').innerHTML = chipsHtml('evidence', C.evidenciaGeneral);
    bindChipEvents();
  }

  function chipsHtml(kind, items) {
    return items.map(label => `<button type="button" class="chip" data-chip-kind="${kind}" data-chip-label="${escapeAttr(label)}">${escapeHtml(label)}</button>`).join('');
  }
  function bindChipEvents() {
    $$('.chip[data-chip-kind]').forEach(btn => btn.addEventListener('click', () => {
      const kind = btn.dataset.chipKind, label = btn.dataset.chipLabel;
      const arr = state[kind];
      const idx = arr.indexOf(label);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(label);
      renderChipState();
      queueSave(); updateProgress();
    }));
  }
  function renderChipState() {
    $$('.chip[data-chip-kind]').forEach(btn => btn.classList.toggle('on', state[btn.dataset.chipKind].includes(btn.dataset.chipLabel)));
    $('#actionsCount').textContent = state.actions.length ? state.actions.length + ' marcadas' : 'Ninguna marcada';
  }

  // ---------- catalogs: personnel / vehicles ----------
  function renderCatalogs() {
    const encargado = $('#encargado'), vehiculo = $('#vehiculo');
    encargado.innerHTML = `<option value="">Seleccione encargado…</option>` + catalogs.personnel.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    vehiculo.innerHTML = `<option value="">Seleccione vehículo…</option><option value="none">Sin vehículo</option>` + catalogs.vehicles.map(v => `<option value="${escapeAttr(v.id)}">${escapeHtml(vehicleLabel(v))}</option>`).join('');
    encargado.value = state.encargado; vehiculo.value = state.vehiculo;
    renderPersonnelPills(); renderAllowances();
  }
  function vehicleLabel(v) { return [v.plate, v.brand, v.model].filter(Boolean).join(' · ') || 'Vehículo'; }
  function getPersonName(id) { return (catalogs.personnel.find(p => p.id === id) || {}).name || ''; }
  function getVehicleLabel(id) { if (!id) return ''; if (id === 'none') return 'Sin vehículo'; return vehicleLabel(catalogs.vehicles.find(v => v.id === id) || {}); }

  function renderPersonnelPills() {
    const box = $('#personnelPills');
    if (!catalogs.personnel.length) { box.innerHTML = `<span class="hint">Primero agregue personal al catálogo.</span>`; return; }
    box.innerHTML = catalogs.personnel.map(p => `<button type="button" class="pill ${state.personnel.includes(p.id) ? 'selected' : ''}" data-person="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`).join('');
    $$('[data-person]', box).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.person;
      state.personnel = state.personnel.includes(id) ? state.personnel.filter(x => x !== id) : [...state.personnel, id];
      renderPersonnelPills(); renderAllowances(); queueSave();
    }));
  }
  function addPerson() {
    const name = prompt('Nombre completo del funcionario o participante:');
    if (!name || !name.trim()) return;
    catalogs.personnel.push({ id: uid('person'), name: name.trim() });
    saveCatalogs(); renderCatalogs();
  }
  function addVehicle() {
    const plate = prompt('Placa o identificación del vehículo:');
    if (!plate || !plate.trim()) return;
    const brand = prompt('Marca (opcional):') || '', model = prompt('Modelo (opcional):') || '';
    catalogs.vehicles.push({ id: uid('vehicle'), plate: plate.trim(), brand: brand.trim(), model: model.trim() });
    saveCatalogs(); renderCatalogs();
  }
  function participantIds() { return unique([state.encargado, ...state.personnel].filter(Boolean)); }
  function unique(arr) { return [...new Set(arr)]; }

  function renderAllowances() {
    const tbody = $('#allowanceBody');
    const ids = participantIds();
    if (!ids.length) { tbody.innerHTML = `<tr><td colspan="5" class="hint">Seleccione encargado y personal en la sección Personal.</td></tr>`; return; }
    tbody.innerHTML = ids.map(id => {
      const a = state.allowances[id] || {};
      return `<tr><td>${escapeHtml(getPersonName(id))}</td>${['breakfast', 'lunch', 'dinner', 'lodging'].map(k => `<td class="center"><input type="checkbox" data-allow-person="${escapeAttr(id)}" data-allow-key="${k}" ${a[k] ? 'checked' : ''}></td>`).join('')}</tr>`;
    }).join('');
    $$('[data-allow-person]', tbody).forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.allowPerson, key = cb.dataset.allowKey;
      state.allowances[id] = state.allowances[id] || {};
      state.allowances[id][key] = cb.checked;
      queueSave();
    }));
  }

  function toggleOtherPlace(which) {
    const sel = $(`#${which === 'salida' ? 'lugarSalida' : 'lugarRegreso'}`);
    $(`#lugar${which === 'salida' ? 'Salida' : 'Regreso'}OtroWrap`).classList.toggle('hidden', sel.value !== 'Otro');
  }

  // ---------- GPS ----------
  function fix(opts) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
      navigator.geolocation.getCurrentPosition(pos => resolve(pos.coords), reject, Object.assign({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, opts || {}));
    });
  }
  // Reutiliza la última posición del registro GPS continuo si es reciente, en vez de
  // negociar una nueva lectura mientras un watchPosition ya está activo (más rápido
  // y evita conflictos entre solicitudes de posición simultáneas en algunos dispositivos).
  function fixPreferWatch(opts) {
    if (state.patrolActive && lastWatchFix && (Date.now() - lastWatchFix.at) < 15000) return Promise.resolve(lastWatchFix.coords);
    return fix(opts);
  }
  async function captureGps() {
    $('#gpsMeta').textContent = 'Solicitando ubicación…';
    try {
      const c = await fixPreferWatch();
      const cr = PatrolGeo.toCRTM05(c.latitude, c.longitude);
      applyFormValue('latitude', c.latitude.toFixed(7));
      applyFormValue('longitude', c.longitude.toFixed(7));
      applyFormValue('gpsAccuracy', Math.round(c.accuracy));
      state.gps = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, x: cr ? cr.x : null, y: cr ? cr.y : null, at: isoNow() };
      $('#gpsCrtm').textContent = cr ? PatrolGeo.fmtCRTM(cr) : '—';
      $('#gpsMeta').textContent = 'Capturada ' + new Date().toLocaleString('es-CR') + ' · ±' + Math.round(c.accuracy) + ' m';
      queueSave();
    } catch (e) { $('#gpsMeta').textContent = 'No se pudo capturar: ' + e.message; }
  }
  function useGpsAsCrtm() {
    if (!state.gps) return toast('Primero capture el GPS.');
    applyFormValue('crtmX', state.gps.x); applyFormValue('crtmY', state.gps.y);
    state.location.crtmX = state.gps.x; state.location.crtmY = state.gps.y;
    toast('Coordenadas CRTM05 copiadas.'); queueSave();
  }
  async function fillFindingGps() {
    try {
      const c = await fixPreferWatch();
      const cr = PatrolGeo.toCRTM05(c.latitude, c.longitude);
      $('#fX').value = cr ? cr.x : ''; $('#fY').value = cr ? cr.y : '';
      toast('Posición actual aplicada al hallazgo.');
    } catch (e) { toast('No se pudo obtener la posición.'); }
  }

  // ---------- registro GPS continuo (patrullaje) ----------
  function togglePatrol() { state.patrolActive ? stopPatrol() : startPatrol(); }
  function startPatrol() {
    if (!navigator.geolocation) return toast('El dispositivo no ofrece geolocalización.');
    if (!state.report.tourDate) { state.report.tourDate = todayStr(); applyFormValue('tourDate', state.report.tourDate); }
    if (!state.report.startTime) { state.report.startTime = nowTime(); applyFormValue('startTime', state.report.startTime); }
    state.patrolActive = true;
    renderPatrolUI();
    toast('Registro GPS activo. Mantenga la app abierta para no perder puntos.');
    watchId = navigator.geolocation.watchPosition(pos => { lastWatchFix = { coords: pos.coords, at: Date.now() }; onFixWhilePatrolling(pos.coords); }, err => toast('GPS: ' + err.message), { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    pollTimer = setInterval(() => { fix({ maximumAge: 60000 }).then(c => onFixWhilePatrolling(c)).catch(() => {}); }, 60000);
    queueSave();
  }
  function stopPatrol() {
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null; clearInterval(pollTimer); lastWatchFix = null;
    state.patrolActive = false;
    if (!state.report.endTime) { state.report.endTime = nowTime(); applyFormValue('endTime', state.report.endTime); }
    renderPatrolUI();
    toast('Registro GPS detenido.');
    queueSave();
  }
  function onFixWhilePatrolling(c) {
    const last = state.track[state.track.length - 1];
    if (last) {
      const d = PatrolGeo.haversine(last, { lat: c.latitude, lon: c.longitude });
      const dt = (Date.now() - new Date(last.at).getTime()) / 1000;
      if (d < TRACK_MIN_METERS && dt < TRACK_MAX_SECONDS) return;
      addPoint(c, d >= TRACK_MIN_METERS ? 'distancia' : 'tiempo');
    } else addPoint(c, 'inicio');
  }
  function addPoint(c, reason) {
    const cr = PatrolGeo.toCRTM05(c.latitude, c.longitude);
    state.track.push({ id: uid('trk'), lat: c.latitude, lon: c.longitude, acc: Math.round(c.accuracy || 0), x: cr ? cr.x : null, y: cr ? cr.y : null, at: isoNow(), reason });
    renderTrackStats(); renderTrackList(); drawOfflineMap(); renderOnlineMapData(); queueSave();
  }
  async function markPoint() {
    try { const c = await fixPreferWatch(); addPoint(c, 'manual'); toast('Punto registrado.'); }
    catch (e) { toast('No se pudo registrar el punto.'); }
  }
  function removeTrackPoint(id) { state.track = state.track.filter(p => p.id !== id); renderTrackStats(); renderTrackList(); drawOfflineMap(); renderOnlineMapData(); queueSave(); }
  function trackMeters() { let m = 0; for (let i = 1; i < state.track.length; i++) m += PatrolGeo.haversine(state.track[i - 1], state.track[i]); return m; }
  function applyKm() {
    const km = trackMeters() / 1000;
    if (!km) return toast('Aún no hay recorrido registrado.');
    applyFormValue('kilometers', km.toFixed(1)); state.report.kilometers = km.toFixed(1);
    toast('Kilómetros actualizados: ' + km.toFixed(1) + ' km'); queueSave();
  }
  function renderPatrolUI() {
    $('#togglePatrolBtn').textContent = state.patrolActive ? 'Detener registro GPS' : 'Iniciar registro GPS';
    $('#togglePatrolBtn').classList.toggle('primary', !state.patrolActive);
    $('#togglePatrolBtn').classList.toggle('danger-outline', state.patrolActive);
    $('#patrolCard').classList.toggle('active', state.patrolActive);
    $('#recDot').classList.toggle('on', state.patrolActive);
  }
  function renderTrackStats() {
    $('#trackCount').textContent = state.track.length;
    $('#trackDistance').textContent = (trackMeters() / 1000).toFixed(2) + ' km';
    const t = state.track;
    const durMin = t.length > 1 ? (new Date(t[t.length - 1].at) - new Date(t[0].at)) / 60000 : 0;
    $('#trackDuration').textContent = durMin ? (durMin < 60 ? Math.round(durMin) + ' min' : Math.floor(durMin / 60) + ' h ' + Math.round(durMin % 60) + ' m') : '—';
    const last = t[t.length - 1];
    $('#patrolStatus').textContent = state.patrolActive ? 'Registrando. Mantenga la pantalla abierta para no perder puntos.' : (last ? 'Última marca: ' + fmtDateTime(last.at) : 'Sin puntos registrados.');
  }
  function renderTrackList() {
    const box = $('#trackList');
    if (!state.track.length) { box.innerHTML = ''; return; }
    box.innerHTML = state.track.map((p, i) => `<div class="list-item"><span class="index">${i + 1}</span><div class="body"><div class="title" style="color:var(--tx);font-variant-numeric:tabular-nums">${escapeHtml(PatrolGeo.fmtCRTM(p))}</div><div class="meta">${escapeHtml(fmtDateTime(p.at))} · ±${p.acc} m · ${escapeHtml(p.reason)}</div></div><button type="button" class="btn small danger-outline" data-rm-track="${p.id}">Quitar</button></div>`).join('');
    $$('[data-rm-track]', box).forEach(b => b.addEventListener('click', () => removeTrackPoint(b.dataset.rmTrack)));
  }

  // ---------- mapa offline (cuadrícula CRTM05) ----------
  function drawOfflineMap() {
    const cv = $('#offlineMap');
    if (!cv || !cv.clientWidth) return;
    $('#offlineMapEmpty').style.display = state.track.length ? 'none' : 'grid';
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 280;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(document.body);
    const surf = cs.getPropertyValue('--surface2').trim() || '#131C17';
    const bd = cs.getPropertyValue('--bd').trim() || '#2A3830';
    const acc = cs.getPropertyValue('--g').trim() || '#48A97A';
    const mut = cs.getPropertyValue('--muted').trim() || '#8FA095';
    g.fillStyle = surf; g.fillRect(0, 0, W, H);
    const t = state.track.filter(p => p.x != null && p.y != null), b = state.bounds;
    let xmin, xmax, ymin, ymax;
    if (b) { xmin = b.xmin; xmax = b.xmax; ymin = b.ymin; ymax = b.ymax; }
    else if (t.length) {
      xmin = Math.min(...t.map(p => p.x)); xmax = Math.max(...t.map(p => p.x));
      ymin = Math.min(...t.map(p => p.y)); ymax = Math.max(...t.map(p => p.y));
      const padx = Math.max(120, (xmax - xmin) * 0.2), pady = Math.max(120, (ymax - ymin) * 0.2);
      xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
    } else {
      g.strokeStyle = bd; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(W / 6 * i, 0); g.lineTo(W / 6 * i, H); g.stroke(); }
      return;
    }
    const spanX = xmax - xmin || 1, spanY = ymax - ymin || 1;
    const sc = Math.min(W / spanX, H / spanY);
    const offX = (W - spanX * sc) / 2, offY = (H - spanY * sc) / 2;
    const px = p => offX + (p.x - xmin) * sc, py = p => H - offY - (p.y - ymin) * sc;
    if (state.basemapKey && b && basemapImg) {
      g.drawImage(basemapImg, offX, offY, spanX * sc, spanY * sc);
    } else {
      g.strokeStyle = bd; g.lineWidth = 1;
      for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo(W / 5 * i, 0); g.lineTo(W / 5 * i, H); g.stroke(); g.beginPath(); g.moveTo(0, H / 5 * i); g.lineTo(W, H / 5 * i); g.stroke(); }
    }
    t.forEach((p, i) => {
      const X = px(p), Y = py(p);
      g.beginPath(); g.arc(X, Y, 7, 0, 6.2832);
      g.fillStyle = i === t.length - 1 ? acc : 'rgba(72,169,122,.55)'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = '#fff'; g.font = '600 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), X, Y);
    });
    const barM = spanX > 4000 ? 1000 : spanX > 1200 ? 500 : 100, barPx = barM * sc;
    g.strokeStyle = mut; g.lineWidth = 2; g.beginPath(); g.moveTo(12, H - 16); g.lineTo(12 + barPx, H - 16); g.stroke();
    g.fillStyle = mut; g.font = '600 10px system-ui'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(barM >= 1000 ? (barM / 1000) + ' km' : barM + ' m', 12, H - 20);
  }
  function updateMapCaption() {
    $('#mapCaption').textContent = state.basemapKey && state.bounds ? 'Mapa base georreferenciado activo.' : (state.basemapKey ? 'Cargue las cuatro esquinas CRTM05 para ubicar el mapa base.' : 'Puntos sobre cuadrícula CRTM05. Puede cargar un mapa base descargado.');
  }
  function onBoundsInput() {
    const n = k => { const e = $('#' + k); return e && e.value !== '' ? Number(e.value) : null; };
    const b = { xmin: n('bmXmin'), xmax: n('bmXmax'), ymin: n('bmYmin'), ymax: n('bmYmax') };
    state.bounds = Object.values(b).every(v => v != null) ? b : null;
    updateMapCaption(); drawOfflineMap(); queueSave();
  }
  async function onBasemapFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    await PatrolStore.put('basemap', f);
    state.basemapKey = 'basemap';
    basemapImg = await blobToImage(f);
    updateMapCaption(); drawOfflineMap(); queueSave();
    toast('Mapa base guardado en el dispositivo.');
  }
  async function clearBasemap() {
    await PatrolStore.del('basemap').catch(() => {});
    state.basemapKey = null; basemapImg = null;
    updateMapCaption(); drawOfflineMap(); queueSave();
  }
  function blobToImage(blob) {
    return new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.src = URL.createObjectURL(blob); });
  }

  // ---------- mapa en línea (Leaflet, opcional) ----------
  function initOnlineMap() {
    if (onlineMapReady) return;
    onlineMapReady = true;
    if (!window.L) { $('#onlineMapFallback').classList.remove('hidden'); return; }
    onlineMap = L.map('onlineMap', { zoomControl: true }).setView([9.6, -83.9], 9);
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors' });
    const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });
    const labels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri reference' });
    osm.addTo(onlineMap);
    L.control.layers({ 'OSM': osm, 'Imagen aérea + etiquetas': L.layerGroup([imagery, labels]) }, null, { collapsed: false }).addTo(onlineMap);
    onlineTrackLine = L.polyline([], { weight: 5, opacity: .85 }).addTo(onlineMap);
    onlineObsLayer = L.layerGroup().addTo(onlineMap);
    renderOnlineMapData();
    setTimeout(() => onlineMap.invalidateSize(), 80);
  }
  function renderOnlineMapData(fit) {
    if (!onlineMap) return;
    const latlngs = state.track.map(p => [p.lat, p.lon]);
    onlineTrackLine.setLatLngs(latlngs);
    onlineObsLayer.clearLayers();
    state.findings.forEach((o, i) => {
      if (o.lat == null || o.lon == null) return;
      onlineObsLayer.addLayer(L.marker([o.lat, o.lon]).bindPopup(`<strong>${i + 1}. ${escapeHtml(window.SINAC_REPORT.findingLabel(o))}</strong><br>${escapeHtml(o.desc || '')}`));
    });
    if (fit && latlngs.length) onlineMap.fitBounds(latlngs, { padding: [30, 30], maxZoom: 17 });
  }

  // ---------- contactos ----------
  function gv(id) { const e = $('#' + id); return e ? e.value.trim() : ''; }
  function clr(ids) { ids.forEach(i => { const e = $('#' + i); if (e) e.value = ''; }); }
  function addContact() {
    const name = gv('cName');
    if (!name) return toast('Indique el nombre de la persona.');
    state.contacts.push({ id: uid('ct'), name, idn: gv('cId'), role: $('#cRole').value, phone: gv('cPhone'), address: gv('cAddress'), note: gv('cNote') });
    clr(['cName', 'cId', 'cPhone', 'cAddress', 'cNote']);
    renderContacts(); queueSave();
  }
  function removeContact(id) { state.contacts = state.contacts.filter(x => x.id !== id); renderContacts(); queueSave(); }
  function renderContacts() {
    const box = $('#contactList');
    box.innerHTML = state.contacts.map(c => `<div class="list-item"><div class="body"><div class="title">${escapeHtml(c.name)} · ${escapeHtml(c.role)}</div><div class="meta">ID ${escapeHtml(c.idn || '—')} · Tel ${escapeHtml(c.phone || '—')}${c.note ? ' · ' + escapeHtml(c.note) : ''}</div></div><button type="button" class="btn small danger-outline" data-rm-contact="${c.id}">Quitar</button></div>`).join('');
    $$('[data-rm-contact]', box).forEach(b => b.addEventListener('click', () => removeContact(b.dataset.rmContact)));
  }

  // ---------- acompañantes ----------
  function addCompanion() {
    const name = gv('compName');
    if (!name) return toast('Indique el nombre del acompañante.');
    state.companions.push({ id: uid('cp'), name, role: gv('compRole') });
    clr(['compName', 'compRole']);
    renderCompanions(); queueSave();
  }
  function removeCompanion(id) { state.companions = state.companions.filter(x => x.id !== id); renderCompanions(); queueSave(); }
  function renderCompanions() {
    const box = $('#companionList');
    box.innerHTML = state.companions.map(c => `<div class="list-item"><div class="body"><div class="title">${escapeHtml(c.name)}</div><div class="meta">${escapeHtml(c.role || '')}</div></div><button type="button" class="btn small danger-outline" data-rm-comp="${c.id}">Quitar</button></div>`).join('');
    $$('[data-rm-comp]', box).forEach(b => b.addEventListener('click', () => removeCompanion(b.dataset.rmComp)));
  }

  // ---------- hallazgos ----------
  function selectFindingCategory(cat, clearDependent = true) {
    $('#sitadaFields').classList.toggle('hidden', cat !== 'Daño ambiental');
    $('#fSubtypeWrap').classList.toggle('hidden', !['Vigilancia', 'Monitoreo'].includes(cat));
    $('#fOtherWrap').classList.toggle('hidden', cat !== 'Otro');
    $$('.chip[data-fcat]').forEach(b => b.classList.toggle('on', b.dataset.fcat === cat));
    if (['Vigilancia', 'Monitoreo'].includes(cat)) {
      const arr = cat === 'Vigilancia' ? C.vigilancia : C.monitoreo;
      const old = clearDependent ? '' : $('#fSubtype').value;
      $('#fSubtype').innerHTML = '<option value="">Seleccione…</option>' + arr.map(v => `<option>${escapeHtml(v)}</option>`).join('');
      if (old) $('#fSubtype').value = old;
    }
    if (clearDependent) { $('#fSitadaType').value = ''; $('#fSitadaInfraction').value = ''; $('#fSubtype').value = ''; $('#fOtherType').value = ''; }
  }
  function clearFindingForm() {
    editingFindingId = null; pendingFindingPhotoBlobs = [null, null, null];
    $$('.chip[data-fcat]').forEach(b => b.classList.remove('on'));
    $('#sitadaFields').classList.add('hidden'); $('#fSubtypeWrap').classList.add('hidden'); $('#fOtherWrap').classList.add('hidden');
    $('#fSitadaType').value = ''; $('#fSitadaInfraction').value = ''; $('#fSubtype').innerHTML = ''; $('#fOtherType').value = '';
    $('#fX').value = ''; $('#fY').value = ''; $('#fDesc').value = ''; $('#fAction').value = '';
    $('#addFindingBtn').textContent = 'Agregar hallazgo';
    renderFindingPhotoSlots([]);
  }
  async function renderFindingPhotoSlots(existingPhotos) {
    const grid = $('#findingPhotoGrid'); grid.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const p = existingPhotos[i]; let url = '';
      if (p) { const blob = await PatrolStore.get(p.key).catch(() => null); if (blob) url = URL.createObjectURL(blob); }
      grid.appendChild(buildPhotoSlot(i, url, p, blob => { pendingFindingPhotoBlobs[i] = blob; }));
    }
  }
  function buildPhotoSlot(i, url, existing, onPick) {
    const slot = document.createElement('div'); slot.className = 'photo-slot';
    const camId = `cam-${i}-${Math.random().toString(36).slice(2, 7)}`, galId = `gal-${i}-${Math.random().toString(36).slice(2, 7)}`;
    slot.innerHTML = `<img class="${url ? '' : 'hidden'}" ${url ? `src="${url}"` : ''} alt="Vista previa"><div class="hint">${url ? 'Fotografía guardada' : 'Sin fotografía'}</div><div class="slot-actions"><label class="photo-action-label" for="${camId}">Tomar foto</label><label class="photo-action-label" for="${galId}">Galería</label></div><input id="${camId}" class="photo-file" type="file" accept="image/*" capture="environment"><input id="${galId}" class="photo-file" type="file" accept="image/*"><input type="text" maxlength="180" placeholder="Descripción opcional" value="${escapeAttr(existing?.caption || '')}"><button type="button" class="btn small danger-outline photo-remove-btn ${existing || url ? '' : 'hidden'}">Quitar</button>`;
    const files = [slot.querySelector(`#${camId}`), slot.querySelector(`#${galId}`)], img = slot.querySelector('img'), hint = slot.querySelector('.hint'), rm = slot.querySelector('.photo-remove-btn');
    const ingest = async fileInput => {
      if (!fileInput.files[0]) return;
      const blob = await compressImage(fileInput.files[0]);
      onPick(blob);
      img.src = URL.createObjectURL(blob); img.classList.remove('hidden'); hint.textContent = 'Nueva fotografía'; rm.classList.remove('hidden');
    };
    files.forEach(f => f.addEventListener('change', () => ingest(f)));
    rm.addEventListener('click', () => { onPick('REMOVE'); img.src = ''; img.classList.add('hidden'); hint.textContent = 'Sin fotografía'; rm.classList.add('hidden'); files.forEach(f => f.value = ''); });
    return slot;
  }
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600, scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('No se pudo procesar la imagen')); }, 'image/jpeg', .82);
      };
      img.onerror = reject; img.src = url;
    });
  }
  async function addOrSaveFinding() {
    const activeChip = $('.chip[data-fcat].on');
    const category = activeChip ? activeChip.dataset.fcat : '';
    const desc = $('#fDesc').value.trim();
    if (!category) return toast('Seleccione la categoría del hallazgo.');
    if (!desc) return toast('Escriba una descripción.');
    if (category === 'Daño ambiental' && !$('#fSitadaType').value) return toast('Seleccione el tipo de denuncia SITADA.');
    if (['Vigilancia', 'Monitoreo'].includes(category) && !$('#fSubtype').value) return toast('Seleccione el subtipo.');
    if (category === 'Otro' && !$('#fOtherType').value.trim()) return toast('Indique el tipo o motivo.');
    const existing = editingFindingId ? state.findings.find(x => x.id === editingFindingId) : null;
    const f = existing ? { ...existing } : { id: uid('fnd'), photos: [], createdAt: isoNow() };
    f.category = category; f.sitadaType = $('#fSitadaType').value; f.sitadaInfraction = $('#fSitadaInfraction').value.trim();
    f.subtype = $('#fSubtype').value; f.otherType = $('#fOtherType').value.trim();
    f.x = $('#fX').value; f.y = $('#fY').value; f.desc = desc; f.action = $('#fAction').value.trim();
    if (state.gps && !f.lat) { f.lat = state.gps.lat; f.lon = state.gps.lon; }
    const newPhotos = [];
    for (let i = 0; i < 3; i++) {
      const existingPhoto = f.photos[i]; const pending = pendingFindingPhotoBlobs[i];
      const captionInput = $('#findingPhotoGrid').children[i]?.querySelector('input[type=text]');
      const caption = captionInput ? captionInput.value.trim() : '';
      if (pending === 'REMOVE') { if (existingPhoto) await PatrolStore.del(existingPhoto.key).catch(() => {}); continue; }
      if (pending instanceof Blob) { if (existingPhoto) await PatrolStore.del(existingPhoto.key).catch(() => {}); const key = uid(`fphoto-${f.id}`); await PatrolStore.put(key, pending); newPhotos.push({ key, caption }); }
      else if (existingPhoto) newPhotos.push({ ...existingPhoto, caption });
    }
    f.photos = newPhotos;
    if (existing) state.findings = state.findings.map(x => x.id === f.id ? f : x); else state.findings.push(f);
    clearFindingForm(); renderFindings(); renderOnlineMapData(); queueSave();
    toast(existing ? 'Hallazgo actualizado.' : 'Hallazgo agregado.');
  }
  function editFinding(id) {
    const f = state.findings.find(x => x.id === id); if (!f) return;
    editingFindingId = id;
    selectFindingCategory(f.category, false);
    $('#fSitadaType').value = f.sitadaType || ''; $('#fSitadaInfraction').value = f.sitadaInfraction || '';
    if (f.subtype) $('#fSubtype').value = f.subtype;
    $('#fOtherType').value = f.otherType || ''; $('#fX').value = f.x || ''; $('#fY').value = f.y || '';
    $('#fDesc').value = f.desc || ''; $('#fAction').value = f.action || '';
    $('#addFindingBtn').textContent = 'Guardar cambios';
    renderFindingPhotoSlots(f.photos || []);
    goTab('campo'); document.getElementById('fDesc').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function removeFinding(id) {
    const f = state.findings.find(x => x.id === id); if (!f || !confirm('¿Eliminar este hallazgo y sus fotografías?')) return;
    for (const p of f.photos) await PatrolStore.del(p.key).catch(() => {});
    state.findings = state.findings.filter(x => x.id !== id);
    if (editingFindingId === id) clearFindingForm();
    renderFindings(); renderOnlineMapData(); queueSave();
  }
  function renderFindings() {
    const box = $('#findingList');
    if (!state.findings.length) { box.innerHTML = '<div class="empty-state">Aún no hay hallazgos registrados.</div>'; return; }
    box.innerHTML = state.findings.map((f, i) => `<div class="list-item"><span class="index">${i + 1}</span><div class="body"><div class="title">${escapeHtml(window.SINAC_REPORT.findingLabel(f))}</div><div class="meta">${escapeHtml((f.desc || '').slice(0, 140))}${(f.desc || '').length > 140 ? '…' : ''} ${f.x || f.y ? '· CRTM05 ' + escapeHtml(f.x || '—') + ' / ' + escapeHtml(f.y || '—') : ''} · ${f.photos.length} foto(s)</div></div><div style="display:flex;flex-direction:column;gap:6px"><button type="button" class="btn small ghost" data-edit-finding="${f.id}">Editar</button><button type="button" class="btn small danger-outline" data-rm-finding="${f.id}">Quitar</button></div></div>`).join('');
    $$('[data-edit-finding]', box).forEach(b => b.addEventListener('click', () => editFinding(b.dataset.editFinding)));
    $$('[data-rm-finding]', box).forEach(b => b.addEventListener('click', () => removeFinding(b.dataset.rmFinding)));
  }

  // ---------- fotografías generales ----------
  async function onGeneralPhotos(e) {
    const files = [...e.target.files];
    let coords = null;
    try { const c = await fixPreferWatch({ timeout: 8000, maximumAge: 120000 }); coords = { lat: c.latitude, lon: c.longitude }; } catch (_) {}
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const blob = await compressImage(file);
      const key = uid('gphoto');
      await PatrolStore.put(key, blob);
      const g = coords || (state.gps ? { lat: state.gps.lat, lon: state.gps.lon } : null);
      const cr = g ? PatrolGeo.toCRTM05(g.lat, g.lon) : null;
      state.generalPhotos.push({ id: uid('gp'), key, caption: '', addedAt: isoNow(), lat: g ? g.lat : null, lon: g ? g.lon : null, x: cr ? cr.x : null, y: cr ? cr.y : null });
    }
    e.target.value = '';
    renderGeneralPhotos(); queueSave();
  }
  function setGeneralCaption(id, v) { const p = state.generalPhotos.find(x => x.id === id); if (p) { p.caption = v; queueSave(); } }
  async function removeGeneralPhoto(id) {
    const p = state.generalPhotos.find(x => x.id === id); if (!p) return;
    await PatrolStore.del(p.key).catch(() => {});
    state.generalPhotos = state.generalPhotos.filter(x => x.id !== id);
    renderGeneralPhotos(); queueSave();
  }
  async function renderGeneralPhotos() {
    const grid = $('#generalPhotoGrid'); grid.innerHTML = '';
    for (const p of state.generalPhotos) {
      const blob = await PatrolStore.get(p.key).catch(() => null);
      const url = blob ? URL.createObjectURL(blob) : '';
      const card = document.createElement('div'); card.className = 'photo-card';
      card.innerHTML = `<div class="photo-thumb" style="${url ? `background-image:url(${url})` : ''}"></div><div class="photo-body"><div class="row"><strong>${p.x != null ? 'CRTM05 ' + Number(p.x).toLocaleString('es-CR') + ' E / ' + Number(p.y).toLocaleString('es-CR') + ' N' : 'Sin geoetiqueta'}</strong><button type="button" class="btn small danger-outline">Quitar</button></div><textarea placeholder="Descripción de la fotografía…">${escapeHtml(p.caption || '')}</textarea><div class="meta">${escapeHtml(fmtDateTime(p.addedAt))}</div></div>`;
      card.querySelector('button').addEventListener('click', () => removeGeneralPhoto(p.id));
      card.querySelector('textarea').addEventListener('change', e => setGeneralCaption(p.id, e.target.value));
      grid.appendChild(card);
    }
  }

  // ---------- vista previa / reporte ----------
  function buildReportForm() {
    const fd = formData();
    return Object.assign({}, fd, {
      lugarSalida: state.lugarSalida === 'Otro' ? state.lugarSalidaOtro : state.lugarSalida,
      lugarRegreso: state.lugarRegreso === 'Otro' ? state.lugarRegresoOtro : state.lugarRegreso,
      encargadoNombre: getPersonName(state.encargado),
      personalNombres: state.personnel.filter(id => id !== state.encargado).map(getPersonName),
      vehiculoLabel: getVehicleLabel(state.vehiculo),
      odometroInicial: state.odometroInicial, odometroFinal: state.odometroFinal,
      combustibleInicial: state.combustibleInicial, combustibleFinal: state.combustibleFinal,
      actions: state.actions, results: state.results, evidence: state.evidence,
      ACTIONS: C.acciones, RESULTS: C.resultados, EVIDENCE: C.evidenciaGeneral,
      latitude: state.gps ? state.gps.lat.toFixed(7) : '', longitude: state.gps ? state.gps.lon.toFixed(7) : '', gpsAccuracy: state.gps ? Math.round(state.gps.acc) : ''
    });
  }
  async function resolvedFindings() {
    const out = [];
    for (const f of state.findings) {
      const photos = [];
      for (const p of f.photos) { const blob = await PatrolStore.get(p.key).catch(() => null); if (blob) photos.push({ dataUrl: await blobToDataURL(blob), caption: p.caption }); }
      out.push(Object.assign({}, f, { photos }));
    }
    return out;
  }
  async function resolvedGeneralPhotos() {
    const out = [];
    for (const p of state.generalPhotos) { const blob = await PatrolStore.get(p.key).catch(() => null); if (blob) out.push(Object.assign({}, p, { dataUrl: await blobToDataURL(blob) })); }
    return out;
  }
  function blobToDataURL(blob) { return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); }
  function allowanceRows() { return participantIds().map(id => Object.assign({ name: getPersonName(id) }, state.allowances[id] || {})); }

  async function reportState() {
    return { contacts: state.contacts, findings: await resolvedFindings(), companions: state.companions, generalPhotos: await resolvedGeneralPhotos(), track: state.track, allowances: allowanceRows() };
  }

  let previewSeq = 0;
  async function renderPreview() {
    const seq = ++previewSeq;
    const f = buildReportForm(); const rs = await reportState();
    if (seq !== previewSeq) return;
    $('#summaryPreview').innerHTML = summaryHTML(f, rs);
    $('#paperPreview').innerHTML = window.SINAC_REPORT.reportHTML(f, rs);
  }
  function summaryHTML(f, s) {
    const row = (k, v) => v ? `<div class="summary-row"><span class="k">${k}</span><span class="v">${escapeHtml(v)}</span></div>` : '';
    const head = t => `<h4 class="summary-head">${t}</h4>`;
    let h = head('Identificación');
    h += row('Fecha de informe', window.SINAC_REPORT.fmtDate(f.reportDate)) + row('N.º informe', f.reportNumber) + row('ASP', f.asp) + row('Destinatario', f.recipient) + row('Actividad', f.activity);
    h += head('Gira');
    h += row('Fecha de gira', window.SINAC_REPORT.fmtDate(f.tourDate)) + row('Horario', (f.startTime || '') + (f.endTime ? ' – ' + f.endTime : '')) + row('Kilómetros', f.kilometers) + row('Viáticos', window.SINAC_REPORT.viaticosText(s.allowances));
    h += head('Personal y vehículo');
    h += row('Encargado', f.encargadoNombre) + row('Personal participante', f.personalNombres.join(', ')) + row('Vehículo', f.vehiculoLabel) + row('Lugar de salida', f.lugarSalida) + row('Lugar de regreso', f.lugarRegreso);
    h += head('Ubicación');
    h += row('Lugar', [f.province, f.canton, f.district, f.hamlet].filter(Boolean).join(' · ')) + row('Dirección', f.exactAddress) + row('CRTM05', (f.crtmX || '') + (f.crtmY ? ' E / ' + f.crtmY + ' N' : ''));
    h += head('Marcado');
    h += row('Acción', f.actions.join(', ') || '—') + row('Resultados', f.results.join(', ') || '—') + row('Evidencia', f.evidence.join(', ') || '—');
    h += head('Recorrido');
    h += row('Puntos registrados', String(state.track.length)) + row('Distancia GPS', (trackMeters() / 1000).toFixed(2) + ' km');
    h += head('Campo');
    h += row('Personas', String(s.contacts.length)) + row('Hallazgos', String(s.findings.length)) + row('Fotografías', String(s.generalPhotos.length + s.findings.reduce((n, x) => n + x.photos.length, 0))) + row('Acompañantes', String(s.companions.length));
    if (f.resultsNarrative) h += head('Descripción de resultados') + `<p class="summary-text">${escapeHtml(f.resultsNarrative)}</p>`;
    if (f.recommendations) h += head('Recomendaciones') + `<p class="summary-text">${escapeHtml(f.recommendations)}</p>`;
    h += head('Cierre') + row('Responsable', f.responsibleName) + row('Cargo', f.responsiblePosition) + row('Firma', f.signatureText) + row('CC', f.cc);
    return h;
  }
  function missingEssentials() { return $$('#patrolForm [data-essential]').filter(e => !String(e.value || '').trim()); }

  async function genWord() {
    const missing = missingEssentials();
    if (missing.length) return toast(`Faltan ${missing.length} campos obligatorios.`);
    $('#genWordBtn').textContent = 'Generando…'; $('#genWordBtn').disabled = true;
    try { await window.SINAC_REPORT.buildDocx(buildReportForm(), await reportState()); toast('Documento Word generado.'); }
    catch (e) { toast('No fue posible generar el Word: ' + e.message); }
    $('#genWordBtn').textContent = 'Generar Word (.docx)'; $('#genWordBtn').disabled = false;
  }
  async function shareReport() {
    const f = buildReportForm();
    const text = `Informe de gira ${f.reportNumber || ''}\n${f.asp || ''}\nFecha: ${f.tourDate || ''}\nPuntos GPS: ${state.track.length} · ${(trackMeters() / 1000).toFixed(2)} km`;
    try {
      if (navigator.share) await navigator.share({ title: 'Informe de gira SINAC', text });
      else { await navigator.clipboard.writeText(text); toast('Resumen copiado al portapapeles.'); }
    } catch (_) {}
  }
  async function exportJson() {
    const payload = { app: 'SINAC-ACC-BTMM-Patrullajes', version: 4, exportedAt: isoNow(), state, resolved: { findings: await resolvedFindings(), generalPhotos: await resolvedGeneralPhotos() } };
    window.SINAC_REPORT.download(`Borrador_Patrullaje_${state.report.tourDate || 'sf'}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    toast('Borrador JSON exportado.');
  }
  function exportGeoJson() {
    const features = [];
    if (state.track.length) features.push({ type: 'Feature', properties: { kind: 'track', patrolId: state.id }, geometry: { type: 'LineString', coordinates: state.track.map(p => [p.lon, p.lat]) } });
    state.findings.filter(o => o.lat != null).forEach((o, i) => features.push({ type: 'Feature', properties: { kind: 'finding', number: i + 1, label: window.SINAC_REPORT.findingLabel(o), description: o.desc, crtmE: o.x, crtmN: o.y }, geometry: { type: 'Point', coordinates: [o.lon, o.lat] } }));
    window.SINAC_REPORT.download(`${state.id}.geojson`, new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' }));
  }
  async function importJsonFile(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try {
      const text = await file.text(); const data = JSON.parse(text);
      if (data.app !== 'SINAC-ACC-BTMM-Patrullajes') throw new Error('El archivo no corresponde a este formulario.');
      state = Object.assign(blankState(), data.state);
      await hydrateFromImport(data.resolved);
      saveState(); boot(true);
      toast('Borrador importado.');
    } catch (err) { toast('No se pudo importar: ' + err.message); }
    e.target.value = '';
  }
  async function hydrateFromImport(resolved) {
    if (!resolved) return;
    for (const f of resolved.findings || []) {
      const findingState = state.findings.find(x => x.id === f.id); if (!findingState) continue;
      const photos = [];
      for (const p of f.photos || []) { if (!p.dataUrl) continue; const key = uid(`fphoto-${f.id}`); photos.push({ key, caption: p.caption }); await PatrolStore.put(key, await (await fetch(p.dataUrl)).blob()); }
      findingState.photos = photos;
    }
    for (const p of resolved.generalPhotos || []) {
      const gp = state.generalPhotos.find(x => x.id === p.id); if (!gp || !p.dataUrl) continue;
      const key = uid('gphoto'); gp.key = key; await PatrolStore.put(key, await (await fetch(p.dataUrl)).blob());
    }
  }

  async function resetApp() {
    if (!confirm('Esto eliminará el patrullaje actual y sus fotografías. Los catálogos de personal y vehículos se conservarán.')) return;
    if (watchId != null) navigator.geolocation.clearWatch(watchId); clearInterval(pollTimer);
    for (const f of state.findings) for (const p of f.photos) await PatrolStore.del(p.key).catch(() => {});
    for (const p of state.generalPhotos) await PatrolStore.del(p.key).catch(() => {});
    const theme = state.theme;
    state = blankState(); state.theme = theme;
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    boot(true);
  }

  // ---------- wiring ----------
  function wireEvents() {
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));
    $('#themeBtn').addEventListener('click', () => setTheme(document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));

    $$('#patrolForm [name]').forEach(el => {
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => { queueSave(); updateProgress(); if (currentTab === 'informe') renderPreview(); });
    });
    $('#lugarSalida').addEventListener('change', () => { state.lugarSalida = $('#lugarSalida').value; toggleOtherPlace('salida'); queueSave(); });
    $('#lugarSalidaOtro').addEventListener('input', () => { state.lugarSalidaOtro = $('#lugarSalidaOtro').value; queueSave(); });
    $('#lugarRegreso').addEventListener('change', () => { state.lugarRegreso = $('#lugarRegreso').value; toggleOtherPlace('regreso'); queueSave(); });
    $('#lugarRegresoOtro').addEventListener('input', () => { state.lugarRegresoOtro = $('#lugarRegresoOtro').value; queueSave(); });

    $('#encargado').addEventListener('change', () => { state.encargado = $('#encargado').value; renderPersonnelPills(); renderAllowances(); if (!state.responsibleName) applyFormValue('responsibleName', getPersonName(state.encargado)); queueSave(); });
    $('#vehiculo').addEventListener('change', () => { state.vehiculo = $('#vehiculo').value; queueSave(); });
    $('#addPersonBtn').addEventListener('click', addPerson);
    $('#addVehicleBtn').addEventListener('click', addVehicle);
    ['odometroInicial', 'odometroFinal', 'combustibleInicial', 'combustibleFinal'].forEach(id => $('#' + id).addEventListener('input', () => { state[id] = $('#' + id).value; queueSave(); }));
    $('#vehiculoCheckInicio').addEventListener('change', () => { state.vehiculoCheckInicio = $('#vehiculoCheckInicio').checked; queueSave(); });
    $('#vehiculoCheckFin').addEventListener('change', () => { state.vehiculoCheckFin = $('#vehiculoCheckFin').checked; queueSave(); });

    $('#captureGpsBtn').addEventListener('click', captureGps);
    $('#useGpsAsCrtmBtn').addEventListener('click', useGpsAsCrtm);
    $('#togglePatrolBtn').addEventListener('click', togglePatrol);
    $('#markPointBtn').addEventListener('click', markPoint);
    $('#applyKmBtn').addEventListener('click', applyKm);
    $('#basemapFile').addEventListener('change', onBasemapFile);
    $('#clearBasemapBtn').addEventListener('click', clearBasemap);
    ['bmXmin', 'bmXmax', 'bmYmin', 'bmYmax'].forEach(id => $('#' + id).addEventListener('input', onBoundsInput));
    $('#fitOnlineMapBtn').addEventListener('click', () => renderOnlineMapData(true));
    $$('details').forEach(d => d.addEventListener('toggle', () => { if (d.open && d.querySelector('#onlineMap')) initOnlineMap(); }));

    $('#addContactBtn').addEventListener('click', addContact);
    $('#addCompanionBtn').addEventListener('click', addCompanion);
    $$('.chip[data-fcat]').forEach(b => b.addEventListener('click', () => selectFindingCategory(b.dataset.fcat, true)));
    $('#fillFindingGpsBtn').addEventListener('click', fillFindingGps);
    $('#addFindingBtn').addEventListener('click', addOrSaveFinding);
    $('#photoInput').addEventListener('change', onGeneralPhotos);

    $('#genWordBtn').addEventListener('click', genWord);
    $('#shareBtn').addEventListener('click', shareReport);
    $('#exportJsonBtn').addEventListener('click', exportJson);
    $('#exportGeoJsonBtn').addEventListener('click', exportGeoJson);
    $('#importJsonBtn').addEventListener('click', () => $('#jsonFileInput').click());
    $('#jsonFileInput').addEventListener('change', importJsonFile);
    $('#resetBtn').addEventListener('click', resetApp);

    window.addEventListener('beforeunload', saveState);
  }

  function formSyncFromState() {
    applyFormValue('reportDate', state.report.reportDate); applyFormValue('reportNumber', state.report.reportNumber); applyFormValue('asp', state.report.asp);
    applyFormValue('recipient', state.report.recipient); applyFormValue('activity', state.report.activity); applyFormValue('tourDate', state.report.tourDate);
    applyFormValue('startTime', state.report.startTime); applyFormValue('endTime', state.report.endTime); applyFormValue('kilometers', state.report.kilometers);
    $('#lugarSalida').value = state.lugarSalida; $('#lugarRegreso').value = state.lugarRegreso;
    applyFormValue('lugarSalidaOtro', state.lugarSalidaOtro); applyFormValue('lugarRegresoOtro', state.lugarRegresoOtro);
    toggleOtherPlace('salida'); toggleOtherPlace('regreso');
    $('#odometroInicial').value = state.odometroInicial ?? ''; $('#odometroFinal').value = state.odometroFinal ?? '';
    $('#combustibleInicial').value = state.combustibleInicial; $('#combustibleFinal').value = state.combustibleFinal;
    $('#vehiculoCheckInicio').checked = state.vehiculoCheckInicio; $('#vehiculoCheckFin').checked = state.vehiculoCheckFin;
    applyFormValue('actionOther', state.actionOther); applyFormValue('resultOther', state.resultOther); applyFormValue('evidenceOther', state.evidenceOther);
    applyFormValue('province', state.location.province); applyFormValue('canton', state.location.canton); applyFormValue('district', state.location.district);
    applyFormValue('hamlet', state.location.hamlet); applyFormValue('exactAddress', state.location.exactAddress); applyFormValue('mapSheet', state.location.mapSheet);
    applyFormValue('crtmX', state.location.crtmX); applyFormValue('crtmY', state.location.crtmY);
    applyFormValue('routeDescription', state.routeDescription);
    applyFormValue('resultsNarrative', state.resultsNarrative); applyFormValue('recommendations', state.recommendations);
    applyFormValue('responsibleName', state.responsibleName); applyFormValue('responsibleId', state.responsibleId); applyFormValue('responsiblePosition', state.responsiblePosition);
    applyFormValue('signatureText', state.signatureText); applyFormValue('cc', state.cc); applyFormValue('unit', state.unit);
    if (state.gps) { applyFormValue('latitude', state.gps.lat.toFixed(7)); applyFormValue('longitude', state.gps.lon.toFixed(7)); applyFormValue('gpsAccuracy', Math.round(state.gps.acc)); $('#gpsCrtm').textContent = PatrolGeo.fmtCRTM(state.gps); $('#gpsMeta').textContent = 'Última captura: ' + fmtDateTime(state.gps.at); }
    if (state.bounds) { $('#bmXmin').value = state.bounds.xmin; $('#bmXmax').value = state.bounds.xmax; $('#bmYmin').value = state.bounds.ymin; $('#bmYmax').value = state.bounds.ymax; }
  }
  function syncStateFromFormOnLoad() {
    // Reflect flat form fields the user may have typed before a debounce tick back into state on every save.
    const fd = formData();
    state.report.reportDate = fd.reportDate; state.report.reportNumber = fd.reportNumber; state.report.asp = fd.asp; state.report.recipient = fd.recipient;
    state.report.activity = fd.activity; state.report.tourDate = fd.tourDate; state.report.startTime = fd.startTime; state.report.endTime = fd.endTime; state.report.kilometers = fd.kilometers;
    state.actionOther = fd.actionOther; state.resultOther = fd.resultOther; state.evidenceOther = fd.evidenceOther;
    state.location.province = fd.province; state.location.canton = fd.canton; state.location.district = fd.district; state.location.hamlet = fd.hamlet;
    state.location.exactAddress = fd.exactAddress; state.location.mapSheet = fd.mapSheet; state.location.crtmX = fd.crtmX; state.location.crtmY = fd.crtmY;
    state.routeDescription = fd.routeDescription; state.resultsNarrative = fd.resultsNarrative; state.recommendations = fd.recommendations;
    state.responsibleName = fd.responsibleName; state.responsibleId = fd.responsibleId; state.responsiblePosition = fd.responsiblePosition;
    state.signatureText = fd.signatureText; state.cc = fd.cc; state.unit = fd.unit;
  }

  async function boot(isReset) {
    populateStaticSelects();
    renderCatalogs();
    formSyncFromState();
    renderChipState();
    renderContacts(); renderCompanions(); renderFindings();
    renderTrackStats(); renderTrackList();
    updateMapCaption();
    renderPatrolUI();
    updateProgress();
    await renderGeneralPhotos();
    clearFindingForm();
    if (state.basemapKey) { const blob = await PatrolStore.get(state.basemapKey).catch(() => null); if (blob) basemapImg = await blobToImage(blob); }
    goTab(isReset ? 'gira' : currentTab);
    setTimeout(drawOfflineMap, 60);
    if (state.patrolActive) startPatrol();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem(LS_THEME) || 'dark';
    setTheme(theme);
    if (!state.report.reportDate) { state.report.reportDate = todayStr(); }
    if (!state.report.tourDate) { state.report.tourDate = todayStr(); }
    wireEvents();
    boot(false);
    setInterval(() => { if (currentTab === 'informe') renderPreview(); syncStateFromFormOnLoad(); }, 20000);
    window.addEventListener('input', e => { if (e.target.closest('#patrolForm')) syncStateFromFormOnLoad(); });
    window.addEventListener('change', e => { if (e.target.closest('#patrolForm')) syncStateFromFormOnLoad(); });
  });
})();
