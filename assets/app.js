(() => {
  'use strict';

  const C = window.PATRULLAJE_CATALOGS;
  const LS_STATE = 'patrullajes-sinac:v3:current';
  const LS_CATALOG = 'patrullajes-sinac:v3:catalog';
  const TRACK_MIN_METERS = 25;
  const TRACK_MAX_SECONDS = 30;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const uid = (prefix='id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const nowLocalDate = () => new Date().toLocaleDateString('en-CA');
  const nowLocalTime = () => new Date().toTimeString().slice(0,5);
  const isoNow = () => new Date().toISOString();
  const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('es-CR') : '—';
  const safeNum = v => v === '' || v == null ? null : Number(v);

  let state = loadState();
  let catalogs = loadCatalogs();
  let map = null, trackLine = null, currentMarker = null, obsLayer = null, startMarker = null, endMarker = null;
  let watchId = null, currentPosition = null, currentStep = 0, editingObsId = null;
  let pendingPhotoBlobs = [null, null, null];

  function blankState() {
    return {
      version: 3,
      id: uid('PAT'),
      status: 'draft',
      start: { date: nowLocalDate(), time: nowLocalTime(), place:'', otherPlace:'', responsible:'', personnel:[], vehicleId:'', odometer:null, fuel:'', vehicleCheck:false, position:null, startedAt:null },
      track: [],
      observations: [],
      end: { date:'', time:'', place:'', otherPlace:'', odometer:null, fuel:'', vehicleCheck:false, generalNotes:'', allowances:{}, position:null, endedAt:null },
      createdAt: isoNow(), updatedAt: isoNow()
    };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_STATE));
      return raw && raw.version === 3 ? raw : blankState();
    } catch (_) { return blankState(); }
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
    updateStatus();
  }

  function setValue(name, value) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
  }

  function formSyncFromState() {
    setValue('startDate', state.start.date); setValue('startTime', state.start.time); setValue('startPlace', state.start.place); setValue('startOtherPlace', state.start.otherPlace);
    setValue('responsible', state.start.responsible); setValue('vehicle', state.start.vehicleId); setValue('startOdometer', state.start.odometer); setValue('startFuel', state.start.fuel); setValue('startVehicleCheck', state.start.vehicleCheck);
    setValue('endDate', state.end.date); setValue('endTime', state.end.time); setValue('endPlace', state.end.place); setValue('endOtherPlace', state.end.otherPlace);
    setValue('endOdometer', state.end.odometer); setValue('endFuel', state.end.fuel); setValue('endVehicleCheck', state.end.vehicleCheck); setValue('generalNotes', state.end.generalNotes);
    toggleOtherPlace('start'); toggleOtherPlace('end');
  }

  function bindStateInputs() {
    const bindings = {
      startDate:['start','date'], startTime:['start','time'], startPlace:['start','place'], startOtherPlace:['start','otherPlace'], responsible:['start','responsible'], vehicle:['start','vehicleId'],
      startOdometer:['start','odometer'], startFuel:['start','fuel'], startVehicleCheck:['start','vehicleCheck'], endDate:['end','date'], endTime:['end','time'], endPlace:['end','place'], endOtherPlace:['end','otherPlace'],
      endOdometer:['end','odometer'], endFuel:['end','fuel'], endVehicleCheck:['end','vehicleCheck'], generalNotes:['end','generalNotes']
    };
    Object.entries(bindings).forEach(([name,path]) => {
      const el = document.querySelector(`[name="${name}"]`); if (!el) return;
      const event = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(event, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (name.toLowerCase().includes('odometer')) v = safeNum(v);
        state[path[0]][path[1]] = v;
        if (name === 'startPlace') toggleOtherPlace('start');
        if (name === 'endPlace') toggleOtherPlace('end');
        if (name === 'responsible') renderPersonnelPills();
        saveState(); renderSummary();
      });
    });
  }

  function populateStaticSelects() {
    const options = (arr, first='Seleccione…') => `<option value="">${first}</option>` + arr.map(v => `<option>${escapeHtml(v)}</option>`).join('');
    $('#startPlace').innerHTML = options(C.lugares); $('#endPlace').innerHTML = options(C.lugares);
    $('#startFuel').innerHTML = options(C.combustibles); $('#endFuel').innerHTML = options(C.combustibles);
    $('#sitadaType').innerHTML = options(C.sitadaTipos, 'Seleccione tipo SITADA…');
    $('#sitadaInfractionList').innerHTML = C.sitadaInfraccionesComunes.map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
  }

  function renderCatalogs() {
    const responsible = $('#responsible'); const vehicle = $('#vehicle');
    responsible.innerHTML = `<option value="">Seleccione encargado…</option>` + catalogs.personnel.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    vehicle.innerHTML = `<option value="">Seleccione vehículo…</option><option value="none">Sin vehículo</option>` + catalogs.vehicles.map(v => `<option value="${escapeAttr(v.id)}">${escapeHtml(vehicleLabel(v))}</option>`).join('');
    setValue('responsible', state.start.responsible); setValue('vehicle', state.start.vehicleId);
    renderPersonnelPills(); renderAllowances();
  }

  function vehicleLabel(v) { return [v.plate, v.brand, v.model].filter(Boolean).join(' · ') || 'Vehículo'; }
  function getPersonName(id) { return (catalogs.personnel.find(p=>p.id===id)||{}).name || id || '—'; }
  function getVehicleLabel(id) { if (id === 'none') return 'Sin vehículo'; return vehicleLabel(catalogs.vehicles.find(v=>v.id===id)||{}); }

  function renderPersonnelPills() {
    const box = $('#personnelPills');
    if (!catalogs.personnel.length) { box.innerHTML = `<span class="hint">Primero agregue personal al catálogo.</span>`; return; }
    box.innerHTML = catalogs.personnel.map(p => {
      const selected = state.start.personnel.includes(p.id);
      const disabled = false;
      return `<button type="button" class="pill ${selected?'selected':''}" data-person="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`;
    }).join('');
    $$('[data-person]', box).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.person;
      state.start.personnel = state.start.personnel.includes(id) ? state.start.personnel.filter(x=>x!==id) : [...state.start.personnel, id];
      saveState(); renderPersonnelPills(); renderAllowances(); renderSummary();
    }));
  }

  function renderAllowances() {
    const tbody = $('#allowanceBody');
    const ids = unique([state.start.responsible, ...state.start.personnel].filter(Boolean));
    if (!ids.length) { tbody.innerHTML = `<tr><td colspan="5" class="hint">Seleccione encargado y personal al inicio.</td></tr>`; return; }
    tbody.innerHTML = ids.map(id => {
      const a = state.end.allowances[id] || {};
      return `<tr><td>${escapeHtml(getPersonName(id))}</td>${['breakfast','lunch','dinner','lodging'].map(k=>`<td class="center"><input type="checkbox" data-allow-person="${escapeAttr(id)}" data-allow-key="${k}" ${a[k]?'checked':''}></td>`).join('')}</tr>`;
    }).join('');
    $$('[data-allow-person]', tbody).forEach(cb => cb.addEventListener('change', () => {
      const id=cb.dataset.allowPerson, key=cb.dataset.allowKey;
      state.end.allowances[id] = state.end.allowances[id] || {};
      state.end.allowances[id][key] = cb.checked; saveState();
    }));
  }

  function toggleOtherPlace(which) {
    const val = $(`#${which}Place`).value;
    $(`#${which}OtherWrap`).classList.toggle('hidden', val !== 'Otro');
  }

  function validateStart() {
    const errors = [];
    if (!state.start.date) errors.push('fecha de inicio');
    if (!state.start.time) errors.push('hora de inicio');
    if (!state.start.place) errors.push('lugar de salida');
    if (state.start.place === 'Otro' && !state.start.otherPlace.trim()) errors.push('detalle del lugar de salida');
    if (!state.start.responsible) errors.push('encargado');
    if (!state.start.vehicleId) errors.push('vehículo o “Sin vehículo”');
    if (state.start.vehicleId !== 'none' && state.start.odometer == null) errors.push('kilometraje inicial');
    if (state.start.vehicleId !== 'none' && !state.start.fuel) errors.push('combustible inicial');
    return errors;
  }

  async function startPatrol() {
    const errors = validateStart();
    if (errors.length) return alert(`Falta completar: ${errors.join(', ')}.`);
    state.status = 'active';
    state.start.startedAt = isoNow();
    if (!state.start.date) state.start.date = nowLocalDate(); if (!state.start.time) state.start.time = nowLocalTime();
    saveState();
    updateStatus();
    await capturePosition(true).catch(()=>{});
    beginWatch();
    goStep(1);
  }

  function beginWatch() {
    if (!navigator.geolocation || watchId != null) return;
    watchId = navigator.geolocation.watchPosition(pos => onPosition(pos, true), onGeoError, {enableHighAccuracy:true, maximumAge:5000, timeout:20000});
  }

  function endWatch() { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId = null; }

  function onPosition(pos, allowTrack) {
    const p = positionFromGeo(pos);
    currentPosition = p;
    updatePositionUI();
    updateMapCurrent();
    if (allowTrack && state.status === 'active') maybeAppendTrack(p);
  }

  function positionFromGeo(pos) {
    const c=pos.coords; const cr=PatrolGeo.toCRTM05(c.latitude,c.longitude);
    return { lat:c.latitude, lon:c.longitude, accuracy:c.accuracy, altitude:c.altitude, speed:c.speed, heading:c.heading, crtm:cr?{x:cr.x,y:cr.y,method:cr.method}:null, timestamp:new Date(pos.timestamp||Date.now()).toISOString() };
  }

  function maybeAppendTrack(p, force=false) {
    const last=state.track[state.track.length-1];
    if (!last || force) return appendTrack(p);
    const dist=PatrolGeo.haversine(last,p); const dt=(new Date(p.timestamp)-new Date(last.timestamp))/1000;
    if (dist >= TRACK_MIN_METERS || dt >= TRACK_MAX_SECONDS) appendTrack(p);
  }

  function appendTrack(p) {
    state.track.push({...p, id:uid('trk')}); saveState(); renderTrackStats(); renderMapData(); renderSummary();
  }

  function onGeoError(err) {
    const msg = err && err.message ? err.message : 'No se pudo obtener la posición.';
    $('#gpsMessage').textContent = `GPS: ${msg}`;
  }

  function capturePosition(forceTrack=false) {
    return new Promise((resolve,reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
      navigator.geolocation.getCurrentPosition(pos => { const p=positionFromGeo(pos); currentPosition=p; updatePositionUI(); updateMapCurrent(); if(forceTrack && state.status==='active') maybeAppendTrack(p,true); resolve(p); }, err=>{onGeoError(err);reject(err);}, {enableHighAccuracy:true, maximumAge:0, timeout:25000});
    });
  }

  function updatePositionUI() {
    const p=currentPosition;
    $('#latVal').textContent=p?p.lat.toFixed(6):'—'; $('#lonVal').textContent=p?p.lon.toFixed(6):'—'; $('#crtmVal').textContent=p&&p.crtm?PatrolGeo.fmtCRTM(p.crtm):'—';
    const acc=p&&Number.isFinite(p.accuracy)?`${p.accuracy.toFixed(1)} m`:'—'; $('#accVal').textContent=acc;
    const cls=!p?'':p.accuracy<=10?'gps-good':p.accuracy<=30?'gps-warn':'gps-bad'; $('#accVal').className=cls;
    $('#gpsMessage').textContent=p?`Posición actualizada ${new Date(p.timestamp).toLocaleTimeString('es-CR')}${p.altitude!=null?` · ${Math.round(p.altitude)} m s. n. m.`:''}`:'Sin posición disponible.';
  }

  function trackDistance() { let m=0; for(let i=1;i<state.track.length;i++) m+=PatrolGeo.haversine(state.track[i-1],state.track[i]); return m; }
  function durationMs() { if(!state.start.startedAt) return 0; const end=state.end.endedAt||new Date().toISOString(); return Math.max(0,new Date(end)-new Date(state.start.startedAt)); }
  function fmtDuration(ms) { const min=Math.floor(ms/60000); return `${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')} min`; }
  function renderTrackStats(){ $('#trackCount').textContent=state.track.length; $('#trackDistance').textContent=(trackDistance()/1000).toFixed(2)+' km'; $('#trackDuration').textContent=fmtDuration(durationMs()); }

  function initMap() {
    if (!window.L) { $('#mapFallback').classList.remove('hidden'); return; }
    map=L.map('map',{zoomControl:true}).setView([9.6,-83.9],9);
    const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap contributors'});
    const imagery=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
    const labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri reference'});
    const aerial=L.layerGroup([imagery,labels]);
    osm.addTo(map); L.control.layers({'OSM':osm,'Imagen aérea + etiquetas':aerial},null,{collapsed:false}).addTo(map);
    trackLine=L.polyline([],{weight:5,opacity:.85}).addTo(map); obsLayer=L.layerGroup().addTo(map);
    renderMapData(); updateMapCurrent();
  }

  function renderMapData(fit=false) {
    if (!map) return;
    const latlngs=state.track.map(p=>[p.lat,p.lon]); trackLine.setLatLngs(latlngs);
    if(startMarker){startMarker.remove();startMarker=null;} if(endMarker){endMarker.remove();endMarker=null;}
    if(state.start.position) startMarker=L.circleMarker([state.start.position.lat,state.start.position.lon],{radius:7,weight:3,fillOpacity:1}).bindTooltip('Inicio').addTo(map);
    if(state.end.position) endMarker=L.circleMarker([state.end.position.lat,state.end.position.lon],{radius:7,weight:3,fillOpacity:1}).bindTooltip('Fin').addTo(map);
    obsLayer.clearLayers(); state.observations.forEach((o,i)=>{
      if(!o.position) return;
      const m=L.marker([o.position.lat,o.position.lon]).bindPopup(`<strong>${i+1}. ${escapeHtml(obsLabel(o))}</strong><br>${escapeHtml(o.description||'Sin descripción')}<br><small>${escapeHtml(PatrolGeo.fmtCRTM(o.position.crtm))}</small>`);
      obsLayer.addLayer(m);
    });
    const all=[...latlngs,...state.observations.filter(o=>o.position).map(o=>[o.position.lat,o.position.lon])];
    if(fit && all.length) map.fitBounds(all,{padding:[30,30],maxZoom:17});
  }

  function updateMapCurrent() {
    if(!map||!currentPosition)return;
    const ll=[currentPosition.lat,currentPosition.lon];
    if(!currentMarker) currentMarker=L.circleMarker(ll,{radius:8,weight:3,fillOpacity:.8}).bindTooltip('Posición actual').addTo(map); else currentMarker.setLatLng(ll);
  }

  function obsLabel(o){ if(o.category==='Daño ambiental')return `${o.category} · ${o.sitadaType||'Sin tipo'}`; if(o.category==='Vigilancia')return `${o.category} · ${o.subtype||'Sin subtipo'}`; if(o.category==='Monitoreo')return `${o.category} · ${o.subtype||'Sin subtipo'}`; return o.otherType?`Otro · ${o.otherType}`:'Otro'; }

  function renderObservations() {
    const box=$('#observationList');
    if(!state.observations.length){box.innerHTML='<div class="empty-state">Aún no hay observaciones registradas.</div>';return;}
    box.innerHTML=state.observations.map((o,i)=>`<article class="obs-card"><div class="obs-index">${String(i+1).padStart(2,'0')}</div><div><div class="obs-title">${escapeHtml(obsLabel(o))}</div><div class="obs-meta">${escapeHtml(fmtDateTime(o.createdAt))} · ${escapeHtml(o.position&&o.position.crtm?PatrolGeo.fmtCRTM(o.position.crtm):'Sin coordenada')} · ${o.photos.length} foto(s)</div><div class="small" style="margin-top:6px">${escapeHtml((o.description||'').slice(0,180))}${(o.description||'').length>180?'…':''}</div></div><div class="obs-actions"><button class="icon-btn" type="button" data-edit-obs="${o.id}" title="Editar">✎</button><button class="icon-btn" type="button" data-delete-obs="${o.id}" title="Eliminar">×</button></div></article>`).join('');
    $$('[data-edit-obs]',box).forEach(b=>b.addEventListener('click',()=>openObservationModal(b.dataset.editObs)));
    $$('[data-delete-obs]',box).forEach(b=>b.addEventListener('click',()=>deleteObservation(b.dataset.deleteObs)));
  }

  async function deleteObservation(id){
    const o=state.observations.find(x=>x.id===id); if(!o||!confirm('¿Eliminar esta observación y sus fotografías?'))return;
    for(const p of o.photos) await PatrolStore.photoDelete(p.key).catch(()=>{});
    state.observations=state.observations.filter(x=>x.id!==id); saveState(); renderObservations(); renderMapData(); renderSummary();
  }

  function clearObservationForm(){
    editingObsId=null; pendingPhotoBlobs=[null,null,null]; $('#obsModalTitle').textContent='Nueva observación';
    $$('[data-cat]').forEach(b=>b.classList.remove('selected')); $('#obsCategory').value=''; $('#sitadaType').value=''; $('#sitadaInfraction').value=''; $('#obsSubtype').innerHTML='<option value="">Seleccione…</option>';
    $('#otherType').value=''; $('#obsDescription').value=''; $('#obsPositionText').textContent='Se capturará la posición GPS al guardar.'; $('#sitadaFields').classList.add('hidden'); $('#subtypeFields').classList.add('hidden'); $('#otherFields').classList.add('hidden'); renderPhotoSlots([]);
  }

  async function openObservationModal(id=null){
    clearObservationForm();
    if(id){
      const o=state.observations.find(x=>x.id===id); if(!o)return; editingObsId=id; $('#obsModalTitle').textContent='Editar observación'; selectCategory(o.category,false); $('#sitadaType').value=o.sitadaType||''; $('#sitadaInfraction').value=o.sitadaInfraction||''; $('#otherType').value=o.otherType||''; $('#obsDescription').value=o.description||''; $('#obsPositionText').textContent=o.position?`${PatrolGeo.fmtCRTM(o.position.crtm)} · precisión ±${Math.round(o.position.accuracy||0)} m`:'Sin coordenada';
      if(o.subtype) $('#obsSubtype').value=o.subtype; await renderPhotoSlots(o.photos);
    } else if(currentPosition) $('#obsPositionText').textContent=`Posición actual: ${PatrolGeo.fmtCRTM(currentPosition.crtm)} · ±${Math.round(currentPosition.accuracy||0)} m`;
    $('#obsModal').classList.add('open');
  }

  function closeObservationModal(){ $('#obsModal').classList.remove('open'); editingObsId=null; pendingPhotoBlobs=[null,null,null]; }

  function selectCategory(cat,clear=true){
    $('#obsCategory').value=cat; $$('[data-cat]').forEach(b=>b.classList.toggle('selected',b.dataset.cat===cat));
    $('#sitadaFields').classList.toggle('hidden',cat!=='Daño ambiental'); $('#subtypeFields').classList.toggle('hidden',!['Vigilancia','Monitoreo'].includes(cat)); $('#otherFields').classList.toggle('hidden',cat!=='Otro');
    if(['Vigilancia','Monitoreo'].includes(cat)){
      const arr=cat==='Vigilancia'?C.vigilancia:C.monitoreo; const old=clear?'':$('#obsSubtype').value; $('#obsSubtype').innerHTML='<option value="">Seleccione…</option>'+arr.map(v=>`<option>${escapeHtml(v)}</option>`).join(''); if(old)$('#obsSubtype').value=old;
    }
    if(clear){$('#sitadaType').value='';$('#sitadaInfraction').value='';$('#obsSubtype').value='';$('#otherType').value='';}
  }

  async function renderPhotoSlots(existingPhotos){
    const grid=$('#photoGrid'); grid.innerHTML='';
    for(let i=0;i<3;i++){
      const p=existingPhotos[i]; let url=''; if(p){const blob=await PatrolStore.photoGet(p.key).catch(()=>null); if(blob)url=URL.createObjectURL(blob);}
      const slot=document.createElement('div'); slot.className='photo-slot'; const cameraId=`cam-${i}-${Math.random().toString(36).slice(2,7)}`, galleryId=`gal-${i}-${Math.random().toString(36).slice(2,7)}`; slot.innerHTML=`<img class="${url?'':'hidden'}" ${url?`src="${url}"`:''} alt="Vista previa"><div class="hint">${url?'Fotografía guardada':'Sin fotografía'}</div><div class="photo-actions"><label class="photo-action-label" for="${cameraId}">Tomar foto</label><label class="photo-action-label" for="${galleryId}">Galería</label></div><input id="${cameraId}" class="photo-file camera-file" type="file" accept="image/*" capture="environment"><input id="${galleryId}" class="photo-file gallery-file" type="file" accept="image/*"><input type="text" maxlength="180" placeholder="Descripción opcional" value="${escapeAttr(p?.caption||'')}"><button type="button" class="photo-remove ${p||url?'':'hidden'}">Quitar</button>`;
      const files=[slot.querySelector('.camera-file'),slot.querySelector('.gallery-file')], img=slot.querySelector('img'), hint=slot.querySelector('.hint'), rm=slot.querySelector('.photo-remove');
      const ingest=async(fileInput)=>{if(!fileInput.files[0])return; const blob=await compressImage(fileInput.files[0]); pendingPhotoBlobs[i]=blob; img.src=URL.createObjectURL(blob);img.classList.remove('hidden');hint.textContent='Nueva fotografía';rm.classList.remove('hidden');};
      files.forEach(file=>file.addEventListener('change',()=>ingest(file)));
      rm.addEventListener('click',()=>{pendingPhotoBlobs[i]='REMOVE';img.src='';img.classList.add('hidden');hint.textContent='Sin fotografía';rm.classList.add('hidden');files.forEach(f=>f.value='');});
      grid.appendChild(slot);
    }
  }

  function compressImage(file){
    return new Promise((resolve,reject)=>{
      const img=new Image(),url=URL.createObjectURL(file); img.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('No se pudo procesar la imagen'));},'image/jpeg',.82);};img.onerror=reject;img.src=url;
    });
  }

  async function saveObservation(){
    const category=$('#obsCategory').value, description=$('#obsDescription').value.trim(); if(!category)return alert('Seleccione el tipo de observación.'); if(!description)return alert('Escriba una descripción.');
    if(category==='Daño ambiental'&&!$('#sitadaType').value)return alert('Seleccione el tipo de denuncia SITADA.'); if(['Vigilancia','Monitoreo'].includes(category)&&!$('#obsSubtype').value)return alert('Seleccione el subtipo.'); if(category==='Otro'&&!$('#otherType').value.trim())return alert('Indique el tipo de observación.');
    let position; try{position=await capturePosition(false);}catch(_){ if(!currentPosition&&!confirm('No fue posible obtener GPS. ¿Guardar la observación sin coordenada?'))return; position=currentPosition; }
    const existing=editingObsId?state.observations.find(x=>x.id===editingObsId):null; const obs=existing?{...existing}:{id:uid('obs'),createdAt:isoNow(),photos:[]};
    obs.updatedAt=isoNow(); obs.category=category; obs.sitadaType=$('#sitadaType').value; obs.sitadaInfraction=$('#sitadaInfraction').value.trim(); obs.subtype=$('#obsSubtype').value; obs.otherType=$('#otherType').value.trim(); obs.description=description; obs.position=position?JSON.parse(JSON.stringify(position)):null;
    const slots=[...$('#photoGrid').children]; const newPhotos=[];
    for(let i=0;i<3;i++){
      const existingPhoto=obs.photos[i]; const pending=pendingPhotoBlobs[i]; const caption=slots[i].querySelector('input[type=text]').value.trim();
      if(pending==='REMOVE'){if(existingPhoto)await PatrolStore.photoDelete(existingPhoto.key).catch(()=>{});continue;}
      if(pending instanceof Blob){if(existingPhoto)await PatrolStore.photoDelete(existingPhoto.key).catch(()=>{});const key=uid(`photo-${obs.id}`);await PatrolStore.photoPut(key,pending);newPhotos.push({key,caption,mime:'image/jpeg'});}
      else if(existingPhoto){newPhotos.push({...existingPhoto,caption});}
    }
    obs.photos=newPhotos;
    if(existing){state.observations=state.observations.map(x=>x.id===obs.id?obs:x);}else state.observations.push(obs);
    if(position && state.status==='active') maybeAppendTrack(position,true);
    saveState(); renderObservations(); renderMapData(); renderSummary(); closeObservationModal();
  }

  async function finalizePatrol(){
    if(state.status!=='active')return alert('El patrullaje no está activo.');
    const missing=[]; if(!state.end.date)missing.push('fecha final');if(!state.end.time)missing.push('hora final');if(!state.end.place)missing.push('lugar de regreso');if(state.end.place==='Otro'&&!state.end.otherPlace.trim())missing.push('detalle del lugar de regreso');if(state.start.vehicleId!=='none'&&state.end.odometer==null)missing.push('kilometraje final');if(state.start.vehicleId!=='none'&&!state.end.fuel)missing.push('combustible final');
    if(missing.length)return alert(`Falta completar: ${missing.join(', ')}.`);
    if(state.start.vehicleId!=='none'&&state.end.odometer<state.start.odometer)return alert('El kilometraje final no puede ser menor que el inicial.');
    try{state.end.position=await capturePosition(false);}catch(_){state.end.position=currentPosition;}
    if(state.end.position) maybeAppendTrack(state.end.position,true);
    state.end.endedAt=isoNow(); state.status='finished'; endWatch(); saveState(); updateStatus(); renderTrackStats(); renderMapData(true); renderSummary(); goStep(3);
  }

  function updateStatus(){
    const chip=$('#patrolStatus'); const label=$('#patrolStatusText'); chip.classList.toggle('active',state.status==='active');
    label.textContent=state.status==='active'?'PATRULLAJE ACTIVO':state.status==='finished'?'FINALIZADO':'BORRADOR';
    $('#startPatrolBtn').disabled=state.status==='active'; $('#finalizeBtn').disabled=state.status!=='active'; $('#newObsBtn').disabled=state.status!=='active';
  }

  function renderSummary(){
    const kms=trackDistance()/1000; const veh=state.start.vehicleId==='none'?null:(state.start.odometer!=null&&state.end.odometer!=null?state.end.odometer-state.start.odometer:null);
    $('#sumDuration').textContent=fmtDuration(durationMs()); $('#sumGpsKm').textContent=kms.toFixed(2)+' km'; $('#sumVehicleKm').textContent=veh==null?'—':veh.toLocaleString('es-CR')+' km'; $('#sumObs').textContent=state.observations.length; const som=$('#sumObsMap'); if(som)som.textContent=state.observations.length;
    const counts={}; state.observations.forEach(o=>counts[o.category]=(counts[o.category]||0)+1); $('#summaryDetail').innerHTML=`<strong>ID:</strong> ${escapeHtml(state.id)}<br><strong>Encargado:</strong> ${escapeHtml(getPersonName(state.start.responsible))}<br><strong>Vehículo:</strong> ${escapeHtml(getVehicleLabel(state.start.vehicleId))}<br><strong>Observaciones:</strong> ${Object.entries(counts).map(([k,v])=>`${escapeHtml(k)}: ${v}`).join(' · ')||'Ninguna'}<br><strong>Inicio:</strong> ${escapeHtml(state.start.place==='Otro'?state.start.otherPlace:state.start.place||'—')} · ${escapeHtml(state.start.date||'—')} ${escapeHtml(state.start.time||'')}<br><strong>Fin:</strong> ${escapeHtml(state.end.place==='Otro'?state.end.otherPlace:state.end.place||'—')} · ${escapeHtml(state.end.date||'—')} ${escapeHtml(state.end.time||'')}`;
  }

  function exportJSON(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); downloadBlob(blob,`${state.id}.json`);
  }
  function exportGeoJSON(){
    const features=[];
    if(state.track.length)features.push({type:'Feature',properties:{kind:'track',patrolId:state.id},geometry:{type:'LineString',coordinates:state.track.map(p=>[p.lon,p.lat,p.altitude??null])}});
    state.observations.filter(o=>o.position).forEach((o,i)=>features.push({type:'Feature',properties:{kind:'observation',number:i+1,category:o.category,subtype:o.subtype||o.sitadaType||o.otherType||'',sitadaInfraction:o.sitadaInfraction||'',description:o.description,accuracy:o.position.accuracy,crtmE:o.position.crtm?.x,crtmN:o.position.crtm?.y},geometry:{type:'Point',coordinates:[o.position.lon,o.position.lat,o.position.altitude??null]}}));
    downloadBlob(new Blob([JSON.stringify({type:'FeatureCollection',features},null,2)],{type:'application/geo+json'}),`${state.id}.geojson`);
  }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}

  async function resetApp(){
    if(!confirm('Esto eliminará el patrullaje actual y sus fotografías. Los catálogos de personal y vehículos se conservarán.'))return;
    endWatch(); for(const o of state.observations)for(const p of o.photos)await PatrolStore.photoDelete(p.key).catch(()=>{}); state=blankState(); currentPosition=null; localStorage.setItem(LS_STATE,JSON.stringify(state)); formSyncFromState(); renderObservations();renderTrackStats();renderAllowances();renderSummary();renderMapData();updatePositionUI();updateStatus();goStep(0);
  }

  function goStep(n){currentStep=Math.max(0,Math.min(3,n)); if(currentStep===3 && state.status==='active'){let changed=false;if(!state.end.date){state.end.date=nowLocalDate();setValue('endDate',state.end.date);changed=true;}if(!state.end.time){state.end.time=nowLocalTime();setValue('endTime',state.end.time);changed=true;}if(changed)saveState();} $$('.panel').forEach((p,i)=>p.classList.toggle('current',i===currentStep));$$('.step-btn').forEach((b,i)=>{b.classList.toggle('current',i===currentStep);b.classList.toggle('done',i<currentStep);});$('#prevBtn').classList.toggle('hidden',currentStep===0);$('#nextBtn').classList.toggle('hidden',currentStep===3); if(currentStep===1&&map)setTimeout(()=>map.invalidateSize(),50); window.scrollTo({top:0,behavior:'smooth'});}

  function addPerson(){
    const name=prompt('Nombre completo del funcionario o participante:'); if(!name||!name.trim())return; catalogs.personnel.push({id:uid('person'),name:name.trim()}); saveCatalogs(); renderCatalogs();
  }
  function addVehicle(){
    const plate=prompt('Placa o identificación del vehículo:'); if(!plate||!plate.trim())return; const brand=prompt('Marca (opcional):')||''; const model=prompt('Modelo (opcional):')||''; catalogs.vehicles.push({id:uid('vehicle'),plate:plate.trim(),brand:brand.trim(),model:model.trim()}); saveCatalogs(); renderCatalogs();
  }

  function unique(arr){return [...new Set(arr)];}
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}

  function wireEvents(){
    bindStateInputs();
    $$('.step-btn').forEach((b,i)=>b.addEventListener('click',()=>goStep(i))); $('#prevBtn').addEventListener('click',()=>goStep(currentStep-1)); $('#nextBtn').addEventListener('click',()=>goStep(currentStep+1));
    $('#addPersonBtn').addEventListener('click',addPerson); $('#addVehicleBtn').addEventListener('click',addVehicle); $('#startPatrolBtn').addEventListener('click',startPatrol); $('#captureGpsBtn').addEventListener('click',()=>capturePosition(false)); $('#fitMapBtn').addEventListener('click',()=>renderMapData(true));
    $('#newObsBtn').addEventListener('click',()=>openObservationModal()); $('#closeObsModal').addEventListener('click',closeObservationModal); $('#cancelObsBtn').addEventListener('click',closeObservationModal); $('#saveObsBtn').addEventListener('click',saveObservation); $('#obsModal').addEventListener('click',e=>{if(e.target.id==='obsModal')closeObservationModal();});
    $$('[data-cat]').forEach(b=>b.addEventListener('click',()=>selectCategory(b.dataset.cat,true))); $('#refreshObsGps').addEventListener('click',async()=>{try{const p=await capturePosition(false);$('#obsPositionText').textContent=`Posición actual: ${PatrolGeo.fmtCRTM(p.crtm)} · ±${Math.round(p.accuracy||0)} m`;}catch(_){}});
    $('#finalizeBtn').addEventListener('click',finalizePatrol); $('#exportJsonBtn').addEventListener('click',exportJSON); $('#exportGeoJsonBtn').addEventListener('click',exportGeoJSON); $('#resetBtn').addEventListener('click',resetApp);
    window.addEventListener('beforeunload',saveState);
  }

  function boot(){
    populateStaticSelects(); renderCatalogs(); formSyncFromState(); wireEvents(); renderObservations();renderTrackStats();renderAllowances();renderSummary();updateStatus();updatePositionUI(); initMap();
    if(state.status==='active'){beginWatch();goStep(1);} else goStep(0);
    setInterval(()=>{if(state.status==='active'){renderTrackStats();renderSummary();}},30000);
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
