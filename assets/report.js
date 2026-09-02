// Generador de vista previa (papel tamaño carta) e informe institucional Word (.docx),
// con membrete oficial SINAC/ACC/BTMM. Depende de JSZip (assets/vendor/jszip.min.js).
(function () {
  'use strict';

  const IMG = {
    logo: 'assets/img/sinac-logo.png',
    cornerTop: 'assets/img/informe-corner-top.png',
    cornerBottom: 'assets/img/informe-corner-bottom.png'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function xml(s) { return esc(s).replace(/'/g, '&apos;'); }
  function fmtDate(v) { if (!v) return ''; const [y, m, d] = String(v).split('-'); return d && m && y ? `${d}/${m}/${y}` : v; }
  function fmtMoney(v) { if (v === '' || v == null) return ''; const n = Number(v); return Number.isFinite(n) ? '₡' + n.toLocaleString('es-CR') : String(v); }
  function today() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
  function checksText(items, selected) { return (items || []).map(x => `${x} ( ${(selected || []).includes(x) ? 'X' : ' '} )`).join('  '); }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

  function viaticosText(allowances) {
    if (!allowances || !allowances.length) return 'No indicado';
    const withAny = allowances.filter(a => a.breakfast || a.lunch || a.dinner || a.lodging);
    if (!withAny.length) return 'No indicado';
    return withAny.map(a => {
      const parts = [];
      if (a.breakfast) parts.push('desayuno');
      if (a.lunch) parts.push('almuerzo');
      if (a.dinner) parts.push('cena');
      if (a.lodging) parts.push('hospedaje');
      return `${a.name}: ${parts.join(', ')}`;
    }).join(' · ');
  }

  function findingLabel(x) {
    if (x.category === 'Daño ambiental') return `Daño ambiental · ${x.sitadaType || 'Sin tipo'}${x.sitadaInfraction ? ' · ' + x.sitadaInfraction : ''}`;
    if (x.category === 'Vigilancia') return `Vigilancia · ${x.subtype || 'Sin subtipo'}`;
    if (x.category === 'Monitoreo') return `Monitoreo · ${x.subtype || 'Sin subtipo'}`;
    if (x.category) return x.otherType ? `Otro · ${x.otherType}` : 'Otro';
    return x.type || 'Hallazgo';
  }

  function reportPhotos(state) {
    const gen = (state.generalPhotos || []).filter(p => p.dataUrl).map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '' }));
    const fromFindings = [];
    (state.findings || []).forEach(f => (f.photos || []).forEach(p => {
      if (!p.dataUrl) return;
      fromFindings.push({ dataUrl: p.dataUrl, caption: p.caption ? `${findingLabel(f)} — ${p.caption}` : findingLabel(f) });
    }));
    return gen.concat(fromFindings);
  }

  // ---------- vista previa HTML (papel tamaño carta) ----------
  function reportHTML(f, state) {
    const persons = state.contacts && state.contacts.length ? `<div class="sectionTitle">PERSONAS / ACTUACIONES REGISTRADAS:</div><table class="reportTable"><tr><th>Nombre</th><th>Condición</th><th>Identificación / teléfono</th><th>Actuación</th></tr>${state.contacts.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${esc(x.idn || '')} ${esc(x.phone || '')}</td><td>${esc(x.note || '')}</td></tr>`).join('')}</table>` : '';
    const finds = state.findings && state.findings.length ? `<div class="sectionTitle">HALLAZGOS GEORREFERENCIADOS:</div><table class="reportTable"><tr><th>Hallazgo</th><th>CRTM05</th><th>Descripción</th><th>Medida</th></tr>${state.findings.map(x => `<tr><td>${esc(findingLabel(x))}</td><td>${esc(x.x || '')} / ${esc(x.y || '')}</td><td>${esc(x.desc || '')}</td><td>${esc(x.action || '')}</td></tr>`).join('')}</table>` : '';
    const viaticos = state.allowances && state.allowances.length ? `<div class="sectionTitle">ALIMENTACIÓN Y HOSPEDAJE:</div><table class="reportTable"><tr><th>Participante</th><th>Desayuno</th><th>Almuerzo</th><th>Cena</th><th>Hospedaje</th></tr>${state.allowances.map(a => `<tr><td>${esc(a.name)}</td><td>${a.breakfast ? 'X' : ''}</td><td>${a.lunch ? 'X' : ''}</td><td>${a.dinner ? 'X' : ''}</td><td>${a.lodging ? 'X' : ''}</td></tr>`).join('')}</table>` : '';
    const photos = reportPhotos(state);
    const photosHtml = photos.length ? `<div class="photosReport">${photos.map((p, i) => `<figure><figcaption>Fotografía ${i + 1}. ${esc(p.caption)}</figcaption><img src="${p.dataUrl}"></figure>`).join('')}</div>` : '<p>Sin fotografías incorporadas.</p>';
    return `<img class="cornerTop" src="${IMG.cornerTop}"><img class="cornerBottom" src="${IMG.cornerBottom}"><img class="headLogo" src="${IMG.logo}"><div class="inst">ÁREA DE CONSERVACIÓN CENTRAL<br>Reserva de Biosfera Cordillera Volcánica Central<br>BLOQUE TAPANTÍ MACIZO DE LA MUERTE</div><div class="office">Oficio N° ${esc(f.reportNumber || '')}</div><h1>INFORME DE GIRA / PATRULLAJE</h1><div class="pblock"><p><span class="lab">Fecha de informe:</span> ${esc(fmtDate(f.reportDate))}</p></div><div class="pblock"><p><span class="lab">Destinatario:</span> ${esc(f.recipient || '')} &nbsp;&nbsp; <span class="lab">ASP:</span> ${esc(f.asp || '')}</p><p><span class="lab">N° Informe:</span> ${esc(f.reportNumber || '')}</p><p><span class="lab">Actividad:</span> ${esc(f.activity || '')}</p></div><div class="pblock"><p><span class="lab">TIPO DE ACCIÓN REALIZADA:</span> ${esc(checksText(f.ACTIONS, f.actions))}${f.actionOther ? '  Otro ( X ) Detalle: ' + esc(f.actionOther) : '  Otro ( ) Detalle:'}</p></div><div class="pblock"><p><span class="lab">Fecha de gira:</span> ${esc(fmtDate(f.tourDate))} &nbsp;&nbsp; <span class="lab">Fecha final:</span> ${esc(fmtDate(f.endDate) || fmtDate(f.tourDate))} &nbsp;&nbsp; <span class="lab">Hora:</span> Inicio: ${esc(f.startTime || '')} Final: ${esc(f.endTime || '')}</p></div><div class="pblock"><p><span class="lab">Lugar visitado:</span></p><div class="locgrid"><div>${esc(f.province || '')}<b>Provincia</b></div><div>${esc(f.canton || '')}<b>Cantón</b></div><div>${esc(f.district || '')}<b>Distrito</b></div><div>${esc(f.hamlet || '')}<b>Caserío</b></div></div><p><span class="lab">Dirección exacta:</span> ${esc(f.exactAddress || '')}</p></div><div class="pblock"><p><span class="lab">Origen de la gira:</span> ${esc(f.lugarSalida || '—')} &nbsp;&nbsp; <span class="lab">Lugar de regreso:</span> ${esc(f.lugarRegreso || '—')}</p><p><span class="lab">Encargado/a:</span> ${esc(f.encargadoNombre || '—')} &nbsp;&nbsp; <span class="lab">Funcionarios participantes:</span> ${esc((f.personalNombres || []).join(', ') || '—')}</p><p><span class="lab">Vehículo:</span> ${esc(f.vehiculoLabel || 'Sin vehículo')}${f.vehiculoLabel && f.vehiculoLabel !== 'Sin vehículo' ? ` · Odómetro ${esc(f.odometroInicial ?? '—')} → ${esc(f.odometroFinal ?? '—')} km · Combustible ${esc(f.combustibleInicial || '—')} → ${esc(f.combustibleFinal || '—')}` : ''}</p></div><div class="pblock"><p><span class="lab">Alimentación y hospedaje:</span> ${esc(viaticosText(state.allowances))}</p><p><span class="lab">Kilómetros recorridos:</span> ${esc(f.kilometers || '')}</p></div><div class="pblock"><p><span class="lab">Hoja Cartográfica:</span> ${esc(f.mapSheet || '')}</p><p><span class="lab">Coordenadas CRTM05:</span> Horizontales ${esc(f.crtmX || '')} &nbsp;&nbsp; Verticales ${esc(f.crtmY || '')}</p>${f.latitude ? `<p><span class="lab">GPS complementario WGS84:</span> ${esc(f.latitude)}, ${esc(f.longitude)} (precisión ${esc(f.gpsAccuracy || '')} m)</p>` : ''}</div><div class="pblock"><p><span class="lab">RESULTADOS:</span> ${esc(checksText(f.RESULTS, f.results))}${f.resultOther ? '  Otros: ' + esc(f.resultOther) : ''}</p></div><div class="pblock"><p><span class="lab">EVIDENCIA DE:</span> ${esc(checksText(f.EVIDENCE, f.evidence))}${f.evidenceOther ? '  Otros: ' + esc(f.evidenceOther) : ''}</p></div><div class="sectionTitle">DESCRIPCIÓN DE RESULTADOS:</div><div class="narrative">${esc(f.resultsNarrative || '')}</div>${persons}${finds}${viaticos}<div class="sectionTitle">RECOMENDACIONES/OBSERVACIONES:</div><div class="narrative">${esc(f.recommendations || '')}</div><div class="sectionTitle">REGISTRO FOTOGRÁFICO:</div>${photosHtml}<div style="margin-top:20px"><p><span class="lab">Nombre de funcionario (a):</span> ${esc(f.responsibleName || '')} &nbsp;&nbsp; <span class="lab">Firma:</span> ${esc(f.signatureText || '')}</p>${f.responsibleId ? `<p><span class="lab">N° Cédula:</span> ${esc(f.responsibleId)}</p>` : ''}<p><span class="lab">Voluntarios / otras instituciones:</span> ${state.companions && state.companions.length ? state.companions.map(x => esc(x.name) + (x.role ? ' (' + esc(x.role) + ')' : '')).join('; ') : '—'}</p><p style="font-size:9px;margin-top:25px">CC. ${esc(f.cc || 'Archivo')}</p></div><div class="footerText">Dirección: Villa Mills, 2 km sur del km 98 Ruta No. 2 Interamericana Sur, Cartago / Tel. 2200-4325<br>Apdo.: 11384-1000 San José, Costa Rica<br>www.sinac.go.cr</div>`;
  }

  // ---------- OOXML DOCX ----------
  const EMU = 914400;
  function pXml(text, opt = {}) {
    const bold = opt.bold ? '<w:b/>' : '', italic = opt.italic ? '<w:i/>' : '';
    const size = opt.size ? `<w:sz w:val="${Math.round(opt.size * 2)}"/><w:szCs w:val="${Math.round(opt.size * 2)}"/>` : '';
    const color = opt.color ? `<w:color w:val="${opt.color.replace('#', '')}"/>` : '';
    const align = opt.align ? `<w:jc w:val="${opt.align}"/>` : '';
    const space = `<w:spacing w:before="${opt.before || 0}" w:after="${opt.after ?? 80}" w:line="${opt.line || 276}" w:lineRule="auto"/>`;
    return `<w:p><w:pPr>${align}${space}${opt.keep ? '<w:keepNext/>' : ''}</w:pPr><w:r><w:rPr>${bold}${italic}${size}${color}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  }
  function richP(parts, opt = {}) {
    const align = opt.align ? `<w:jc w:val="${opt.align}"/>` : '';
    const runs = parts.map(x => `<w:r><w:rPr>${x.bold ? '<w:b/>' : ''}${x.italic ? '<w:i/>' : ''}${x.size ? `<w:sz w:val="${x.size * 2}"/><w:szCs w:val="${x.size * 2}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xml(x.text || '')}</w:t></w:r>`).join('');
    return `<w:p><w:pPr>${align}<w:spacing w:after="${opt.after ?? 70}" w:line="276" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
  }
  function checkboxLine(label, items, selected, other) {
    return richP([{ text: label, bold: true }, { text: ' ' + checksText(items, selected) + (other || '') }], { after: 90 });
  }
  function imageRun(rid, cx, cy, docPrId) {
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="Picture ${docPrId}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  function imageP(rid, wIn, hIn, id, align) {
    return `<w:p><w:pPr><w:jc w:val="${align || 'center'}"/><w:spacing w:after="80"/></w:pPr>${imageRun(rid, Math.round(wIn * EMU), Math.round(hIn * EMU), id)}</w:p>`;
  }
  function floatingImage(rid, wIn, hIn, id, xIn, yIn) {
    return `<w:p><w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${Math.round(xIn * EMU)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${Math.round(yIn * EMU)}</wp:posOffset></wp:positionV><wp:extent cx="${Math.round(wIn * EMU)}" cy="${Math.round(hIn * EMU)}"/><wp:wrapNone/><wp:docPr id="${id}" name="Decor ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="decor"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(wIn * EMU)}" cy="${Math.round(hIn * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
  }
  function tableXml(headers, rows, widths = []) {
    const grid = widths.length ? `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` : '';
    const row = (cells, head) => `<w:tr>${cells.map((c, i) => `<w:tc><w:tcPr>${widths[i] ? `<w:tcW w:w="${widths[i]}" w:type="dxa"/>` : ''}${head ? '<w:shd w:fill="E8E8E8"/>' : ''}</w:tcPr>${pXml(c, { bold: head, size: 9, after: 20 })}</w:tc>`).join('')}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders></w:tblPr>${grid}${row(headers, true)}${rows.map(r => row(r)).join('')}</w:tbl>`;
  }
  function imgSize(dataUrl) { return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 800, h: 600 }); im.src = dataUrl; }); }
  function b64Data(dataUrl) { return dataUrl.split(',')[1] || ''; }
  function extMime(dataUrl) { const m = /^data:image\/([^;]+);base64,/.exec(dataUrl || ''); let e = m ? m[1].toLowerCase() : 'jpg'; if (e === 'jpeg') e = 'jpg'; if (!['png', 'jpg', 'gif', 'bmp'].includes(e)) e = 'jpg'; return e; }

  let brandCache = null;
  async function loadBrandImages() {
    if (brandCache) return brandCache;
    const toB64 = async url => {
      const buf = await fetch(url).then(r => r.arrayBuffer());
      let bin = ''; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };
    brandCache = {
      logo: await toB64(IMG.logo),
      cornerTop: await toB64(IMG.cornerTop),
      cornerBottom: await toB64(IMG.cornerBottom)
    };
    return brandCache;
  }

  async function buildDocx(f, state) {
    const brand = await loadBrandImages();
    const zip = new JSZip();
    let body = '';
    body += pXml('Oficio N° ' + (f.reportNumber || ''), { italic: true, color: '102B61', align: 'right', size: 9, after: 900 });
    body += pXml('INFORME DE GIRA / PATRULLAJE', { bold: true, align: 'center', size: 14, after: 300 });
    body += richP([{ text: 'Fecha de informe: ', bold: true }, { text: fmtDate(f.reportDate) }], { after: 170 });
    body += richP([{ text: 'Destinatario: ', bold: true }, { text: f.recipient || '' }, { text: '   ASP: ', bold: true }, { text: f.asp || '' }]);
    body += richP([{ text: 'N° Informe: ', bold: true }, { text: f.reportNumber || '' }]);
    body += richP([{ text: 'Actividad: ', bold: true }, { text: f.activity || '' }], { after: 180 });
    body += checkboxLine('TIPO DE ACCIÓN REALIZADA:', f.ACTIONS, f.actions, f.actionOther ? ` Otro ( X ) Detalle: ${f.actionOther}` : ' Otro ( ) Detalle:');
    body += richP([{ text: 'Fecha de gira: ', bold: true }, { text: fmtDate(f.tourDate) }, { text: '   Fecha final: ', bold: true }, { text: fmtDate(f.endDate) || fmtDate(f.tourDate) }, { text: '   Hora: ', bold: true }, { text: `Inicio: ${f.startTime || ''} Final: ${f.endTime || ''}` }], { after: 170 });
    body += richP([{ text: 'Lugar visitado: ', bold: true }, { text: `${f.province || ''}        ${f.canton || ''}        ${f.district || ''}        ${f.hamlet || ''}` }]);
    body += pXml('                         Provincia        Cantón        Distrito        Caserío', { bold: true, size: 9, after: 130 });
    body += richP([{ text: 'Dirección exacta: ', bold: true }, { text: f.exactAddress || '' }], { after: 150 });
    body += richP([{ text: 'Origen de la gira: ', bold: true }, { text: f.lugarSalida || '—' }, { text: '   Lugar de regreso: ', bold: true }, { text: f.lugarRegreso || '—' }]);
    body += richP([{ text: 'Encargado/a: ', bold: true }, { text: f.encargadoNombre || '—' }, { text: '   Funcionarios participantes: ', bold: true }, { text: (f.personalNombres || []).join(', ') || '—' }]);
    body += richP([{ text: 'Vehículo: ', bold: true }, { text: f.vehiculoLabel || 'Sin vehículo' }, { text: '   Odómetro: ', bold: true }, { text: `${f.odometroInicial ?? '—'} → ${f.odometroFinal ?? '—'} km` }, { text: '   Combustible: ', bold: true }, { text: `${f.combustibleInicial || '—'} → ${f.combustibleFinal || '—'}` }], { after: 150 });
    body += richP([{ text: 'Alimentación y hospedaje: ', bold: true }, { text: viaticosText(state.allowances) }]);
    body += richP([{ text: 'Kilómetros recorridos: ', bold: true }, { text: String(f.kilometers || '') }], { after: 150 });
    body += richP([{ text: 'Hoja Cartográfica: ', bold: true }, { text: f.mapSheet || '' }]);
    body += richP([{ text: 'Coordenadas CRTM05: ', bold: true }, { text: `Horizontales ${f.crtmX || ''}     Verticales ${f.crtmY || ''}` }]);
    if (f.latitude) body += richP([{ text: 'GPS complementario WGS84: ', bold: true }, { text: `${f.latitude}, ${f.longitude} (precisión ${f.gpsAccuracy || ''} m)` }], { after: 140 });
    body += checkboxLine('RESULTADOS:', f.RESULTS, f.results, f.resultOther ? ` Otros: ${f.resultOther}` : '');
    body += checkboxLine('EVIDENCIA DE:', f.EVIDENCE, f.evidence, f.evidenceOther ? ` Otros: ${f.evidenceOther}` : '');
    body += pXml('DESCRIPCIÓN DE RESULTADOS:', { bold: true, size: 11, after: 60, keep: true });
    body += pXml(f.resultsNarrative || '', { size: 11, after: 150 });
    if (state.contacts && state.contacts.length) {
      body += pXml('PERSONAS / ACTUACIONES REGISTRADAS:', { bold: true, size: 10, after: 40 });
      body += tableXml(['Nombre', 'Condición', 'Identificación / teléfono', 'Actuación'], state.contacts.map(x => [x.name || '', x.role || '', `${x.idn || ''} ${x.phone || ''}`, x.note || '']), [1800, 1500, 1800, 3000]);
    }
    if (state.findings && state.findings.length) {
      body += pXml('HALLAZGOS GEORREFERENCIADOS:', { bold: true, size: 10, before: 120, after: 40 });
      body += tableXml(['Hallazgo', 'CRTM05', 'Descripción', 'Medida'], state.findings.map(x => [findingLabel(x), `${x.x || ''} / ${x.y || ''}`, x.desc || '', x.action || '']), [1600, 1500, 2600, 2400]);
    }
    if (state.allowances && state.allowances.length) {
      body += pXml('ALIMENTACIÓN Y HOSPEDAJE:', { bold: true, size: 10, before: 120, after: 40 });
      body += tableXml(['Participante', 'Desayuno', 'Almuerzo', 'Cena', 'Hospedaje'], state.allowances.map(a => [a.name || '', a.breakfast ? 'X' : '', a.lunch ? 'X' : '', a.dinner ? 'X' : '', a.lodging ? 'X' : '']), [3200, 1500, 1500, 1500, 1500]);
    }
    body += pXml('RECOMENDACIONES/OBSERVACIONES:', { bold: true, size: 11, before: 130, after: 60, keep: true });
    body += pXml(f.recommendations || '', { size: 11, after: 150 });
    body += pXml('REGISTRO FOTOGRÁFICO:', { bold: true, size: 11, after: 70, keep: true });

    const rels = [
      `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`,
      `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`
    ];
    let photoId = 20;
    const photos = reportPhotos(state);
    const photoCells = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i], rid = 'rIdPhoto' + (i + 1), ext = extMime(p.dataUrl), file = `media/photo${i + 1}.${ext}`;
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${file}"/>`);
      zip.file('word/' + file, b64Data(p.dataUrl), { base64: true });
      const s = await imgSize(p.dataUrl), maxW = 2.65, maxH = 3.1, ratio = s.w / s.h;
      let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
      photoCells.push(`<w:tc><w:tcPr><w:tcW w:w="3900" w:type="dxa"/><w:tcMar><w:top w:w="50" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tcMar></w:tcPr>${pXml(`Fotografía ${i + 1}. ${p.caption || ''}`, { bold: true, size: 9, after: 30 })}<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imageRun(rid, Math.round(w * EMU), Math.round(h * EMU), photoId++)}</w:p></w:tc>`);
    }
    if (photoCells.length) {
      let photoRows = '';
      for (let i = 0; i < photoCells.length; i += 2) photoRows += `<w:tr>${photoCells[i]}${photoCells[i + 1] || '<w:tc><w:tcPr><w:tcW w:w="3900" w:type="dxa"/></w:tcPr><w:p/></w:tc>'}</w:tr>`;
      body += `<w:tbl><w:tblPr><w:tblW w:w="7800" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3900"/><w:gridCol w:w="3900"/></w:tblGrid>${photoRows}</w:tbl>`;
    } else body += pXml('Sin fotografías incorporadas.', { size: 10 });

    body += richP([{ text: 'Nombre de funcionario (a): ', bold: true }, { text: f.responsibleName || '' }, { text: '      Firma: ', bold: true }, { text: f.signatureText || '' }], { after: 70 });
    if (f.responsibleId) body += richP([{ text: 'N° Cédula: ', bold: true }, { text: f.responsibleId }]);
    body += richP([{ text: 'Voluntarios / otras instituciones: ', bold: true }, { text: (state.companions || []).map(x => x.name + (x.role ? ` (${x.role})` : '')).join('; ') }], { after: 230 });
    body += pXml('CC. ' + (f.cc || 'Archivo'), { size: 8, after: 0 });

    const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1850" w:right="1250" w:bottom="1300" w:left="1650" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sect}</w:body></w:document>`;
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${floatingImage('rIdTop', 2.45, 2.96, 2, 0, 0)}${imageP('rIdLogo', 6.7, .64, 3, 'center')}${pXml('ÁREA DE CONSERVACIÓN CENTRAL', { bold: true, align: 'center', color: '102B61', size: 10, after: 5 })}${pXml('Reserva de Biosfera Cordillera Volcánica Central', { align: 'center', color: '102B61', size: 10, after: 5 })}${pXml('BLOQUE TAPANTÍ MACIZO DE LA MUERTE', { bold: true, align: 'center', color: '102B61', size: 10, after: 0 })}</w:hdr>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${floatingImage('rIdBottom', 4.1, 2.32, 4, 4.15, 9.36)}${pXml('Dirección: Villa Mills, 2 km sur del km 98 Ruta No. 2 Interamericana Sur, Cartago / Tel. 2200-4325', { bold: true, align: 'center', color: '102B61', size: 7, after: 0 })}${pXml('Apdo.: 11384-1000 San José, Costa Rica', { bold: true, align: 'center', color: '102B61', size: 7, after: 0 })}${pXml('www.sinac.go.cr', { bold: true, align: 'center', color: '102B61', size: 7, after: 0 })}</w:ftr>`;

    zip.file('word/document.xml', doc);
    zip.file('word/header1.xml', header);
    zip.file('word/footer1.xml', footer);
    zip.file('word/media/header_logo.png', brand.logo, { base64: true });
    zip.file('word/media/corner_top.png', brand.cornerTop, { base64: true });
    zip.file('word/media/corner_bottom.png', brand.cornerBottom, { base64: true });
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>`);
    zip.file('word/_rels/header1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/header_logo.png"/><Relationship Id="rIdTop" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/corner_top.png"/></Relationships>`);
    zip.file('word/_rels/footer1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdBottom" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/corner_bottom.png"/></Relationships>`);
    zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    download(`SINAC_Informe_Gira_${(f.tourDate || today()).replaceAll('-', '')}.docx`, blob);
  }

  window.SINAC_REPORT = { reportHTML, buildDocx, findingLabel, viaticosText, esc, fmtDate, fmtMoney, today, download, reportPhotos };
})();
