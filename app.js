import * as db from './db.js';
import { PDF } from './pdf.js';

// ---------- estado (todo en memoria; se guarda en el teléfono al cambiar) ----------
const AJ_BASE = { negocio: 'ALE', dueno: '', pctChofer: 50, decimales: 'auto', formato: 'us', moneda: '$', fotosPDF: true };
const S = { camiones: [], cargas: [], gastos: [], pagos: [], reparaciones: [], aj: { ...AJ_BASE } };
const TIPOS_GASTO = ['Petróleo', 'Peaje / casetas', 'Llantas', 'Aceite', 'Lavado', 'Comida', 'Multa', 'Seguro', 'Otro'];
const ACEITE_CADA = 10000; // millas entre cambios de aceite, si no se dice otra cosa

// ---------- iconos de línea ----------
const I = {
  caja: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  camion: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  petroleo: '<path d="M4 20V5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0114 5v15M3 20h12M4 10h10"/><path d="M14 8h2.5L19 10.5V17a1.5 1.5 0 01-3 0v-3h-2"/>',
  cartera: '<path d="M3.5 7.5a2 2 0 012-2h12v2"/><rect x="3.5" y="7.5" width="17" height="11.5" rx="2"/><path d="M16 13.3h.01"/>',
  dolar: '<path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.6 9 2.4 9 7 0 2-2 3.3-4.5 3.3s-4.5-1.3-4.5-3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  izq: '<path d="M15 5l-7 7 7 7"/>',
  der: '<path d="M9 5l7 7-7 7"/>',
  camara: '<path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z"/><circle cx="12" cy="13" r="3.3"/>',
  recibo: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
  doc: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 13h5M9.5 16.5h5"/>',
  chat: '<path d="M20 11.5a8 8 0 01-11.8 7L4 19.5l1.1-3.9A8 8 0 1120 11.5z"/>',
  persona: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
  bajar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  subir: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  tabla: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  llave: '<path d="M14.5 6.5a4 4 0 00-5.3 5.3L4 17v3h3l5.2-5.2a4 4 0 005.3-5.3l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  ruta: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3.5 3.5 0 000-7h-5a3.5 3.5 0 010-7H16"/>',
  velocimetro: '<path d="M4.5 17a8.5 8.5 0 1115 0"/><path d="M12 13l3.5-4"/><circle cx="12" cy="13.5" r="1.2"/>',
  alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
const iniciales = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

// ---------- fechas ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const hoy = () => iso(new Date());
const sumarDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
const entreDias = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5);
const lunesDe = s => sumarDias(s, -((deISO(s).getDay() + 6) % 7));
const pagoDe = lunes => sumarDias(lunes, 9); // el miércoles siguiente al domingo
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fCorta = s => { const d = deISO(s); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const fDia = s => { const d = deISO(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const fRango = l => `${fCorta(l)} – ${fCorta(sumarDias(l, 6))}`;
const mayus = s => s[0].toUpperCase() + s.slice(1);

// ---------- números ----------
function dinero(n) {
  const neg = n < -0.004; n = Math.abs(Math.round(n * 100) / 100);
  const d = S.aj.decimales === 'no' ? 0 : S.aj.decimales === 'si' ? 2 : (Number.isInteger(n) ? 0 : 2);
  return (neg ? '-' : '') + S.aj.moneda + cifra(n, d);
}
function cifra(n, d = 0) {
  const us = S.aj.formato === 'us';
  let [e, f] = (+n).toFixed(d).split('.');
  e = e.replace(/\B(?=(\d{3})+(?!\d))/g, us ? ',' : '.');
  return e + (f ? (us ? '.' : ',') + f : '');
}
const millas = n => cifra(Math.round(n)) + ' mi';
const porMilla = (plata, mi) => mi > 0 ? S.aj.moneda + cifra(plata / mi, 2) + '/mi' : '';
// Entiende "1.500", "1500,50", "1,500.50", "$ 2.300"
function numero(txt) {
  let s = String(txt ?? '').replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const p = s.lastIndexOf('.'), c = s.lastIndexOf(',');
  if (p >= 0 && c >= 0) {
    const dec = p > c ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (p >= 0 || c >= 0) {
    const partes = s.split(p >= 0 ? '.' : ',');
    s = partes.length > 2 || partes[partes.length - 1].length === 3 ? partes.join('') : partes.join('.');
  }
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
}
// Horas: "12h 33m", "12:33", "12.5"
function horas(txt) {
  const s = String(txt ?? '').trim().toLowerCase();
  if (!s) return 0;
  let m = s.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})?\s*m?$/); if (m) return +m[1] + (+(m[2] || 0)) / 60;
  m = s.match(/^(\d+)\s*m$/); if (m) return +m[1] / 60;
  return numero(s);
}
function fHoras(h) {
  if (!h) return '';
  let H = Math.floor(h), M = Math.round((h - H) * 60);
  if (M === 60) { H++; M = 0; }
  return `${H}h ${pad(M)}m`;
}
const aTexto = n => n ? (S.aj.formato === 'us' ? String(n) : String(n).replace('.', ',')) : '';

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const camion = id => S.camiones.find(c => c.id === id);
const nombreCamion = id => { const c = camion(id); return c ? c.nombre + (c.placa ? ` (${c.placa})` : '') : 'Camión borrado'; };
const ordenCamiones = () => [...S.camiones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
const activos = () => ordenCamiones().filter(c => c.activo !== false);
const suma = (l, f) => l.reduce((t, x) => t + (+(typeof f === 'function' ? f(x) : x[f]) || 0), 0);
const ruta = c => c.origen || c.destino ? `${c.origen || '?'} → ${c.destino || '?'}` : (c.detalle || 'Carga');

function avisar(msg) {
  const a = $('#aviso'); a.textContent = msg; a.classList.add('ver');
  clearTimeout(avisar.t); avisar.t = setTimeout(() => a.classList.remove('ver'), 2600);
}
async function guardar(tabla, obj) {
  const lista = S[tabla], i = lista.findIndex(x => x.id === obj.id);
  if (i >= 0) lista[i] = obj; else lista.push(obj);
  await db.guardar(tabla, obj);
}
async function borrar(tabla, id) {
  S[tabla] = S[tabla].filter(x => x.id !== id);
  await db.borrar(tabla, id);
}

// ---------- reparaciones y estado de los camiones ----------
const finRep = r => sumarDias(r.inicio, Math.max(1, r.dias || 1) - 1);  // último día parado
// "listo" = el día que se marcó que ya está trabajando (corta la reparación aunque falten días)
const enRep = (r, dia) => r.inicio <= dia && finRep(r) >= dia && !(r.listo && r.listo <= dia);
const repActiva = (camionId, dia = hoy()) => S.reparaciones.find(r => r.camionId === camionId && enRep(r, dia));
// días parados de una reparación dentro de un rango
const diasEn = (r, desde, hasta) => {
  const a = r.inicio > desde ? r.inicio : desde, b = finRep(r) < hasta ? finRep(r) : hasta;
  return a > b ? 0 : entreDias(a, b) + 1;
};
const pillEstado = c => {
  if (c.activo === false) return '<span class="pill gris">Fuera de servicio</span>';
  return repActiva(c.id) ? `<span class="pill taller">${ic('llave')} En reparación</span>` : `<span class="pill ok">${ic('check')} Trabajando</span>`;
};

// avisos de papeles y mantenimiento
function millasDesde(camionId, fecha) { return suma(S.cargas.filter(x => x.camionId === camionId && (!fecha || x.fecha >= fecha)), 'millas'); }
function avisosDe(c) {
  if (c.activo === false) return [];
  const a = [], h = hoy();
  for (const [campo, nombre] of [['seguro', 'Seguro'], ['registro', 'Registro / placa'], ['inspeccion', 'Inspección anual']]) {
    if (!c[campo]) continue;
    const d = entreDias(h, c[campo]);
    if (d < 0) a.push({ txt: `${nombre} vencido hace ${-d} ${-d === 1 ? 'día' : 'días'}`, grave: true });
    else if (d <= 30) a.push({ txt: `${nombre} vence en ${d} ${d === 1 ? 'día' : 'días'}`, grave: d <= 7 });
  }
  if (c.aceiteFecha) {
    const cada = c.aceiteCada || ACEITE_CADA, hechas = millasDesde(c.id, c.aceiteFecha);
    if (hechas >= cada) a.push({ txt: `Toca cambio de aceite (${millas(hechas)} desde el último)`, grave: true });
    else if (hechas >= cada * .9) a.push({ txt: `Cambio de aceite pronto: faltan ${millas(cada - hechas)}`, grave: false });
  }
  return a;
}
const todosLosAvisos = () => activos().flatMap(c => avisosDe(c).map(x => ({ ...x, c })));

// ---------- cálculo de la semana ----------
// Agrupa por camión + chofer. limpio = cobrado - petróleo - gastos compartidos; luego se reparte.
function liquidacion(lunes) {
  const fin = sumarDias(lunes, 6), dentro = x => x.fecha >= lunes && x.fecha <= fin;
  const grupos = new Map();
  const grupo = (camionId, chofer) => {
    const k = camionId + '|' + (chofer || '');
    if (!grupos.has(k)) grupos.set(k, { k, camionId, chofer: chofer || '', cargas: [], gastos: [], soloDueno: [] });
    return grupos.get(k);
  };
  // las reparaciones con costo cuentan como gasto en la semana en que empezaron
  const deTaller = S.reparaciones.filter(r => r.costo > 0).map(r => ({ id: r.id, fecha: r.inicio, camionId: r.camionId, chofer: r.chofer, tipo: 'Reparación', detalle: r.detalle, monto: r.costo, compartido: r.compartido, creado: r.creado }));
  S.cargas.filter(dentro).forEach(c => grupo(c.camionId, c.chofer).cargas.push(c));
  [...S.gastos, ...deTaller].filter(dentro).forEach(g => { const gr = grupo(g.camionId, g.chofer); (g.compartido ? gr.gastos : gr.soloDueno).push(g); });
  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado;
  return [...grupos.values()].map(g => {
    g.cargas.sort(porFecha); g.gastos.sort(porFecha); g.soloDueno.sort(porFecha);
    g.pago = S.pagos.find(p => p.id === lunes + '|' + g.k);
    g.pct = g.pago ? g.pago.pct : S.aj.pctChofer;
    g.cobrado = suma(g.cargas, 'cobrado');
    g.petroleo = suma(g.cargas, 'petroleo');
    g.millas = suma(g.cargas, 'millas');
    g.horas = suma(g.cargas, 'horas');
    g.otros = suma(g.gastos, 'monto');
    g.limpio = g.cobrado - g.petroleo - g.otros;
    g.paraChofer = Math.round(g.limpio * g.pct) / 100;
    g.paraDueno = g.limpio - g.paraChofer;
    g.gastoDueno = suma(g.soloDueno, 'monto');
    g.diasTaller = suma(S.reparaciones.filter(r => r.camionId === g.camionId), r => diasEn(r, lunes, fin));
    return g;
  }).sort((a, b) => nombreCamion(a.camionId).localeCompare(nombreCamion(b.camionId), 'es', { numeric: true }));
}

// ---------- fotos ----------
function comprimir(archivo, max = 1400, calidad = .72) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok({ d: cv.toDataURL('image/jpeg', calidad), w, h });
    };
    im.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
    im.src = url;
  });
}
function verFoto(d) { const v = $('#visor'); v.querySelector('img').src = d; v.hidden = false; }

// ---------- compartir / descargar archivos ----------
function descargar(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function compartir(blob, nombre) {
  const archivo = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre }); }
    catch (e) { if (e.name !== 'AbortError') descargar(blob, nombre); }
  } else descargar(blob, nombre);
}

// ---------- navegación ----------
let vista = 'cargas';
let semana = lunesDe(hoy());                     // semana que se ve en Cargas
let semanaPago = sumarDias(lunesDe(hoy()), -7);  // semana que se paga este miércoles
let semanaTaller = lunesDe(hoy());               // semana que se ve en Reparación

function ir(v) {
  vista = v;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('activo', b.dataset.v === v));
  pintar();
  window.scrollTo(0, 0);
}
function pintar() {
  $('#titulo').textContent = { cargas: 'Cargas', pagos: 'Pagos', camiones: 'Camiones', taller: 'Reparación', mas: 'Ajustes' }[vista];
  $('#negocio').textContent = (S.aj.negocio && S.aj.negocio !== 'ALE' ? S.aj.negocio + ' · ' : '') + mayus(fDia(hoy()));
  $('#vista').innerHTML = ({ cargas: vistaCargas, pagos: vistaPagos, camiones: vistaCamiones, taller: vistaTaller, mas: vistaMas })[vista]();
}

const selectorSemana = (l, a, texto) => `
  <div class="semana">
    <button class="flecha" data-a="${a}" data-d="-7" aria-label="Semana anterior">${ic('izq')}</button>
    <div><b>${fRango(l)}</b><small>${texto ?? `Se paga el miércoles ${fCorta(pagoDe(l))}`}</small></div>
    <button class="flecha" data-a="${a}" data-d="7" aria-label="Semana siguiente">${ic('der')}</button>
  </div>`;
const stat = (icono, txt, valor, color = '') => `<div class="stat"><span class="ico ${color}">${ic(icono)}</span><div><small>${txt}</small><b class="${color}">${valor}</b></div></div>`;

// ---------- vista: cargas ----------
function vistaCargas() {
  if (!S.camiones.length) return `
    <div class="vacio">
      <img src="logo-ale.png" alt="ALE">
      <h2>Bienvenido</h2>
      <p>Primero agrega tus camiones con el nombre de cada chofer. Después ya puedes anotar las cargas.</p>
      <button class="btn grande" data-a="nuevoCamion">${ic('mas')} Agregar mi primer camión</button>
    </div>`;
  const fin = sumarDias(semana, 6), dentro = x => x.fecha >= semana && x.fecha <= fin;
  const cargas = S.cargas.filter(dentro), gastos = S.gastos.filter(dentro);
  const cobrado = suma(cargas, 'cobrado'), petroleo = suma(cargas, 'petroleo'), mi = suma(cargas, 'millas');
  const otros = suma(gastos.filter(g => g.compartido), 'monto') + suma(S.reparaciones.filter(r => r.compartido && dentro({ fecha: r.inicio })), 'costo');
  const dias = [...new Set([...cargas, ...gastos].map(x => x.fecha))].sort().reverse();
  const avisos = todosLosAvisos(), enTaller = activos().filter(c => repActiva(c.id));
  return `
    ${avisos.length || enTaller.length ? `<button class="banner gris toque" data-a="irCamiones">${ic('alerta')} ${[
      enTaller.length ? `${enTaller.length} en reparación` : '', avisos.length ? `${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'} de papeles o aceite` : ''].filter(Boolean).join(' · ')} ${ic('der')}</button>` : ''}
    ${selectorSemana(semana, 'semana')}
    ${semana === lunesDe(hoy()) ? '' : '<button class="link centro" data-a="semanaHoy">Volver a esta semana</button>'}
    <div class="stats seis">
      ${stat('caja', 'Cargas', cargas.length)}
      ${stat('dolar', 'Cobrado', dinero(cobrado))}
      ${stat('ruta', 'Millas', cifra(Math.round(mi)))}
      ${stat('velocimetro', 'Por milla', mi ? porMilla(cobrado, mi) : '—')}
      ${stat('petroleo', 'Petróleo', dinero(-petroleo), 'rojo')}
      ${stat('cartera', 'Limpio', dinero(cobrado - petroleo - otros), 'verde')}
    </div>
    <div class="botones">
      <button class="btn grande" data-a="nuevaCarga">${ic('mas')} Nueva carga</button>
      <button class="btn grande sec" data-a="nuevoGasto">${ic('recibo')} Gasto</button>
    </div>
    ${dias.length ? dias.map(d => `
      <h3 class="dia">${fDia(d)}</h3>
      <div class="grupo">
        ${cargas.filter(c => c.fecha === d).sort((a, b) => b.creado - a.creado).map(filaCarga).join('')}
        ${gastos.filter(g => g.fecha === d).sort((a, b) => b.creado - a.creado).map(filaGasto).join('')}
      </div>
    `).join('') : `<p class="nada">No hay cargas anotadas en esta semana.</p>`}`;
}
const filaCarga = c => {
  const cam = camion(c.camionId);
  const datos = [c.viaje, c.millas ? millas(c.millas) : '', c.horas ? fHoras(c.horas) : ''].filter(Boolean).join(' · ');
  return `
  <button class="fila larga" data-a="editarCarga" data-id="${c.id}">
    ${c.fotos?.[0] ? `<img class="mini" src="${c.fotos[0].d}" alt="">` : `<span class="mini icono">${ic('caja')}</span>`}
    <span class="txt"><b>${esc(ruta(c))}</b><small>${esc(c.chofer || 'Sin chofer')} · ${esc(cam ? cam.nombre : 'Camión borrado')}</small>${datos ? `<small>${esc(datos)}</small>` : ''}</span>
    <span class="num"><b>${dinero(c.cobrado)}</b>${c.millas ? `<small>${porMilla(c.cobrado, c.millas)}</small>` : ''}<small class="rojo">${dinero(-c.petroleo)}</small><small class="verde">${dinero(c.cobrado - c.petroleo)}</small></span>
  </button>`;
};
const filaGasto = g => `
  <button class="fila" data-a="editarGasto" data-id="${g.id}">
    <span class="mini icono gasto">${ic('recibo')}</span>
    <span class="txt"><b>${esc(g.tipo)}</b><small>${esc(camion(g.camionId)?.nombre || '')}${g.detalle ? ' · ' + esc(g.detalle) : ''}</small></span>
    <span class="num"><b class="rojo">${dinero(-g.monto)}</b><small>${g.compartido ? 'Mitad y mitad' : 'Solo dueño'}</small></span>
  </button>`;

// ---------- vista: pagos ----------
function vistaPagos() {
  const lista = liquidacion(semanaPago), pago = pagoDe(semanaPago), h = hoy();
  const totalChofer = suma(lista, 'paraChofer'), totalDueno = suma(lista, g => g.paraDueno - g.gastoDueno);
  const estado = h === pago ? `<div class="banner hoy">${ic('dolar')} Hoy es miércoles: toca pagar esta semana</div>`
    : h < pago && h > sumarDias(semanaPago, 6) ? `<div class="banner">${ic('reloj')} Se paga el miércoles ${fCorta(pago)}</div>`
      : h <= sumarDias(semanaPago, 6) ? `<div class="banner gris">${ic('reloj')} Semana en curso: se va sumando con cada carga</div>` : '';
  return `
    ${selectorSemana(semanaPago, 'semanaPago')}
    ${estado}
    ${lista.length ? `
      <div class="stats">
        ${stat('persona', 'Para choferes', dinero(totalChofer))}
        ${stat('cartera', 'Para el dueño', dinero(totalDueno), 'verde')}
      </div>
      ${lista.map(tarjetaPago).join('')}
      <label class="check radio"><input type="checkbox" data-a="fotosPDF" ${S.aj.fotosPDF ? 'checked' : ''}> Poner las fotos de las cargas en el PDF</label>`
    : '<p class="nada">No hay cargas en esta semana.</p>'}`;
}
function tarjetaPago(g) {
  const pagado = !!g.pago;
  return `
  <div class="tarjeta">
    <div class="cab">
      <span class="avatar">${esc(iniciales(g.chofer))}</span>
      <div class="quien"><b>${esc(g.chofer || 'Sin chofer')}</b><small>${esc(nombreCamion(g.camionId))} · ${g.cargas.length} ${g.cargas.length === 1 ? 'carga' : 'cargas'}</small></div>
      ${pagado ? `<span class="pill ok">${ic('check')} Pagado</span>` : '<span class="pill pend">Pendiente</span>'}
    </div>
    <div class="chips">
      ${g.millas ? `<span>${ic('ruta')} ${millas(g.millas)}</span><span>${ic('velocimetro')} ${porMilla(g.cobrado, g.millas)}</span>` : ''}
      ${g.horas ? `<span>${ic('reloj')} ${fHoras(g.horas)}</span>` : ''}
      ${g.diasTaller ? `<span class="naranja">${ic('llave')} ${g.diasTaller} ${g.diasTaller === 1 ? 'día' : 'días'} en reparación</span>` : ''}
    </div>
    <div class="linea"><span>Cobrado</span><span>${dinero(g.cobrado)}</span></div>
    <div class="linea"><span>Petróleo</span><span class="rojo">${dinero(-g.petroleo)}</span></div>
    ${g.otros ? `<div class="linea"><span>Otros gastos (mitad y mitad)</span><span class="rojo">${dinero(-g.otros)}</span></div>` : ''}
    <div class="linea total"><span>Limpio</span><span>${dinero(g.limpio)}</span></div>
    <div class="reparto">
      <div class="chofer"><small>Chofer (${g.pct}%)</small><b>${dinero(g.paraChofer)}</b></div>
      <div><small>Dueño (${100 - g.pct}%)</small><b>${dinero(g.paraDueno)}</b></div>
    </div>
    ${g.gastoDueno ? `<div class="linea nota"><span>Gastos que paga solo el dueño</span><span class="rojo">${dinero(-g.gastoDueno)}</span></div>
      <div class="linea nota"><span>Al dueño le queda</span><span>${dinero(g.paraDueno - g.gastoDueno)}</span></div>` : ''}
    <div class="acciones">
      <button class="btn" data-a="pdf" data-k="${esc(g.k)}">${ic('doc')} Enviar PDF</button>
      <button class="btn suave" data-a="mensaje" data-k="${esc(g.k)}">${ic('chat')} Mensaje</button>
      <button class="btn ${pagado ? 'suave' : 'ok'}" data-a="pagado" data-k="${esc(g.k)}">${pagado ? `Pagado el ${fCorta(g.pago.fecha)} · quitar` : `${ic('check')} Marcar pagado`}</button>
    </div>
  </div>`;
}

// ---------- vista: camiones ----------
function vistaCamiones() {
  const lista = ordenCamiones(), act = lista.filter(c => c.activo !== false), fuera = lista.filter(c => c.activo === false);
  const fila = c => {
    const rep = repActiva(c.id), av = avisosDe(c);
    return `
    <button class="fila larga" data-a="editarCamion" data-id="${c.id}">
      <span class="mini icono ${rep ? 'gasto' : ''}">${ic(rep ? 'llave' : 'camion')}</span>
      <span class="txt"><b>${esc(c.nombre)}${c.placa ? `<span class="placa">${esc(c.placa)}</span>` : ''}</b>
        <small>${ic('persona', 'mini-i')} ${esc(c.chofer || 'Sin chofer')}${c.telefono ? ' · ' + esc(c.telefono) : ''}</small>
        <span class="estado">${pillEstado(c)}</span>
        ${rep ? `<small class="naranja">Vuelve a trabajar el ${fDia(sumarDias(finRep(rep), 1))}${rep.detalle ? ' · ' + esc(rep.detalle) : ''}</small>` : ''}
        ${av.map(x => `<small class="${x.grave ? 'rojo' : 'naranja'}">${ic('alerta', 'mini-i')} ${esc(x.txt)}</small>`).join('')}
      </span>
      ${ic('der', 'chev')}
    </button>`;
  };
  const trabajando = act.filter(c => !repActiva(c.id)).length;
  return `
    <div class="stats">
      ${stat('camion', 'Trabajando', trabajando, 'verde')}
      ${stat('llave', 'En reparación', act.length - trabajando, act.length - trabajando ? 'naranja' : '')}
    </div>
    <button class="btn grande" data-a="nuevoCamion">${ic('mas')} Agregar camión</button>
    ${act.length ? `<h3 class="dia">En servicio</h3><div class="grupo">${act.map(fila).join('')}</div>` : '<p class="nada">Todavía no hay camiones.</p>'}
    ${fuera.length ? `<h3 class="dia">Fuera de servicio / vendidos</h3><div class="grupo">${fuera.map(fila).join('')}</div>` : ''}`;
}

// ---------- vista: reparación ----------
function vistaTaller() {
  if (!S.camiones.length) return '<p class="nada">Primero agrega tus camiones.</p>';
  const h = hoy(), l = semanaTaller, fin = sumarDias(l, 6);
  const enTaller = S.reparaciones.filter(r => enRep(r, h) && camion(r.camionId)?.activo !== false);
  const deSemana = S.reparaciones.filter(r => diasEn(r, l, fin) > 0).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const mesIni = h.slice(0, 8) + '01', mesFin = sumarDias(sumarDias(mesIni, 32).slice(0, 8) + '01', -1);
  const delMes = S.reparaciones.filter(r => diasEn(r, mesIni, mesFin) > 0);
  const anio = h.slice(0, 4), delAnio = S.reparaciones.filter(r => r.inicio.startsWith(anio));
  const act = activos();
  const filaRep = (r, desde, hasta) => {
    const dias = desde ? diasEn(r, desde, hasta) : r.dias;
    return `
    <button class="fila" data-a="editarRep" data-id="${r.id}">
      <span class="mini icono gasto">${ic('llave')}</span>
      <span class="txt"><b>${esc(nombreCamion(r.camionId))}</b><small>${esc(r.detalle || 'Reparación')}${r.taller ? ' · ' + esc(r.taller) : ''}</small>
        <small>${fCorta(r.inicio)} al ${fCorta(finRep(r))} · ${dias} ${dias === 1 ? 'día parado' : 'días parado'}</small></span>
      <span class="num">${r.costo ? `<b class="rojo">${dinero(-r.costo)}</b><small>${r.compartido ? 'Mitad y mitad' : 'Solo dueño'}</small>` : '<small>Sin costo</small>'}</span>
    </button>`;
  };
  const porCamion = act.map(c => {
    const rs = delAnio.filter(r => r.camionId === c.id);
    return { c, veces: rs.length, dias: suma(rs, 'dias'), costo: suma(rs, 'costo') };
  }).filter(x => x.veces);
  return `
    <div class="stats">
      ${stat('camion', 'Trabajando', act.filter(c => !repActiva(c.id)).length, 'verde')}
      ${stat('llave', 'En reparación', enTaller.length, enTaller.length ? 'naranja' : '')}
      ${stat('calendario', 'Días parados este mes', suma(delMes, r => diasEn(r, mesIni, mesFin)))}
      ${stat('dolar', 'Reparaciones este mes', dinero(suma(delMes.filter(r => r.inicio >= mesIni), 'costo')), 'rojo')}
    </div>
    <button class="btn grande" data-a="nuevaRep">${ic('mas')} Anotar reparación</button>

    ${enTaller.length ? `<h3 class="dia">Ahora en reparación</h3>
      ${enTaller.map(r => {
        const quedan = entreDias(h, finRep(r)) + 1;
        return `<div class="tarjeta taller">
          <div class="cab"><span class="avatar naranja">${ic('llave')}</span>
            <div class="quien"><b>${esc(nombreCamion(r.camionId))}</b><small>${esc(r.detalle || 'Reparación')}${r.taller ? ' · ' + esc(r.taller) : ''}</small></div>
            <span class="pill taller">${quedan} ${quedan === 1 ? 'día' : 'días'}</span></div>
          <div class="linea"><span>Parado desde</span><span>${fDia(r.inicio)}</span></div>
          <div class="linea"><span>Vuelve a trabajar</span><span><b>${fDia(sumarDias(finRep(r), 1))}</b></span></div>
          ${r.costo ? `<div class="linea"><span>Costo</span><span class="rojo">${dinero(r.costo)}</span></div>` : ''}
          <div class="acciones una"><button class="btn ok" data-a="repLista" data-id="${r.id}">${ic('check')} Ya está trabajando</button>
          <button class="btn suave" data-a="editarRep" data-id="${r.id}">Cambiar días</button></div>
        </div>`;
      }).join('')}` : ''}

    <h3 class="dia">Estado de los camiones</h3>
    <div class="grupo">${act.map(c => `
      <div class="fila quieta"><span class="mini icono ${repActiva(c.id) ? 'gasto' : ''}">${ic(repActiva(c.id) ? 'llave' : 'camion')}</span>
        <span class="txt"><b>${esc(c.nombre)}${c.placa ? `<span class="placa">${esc(c.placa)}</span>` : ''}</b><small>${esc(c.chofer || 'Sin chofer')}</small></span>
        <span class="num">${pillEstado(c)}</span></div>`).join('')}</div>

    <h3 class="dia">Reparaciones por semana</h3>
    ${selectorSemana(l, 'semanaTaller', deSemana.length ? `${suma(deSemana, r => diasEn(r, l, fin))} días parados en total` : 'Sin reparaciones esta semana')}
    ${deSemana.length ? `<div class="grupo">${deSemana.map(r => filaRep(r, l, fin)).join('')}</div>` : ''}

    ${porCamion.length ? `<h3 class="dia">Cuenta del año ${anio} por camión</h3>
      <div class="grupo">${porCamion.map(x => `
        <div class="fila quieta"><span class="mini icono">${ic('camion')}</span>
          <span class="txt"><b>${esc(x.c.nombre)}</b><small>${x.veces} ${x.veces === 1 ? 'reparación' : 'reparaciones'} · ${x.dias} ${x.dias === 1 ? 'día parado' : 'días parado'}</small></span>
          <span class="num"><b class="rojo">${dinero(x.costo)}</b></span></div>`).join('')}</div>` : ''}`;
}

// ---------- vista: ajustes ----------
function vistaMas() {
  const a = S.aj;
  return `
    <div class="tarjeta">
      <h3>Datos del negocio</h3>
      <label>Nombre del negocio<input id="ajNegocio" value="${esc(a.negocio)}"></label>
      <label>Nombre del dueño<input id="ajDueno" value="${esc(a.dueno)}" placeholder="Sale en el PDF"></label>
      <label>Porcentaje para el chofer
        <div class="pct"><input id="ajPct" type="number" inputmode="numeric" min="0" max="100" value="${a.pctChofer}"><span>% chofer · el resto para el dueño</span></div>
      </label>
      <label>Forma de escribir el dinero
        <select id="ajFormato">
          <option value="us" ${a.formato === 'us' ? 'selected' : ''}>Estados Unidos ($1,500.50)</option>
          <option value="lat" ${a.formato === 'lat' ? 'selected' : ''}>Latinoamérica ($1.500,50)</option>
        </select>
      </label>
      <label>Centavos
        <select id="ajDec">
          <option value="auto" ${a.decimales === 'auto' ? 'selected' : ''}>Solo si hay centavos</option>
          <option value="si" ${a.decimales === 'si' ? 'selected' : ''}>Siempre</option>
          <option value="no" ${a.decimales === 'no' ? 'selected' : ''}>Nunca</option>
        </select>
      </label>
      <button class="btn" data-a="guardarAjustes">${ic('check')} Guardar</button>
    </div>
    <div class="tarjeta">
      <h3>Copia de seguridad</h3>
      <p class="ayuda">Todo se guarda solo en este teléfono. Haz una copia de vez en cuando y guárdala en tu iCloud o mándatela por WhatsApp. Si cambias de teléfono, la recuperas aquí.</p>
      <button class="btn" data-a="respaldo">${ic('bajar')} Guardar copia de seguridad</button>
      <button class="btn suave" data-a="recuperar">${ic('subir')} Recuperar una copia</button>
      <input type="file" id="archivoRespaldo" accept=".json,application/json" hidden>
    </div>
    <div class="tarjeta">
      <h3>Excel</h3>
      <p class="ayuda">Saca todas las cargas, gastos y reparaciones en un archivo que abre Excel o Numbers.</p>
      <button class="btn suave" data-a="excel">${ic('tabla')} Exportar a Excel</button>
    </div>
    <div class="tarjeta">
      <h3>Instalar en el teléfono</h3>
      <p class="ayuda"><b>iPhone:</b> abre esta página en <b>Safari</b>, toca <b>Compartir</b> (el cuadrito con la flecha hacia arriba) y elige <b>“Agregar a pantalla de inicio”</b>.<br><b>Android:</b> ábrela en <b>Chrome</b>, toca los <b>tres puntitos ⋮</b> y elige <b>“Instalar app”</b> o <b>“Agregar a pantalla principal”</b>.</p>
    </div>
    <p class="pie">${S.cargas.length} cargas · ${S.gastos.length} gastos · ${S.reparaciones.length} reparaciones · ${S.camiones.length} camiones guardados en este aparato</p>`;
}

// ---------- hoja (formulario que sube desde abajo) ----------
function abrirHoja(titulo, html) {
  $('#hojaTitulo').textContent = titulo;
  $('#hojaCuerpo').innerHTML = html;
  $('#hoja').hidden = false;
  requestAnimationFrame(() => $('#hoja').classList.add('abierta'));
  $('#hojaCuerpo').scrollTop = 0;
}
function cerrarHoja() {
  $('#hoja').classList.remove('abierta');
  setTimeout(() => { $('#hoja').hidden = true; $('#hojaCuerpo').innerHTML = ''; }, 220);
}
const opcionesCamion = sel => ordenCamiones().filter(c => c.activo !== false || c.id === sel)
  .map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}${c.placa ? ' (' + esc(c.placa) + ')' : ''}</option>`).join('');
const avisoPagada = fecha => {
  const l = lunesDe(fecha);
  return S.pagos.some(p => p.lunes === l) ? '<div class="banner gris">Ojo: esa semana ya tiene pagos marcados.</div>' : '';
};
const lugares = () => `<datalist id="lugares">${[...new Set(S.cargas.flatMap(c => [c.origen, c.destino]).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;

// fotos del formulario abierto
let fotosForm = [], reciboForm = null;
function pintarFotos() {
  $('#fotos').innerHTML = fotosForm.map((f, i) => `
    <div class="foto"><img src="${f.d}" data-a="verFoto" data-i="${i}" alt=""><button type="button" data-a="quitarFoto" data-i="${i}" aria-label="Quitar foto">×</button></div>`).join('')
    + `<label class="foto mas">${ic('camara')}<span>Agregar foto</span><input type="file" accept="image/*" multiple data-a="subirFotos" hidden></label>`;
}
function pintarRecibo() {
  $('#recibo').innerHTML = reciboForm
    ? `<div class="foto"><img src="${reciboForm.d}" data-a="verRecibo" alt=""><button type="button" data-a="quitarRecibo" aria-label="Quitar foto">×</button></div>`
    : `<label class="foto mas">${ic('recibo')}<span>Foto del recibo</span><input type="file" accept="image/*" data-a="subirRecibo" hidden></label>`;
}

function formCarga(c) {
  const nuevo = !c;
  const ultimo = [...S.cargas].sort((a, b) => b.creado - a.creado)[0];
  c = c || { fecha: hoy(), camionId: ultimo && camion(ultimo.camionId)?.activo !== false ? ultimo.camionId : activos()[0]?.id, cobrado: 0, petroleo: 0, fotos: [], tipo: 'Spot', origen: ultimo?.origen || '' };
  if (nuevo) c.chofer = camion(c.camionId)?.chofer || '';
  fotosForm = [...(c.fotos || [])]; reciboForm = c.recibo || null;
  const rep = nuevo ? repActiva(c.camionId, c.fecha) : null;
  abrirHoja(nuevo ? 'Nueva carga' : 'Editar carga', `
    <form id="formCarga" data-id="${c.id || ''}">
      ${nuevo ? '' : avisoPagada(c.fecha)}
      ${rep ? '<div class="banner gris">Ojo: ese camión está anotado en reparación ese día.</div>' : ''}
      <div class="dos">
        <label>Fecha<input type="date" name="fecha" value="${c.fecha}" required></label>
        <label>Tipo<select name="tipo">${['Spot', 'Contrato', 'Otro'].map(t => `<option ${t === (c.tipo || 'Spot') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label>Camión<select name="camionId" data-a="cambiaCamion">${opcionesCamion(c.camionId)}</select></label>
      <label>Chofer<input name="chofer" value="${esc(c.chofer)}" placeholder="Nombre del chofer"></label>
      <label>ID del viaje <small>(opcional)</small><input name="viaje" value="${esc(c.viaje)}" placeholder="Ej: T-11343S428" autocapitalize="characters"></label>
      <label>Sale de<input name="origen" value="${esc(c.origen)}" placeholder="Ej: BNA5 Nashville, TN" list="lugares"></label>
      <label>Llega a<input name="destino" value="${esc(c.destino || (c.origen ? '' : c.detalle || ''))}" placeholder="Ej: HSV1 Madison, AL" list="lugares"></label>
      ${lugares()}
      <div class="dos">
        <label>Millas<input name="millas" inputmode="decimal" value="${aTexto(c.millas)}" placeholder="0" data-a="calc"></label>
        <label>Horas trabajadas<input name="horas" value="${fHoras(c.horas)}" placeholder="Ej: 9h 30m" data-a="calc"></label>
      </div>
      <label>Pago de la carga<input name="cobrado" inputmode="decimal" value="${aTexto(c.cobrado)}" placeholder="0" data-a="calc"></label>
      <label>Petróleo usado en esta carga<input name="petroleo" inputmode="decimal" value="${aTexto(c.petroleo)}" placeholder="0" data-a="calc"></label>
      <div class="cuenta" id="cuenta"></div>
      <div class="campo"><span>Fotos de la carga</span><div class="fotos" id="fotos"></div></div>
      <div class="campo"><span>Recibo del petróleo <small>(opcional)</small></span><div class="fotos" id="recibo"></div></div>
      <button class="btn grande" type="submit">${ic('check')} Guardar carga</button>
      ${nuevo ? '' : '<button class="btn borrar" type="button" data-a="borrarCarga">Borrar esta carga</button>'}
    </form>`);
  pintarFotos(); pintarRecibo(); calcCarga();
}
function calcCarga() {
  const f = $('#formCarga'); if (!f) return;
  const cob = numero(f.cobrado.value), pet = numero(f.petroleo.value), mi = numero(f.millas.value), hr = horas(f.horas.value);
  $('#cuenta').innerHTML = `
    <div><small>Por milla</small><b>${mi ? porMilla(cob, mi) : '—'}</b></div>
    <div><small>Por hora</small><b>${hr ? S.aj.moneda + cifra(cob / hr, 2) + '/h' : '—'}</b></div>
    <div class="verde"><small>Limpio</small><b>${dinero(cob - pet)}</b></div>`;
}

function formGasto(g) {
  const nuevo = !g;
  g = g || { fecha: hoy(), camionId: activos()[0]?.id, tipo: TIPOS_GASTO[1], monto: 0, compartido: true };
  reciboForm = g.recibo || null;
  abrirHoja(nuevo ? 'Otro gasto' : 'Editar gasto', `
    <form id="formGasto" data-id="${g.id || ''}">
      ${nuevo ? '' : avisoPagada(g.fecha)}
      <p class="ayuda">El petróleo de cada carga va en la carga, y las reparaciones en la pestaña <b>Reparación</b>. Aquí van los demás gastos: peajes, llantas, multas…</p>
      <label>Fecha<input type="date" name="fecha" value="${g.fecha}" required></label>
      <label>Camión<select name="camionId">${opcionesCamion(g.camionId)}</select></label>
      <label>Tipo de gasto<select name="tipo">${[...new Set([...TIPOS_GASTO, g.tipo])].map(t => `<option ${t === g.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>Detalle <small>(opcional)</small><input name="detalle" value="${esc(g.detalle)}"></label>
      <label>Monto<input name="monto" inputmode="decimal" value="${aTexto(g.monto)}" placeholder="0"></label>
      ${radiosQuienPaga(g.compartido)}
      <div class="campo"><span>Foto del recibo <small>(opcional)</small></span><div class="fotos" id="recibo"></div></div>
      <button class="btn grande" type="submit">${ic('check')} Guardar gasto</button>
      ${nuevo ? '' : '<button class="btn borrar" type="button" data-a="borrarGasto">Borrar este gasto</button>'}
    </form>`);
  pintarRecibo();
}
const radiosQuienPaga = compartido => `
  <div class="campo"><span>¿Quién lo paga?</span>
    <label class="radio"><input type="radio" name="compartido" value="1" ${compartido ? 'checked' : ''}> Mitad y mitad <small>(se resta antes de repartir)</small></label>
    <label class="radio"><input type="radio" name="compartido" value="0" ${compartido ? '' : 'checked'}> Solo el dueño <small>(no le afecta al chofer)</small></label>
  </div>`;

function formRep(r) {
  const nuevo = !r?.id;
  r = r || { inicio: hoy(), camionId: activos().find(c => !repActiva(c.id))?.id || activos()[0]?.id, dias: 1, costo: 0, compartido: false };
  reciboForm = r.recibo || null;
  abrirHoja(nuevo ? 'Anotar reparación' : 'Editar reparación', `
    <form id="formRep" data-id="${r.id || ''}">
      <p class="ayuda">Mientras dure la reparación, el camión sale como <b>“En reparación”</b>. Cuando pasen los días vuelve solo a <b>“Trabajando”</b>.</p>
      <label>Camión<select name="camionId">${opcionesCamion(r.camionId)}</select></label>
      <div class="dos">
        <label>Se para el día<input type="date" name="inicio" value="${r.inicio}" required data-a="calcRep"></label>
        <label>¿Cuántos días?<input name="dias" type="number" inputmode="numeric" min="1" value="${r.dias}" data-a="calcRep"></label>
      </div>
      <div class="cuenta una" id="vuelve"></div>
      <label>¿Qué se reparó?<input name="detalle" value="${esc(r.detalle)}" placeholder="Ej: frenos, transmisión, llanta…"></label>
      <label>Taller o mecánico <small>(opcional)</small><input name="taller" value="${esc(r.taller)}"></label>
      <label>Costo <small>(si todavía no sabes, déjalo en 0)</small><input name="costo" inputmode="decimal" value="${aTexto(r.costo)}" placeholder="0"></label>
      ${radiosQuienPaga(r.compartido)}
      <div class="campo"><span>Foto de la factura <small>(opcional)</small></span><div class="fotos" id="recibo"></div></div>
      <button class="btn grande" type="submit">${ic('check')} Guardar reparación</button>
      ${nuevo ? '' : '<button class="btn borrar" type="button" data-a="borrarRep">Borrar esta reparación</button>'}
    </form>`);
  pintarRecibo(); calcRep();
}
function calcRep() {
  const f = $('#formRep'); if (!f || !f.inicio.value) return;
  const dias = Math.max(1, parseInt(f.dias.value) || 1);
  $('#vuelve').innerHTML = `<div><small>Vuelve a trabajar el</small><b>${mayus(fDia(sumarDias(f.inicio.value, dias)))}</b></div>`;
}

function formCamion(c) {
  const nuevo = !c;
  if (nuevo) {
    let n = S.camiones.length + 1;
    while (S.camiones.some(x => x.nombre.toLowerCase() === 'camión ' + n)) n++;
    c = { nombre: 'Camión ' + n, activo: true };
  }
  const usado = !nuevo && (S.cargas.some(x => x.camionId === c.id) || S.gastos.some(x => x.camionId === c.id) || S.reparaciones.some(x => x.camionId === c.id));
  let resumen = '';
  if (!nuevo) {
    const h = hoy(), mesIni = h.slice(0, 8) + '01';
    const cm = S.cargas.filter(x => x.camionId === c.id && x.fecha >= mesIni);
    const rs = S.reparaciones.filter(x => x.camionId === c.id);
    const cob = suma(cm, 'cobrado'), mi = suma(cm, 'millas');
    const cada = c.aceiteCada || ACEITE_CADA, hechas = c.aceiteFecha ? millasDesde(c.id, c.aceiteFecha) : 0;
    resumen = `
      <div class="estado-camion">${pillEstado(c)}</div>
      ${avisosDe(c).map(x => `<div class="banner ${x.grave ? 'rojo' : 'gris'}">${ic('alerta')} ${esc(x.txt)}</div>`).join('')}
      <h3 class="dia">Este mes</h3>
      <div class="stats">
        ${stat('caja', 'Cargas', cm.length)}
        ${stat('dolar', 'Cobrado', dinero(cob))}
        ${stat('ruta', 'Millas', cifra(Math.round(mi)))}
        ${stat('cartera', 'Limpio', dinero(cob - suma(cm, 'petroleo')), 'verde')}
        ${stat('llave', 'Días en reparación', suma(rs, r => diasEn(r, mesIni, h)))}
        ${stat('velocimetro', 'Millas en total', cifra(Math.round(millasDesde(c.id))))}
      </div>
      ${c.aceiteFecha ? `<div class="barra-aceite"><div><small>Aceite: ${millas(hechas)} de ${millas(cada)}</small></div><span><i style="width:${Math.min(100, hechas / cada * 100)}%"></i></span></div>` : ''}
      <h3 class="dia">Datos del camión</h3>`;
  }
  abrirHoja(nuevo ? 'Nuevo camión' : c.nombre, `
    <form id="formCamion" data-id="${c.id || ''}">
      ${resumen}
      <label>Nombre<input name="nombre" value="${esc(c.nombre)}" required></label>
      <div class="dos">
        <label>Placa<input name="placa" value="${esc(c.placa)}" autocapitalize="characters"></label>
        <label>Año<input name="anio" inputmode="numeric" value="${esc(c.anio)}" placeholder="2021"></label>
      </div>
      <label>Marca y modelo <small>(opcional)</small><input name="modelo" value="${esc(c.modelo)}" placeholder="Ej: Freightliner M2 · 26 pies"></label>
      <label>VIN <small>(opcional)</small><input name="vin" value="${esc(c.vin)}" autocapitalize="characters"></label>
      <label>Chofer<input name="chofer" value="${esc(c.chofer)}" placeholder="Nombre del chofer"></label>
      <label>WhatsApp del chofer <small>(con código de país)</small><input name="telefono" type="tel" value="${esc(c.telefono)}" placeholder="Ej: +1 615 555 0101"></label>

      <h3 class="dia">Papeles <small>(te avisa 30 días antes)</small></h3>
      <div class="dos">
        <label>Seguro vence<input type="date" name="seguro" value="${c.seguro || ''}"></label>
        <label>Registro vence<input type="date" name="registro" value="${c.registro || ''}"></label>
      </div>
      <label>Inspección anual vence<input type="date" name="inspeccion" value="${c.inspeccion || ''}"></label>

      <h3 class="dia">Cambio de aceite <small>(cuenta las millas de las cargas)</small></h3>
      <div class="dos">
        <label>Último cambio<input type="date" name="aceiteFecha" value="${c.aceiteFecha || ''}"></label>
        <label>Cada cuántas millas<input name="aceiteCada" inputmode="numeric" value="${c.aceiteCada || ACEITE_CADA}"></label>
      </div>

      ${nuevo ? '' : `<label class="check radio"><input type="checkbox" name="activo" ${c.activo !== false ? 'checked' : ''}> En servicio <small>(quítalo si lo vendiste)</small></label>`}
      <button class="btn grande" type="submit">${ic('check')} Guardar camión</button>
      ${nuevo ? '' : `<button class="btn suave" type="button" data-a="repDeCamion" data-id="${c.id}">${ic('llave')} Anotar una reparación</button>`}
      ${nuevo ? '' : usado ? '<p class="ayuda">Este camión tiene datos guardados. Si ya no lo usas, quita “En servicio” para que no salga en la lista.</p>'
        : '<button class="btn borrar" type="button" data-a="borrarCamion">Borrar camión</button>'}
    </form>`);
}

// ---------- PDF de la semana para un chofer ----------
function pdfSemana(g, lunes) {
  const p = new PDF(), M = 40, D = 555, azul = '#0a52d6', gris = '#6e7891';
  const pie = () => p.texto(M, 820, `${S.aj.negocio} · hecho el ${fCorta(hoy())} ${deISO(hoy()).getFullYear()}`, { t: 8, c: gris });
  if (logoPDF) p.imagen(logoPDF, M - 4, 26, 130, 52);
  else p.texto(M, 60, 'ALE', { t: 30, b: true, c: azul });
  p.texto(D, 42, 'LIQUIDACIÓN SEMANAL', { t: 17, b: true, c: '#0f1b33', al: 'der' });
  p.texto(D, 62, S.aj.negocio + (S.aj.dueno ? ' · ' + S.aj.dueno : ''), { t: 10, c: gris, al: 'der' });
  p.rect(M, 92, D - M, 3, { relleno: azul });
  p.rect(M, 104, D - M, 30, { relleno: '#eaf1ff' });
  p.texto(M + 12, 123, 'Día de pago', { t: 10, c: '#3a4560' });
  p.texto(D - 12, 123, 'miércoles ' + fCorta(pagoDe(lunes)) + ' ' + deISO(pagoDe(lunes)).getFullYear(), { t: 11, b: true, c: azul, al: 'der' });

  let y = 160;
  p.texto(M, y, 'Chofer', { t: 9, c: gris }); p.texto(230, y, 'Camión', { t: 9, c: gris }); p.texto(410, y, 'Semana', { t: 9, c: gris });
  y += 17;
  p.texto(M, y, p.recortar(g.chofer || 'Sin chofer', 180, 13, true), { t: 13, b: true });
  p.texto(230, y, p.recortar(nombreCamion(g.camionId), 170, 13, true), { t: 13, b: true });
  p.texto(410, y, `lun ${fCorta(lunes)} – dom ${fCorta(sumarDias(lunes, 6))}`, { t: 12, b: true });
  y += 22;
  const datos = [`${g.cargas.length} ${g.cargas.length === 1 ? 'carga' : 'cargas'}`, g.millas ? millas(g.millas) : '', g.millas ? porMilla(g.cobrado, g.millas) : '', g.horas ? fHoras(g.horas) + ' trabajadas' : '', g.diasTaller ? `${g.diasTaller} días en reparación` : ''].filter(Boolean).join('   ·   ');
  p.texto(M, y, datos, { t: 10, c: '#3a4560' });
  y += 18;

  const col = { fecha: M + 8, viaje: 104, mi: 330, cob: 400, pet: 475, lim: D - 8 };
  const encabezado = () => {
    p.rect(M, y, D - M, 22, { relleno: '#eef1f7' });
    p.texto(col.fecha, y + 15, 'Fecha', { t: 9, b: true, c: gris });
    p.texto(col.viaje, y + 15, 'Viaje', { t: 9, b: true, c: gris });
    p.texto(col.mi, y + 15, 'Millas', { t: 9, b: true, c: gris, al: 'der' });
    p.texto(col.cob, y + 15, 'Pago', { t: 9, b: true, c: gris, al: 'der' });
    p.texto(col.pet, y + 15, 'Petróleo', { t: 9, b: true, c: gris, al: 'der' });
    p.texto(col.lim, y + 15, 'Limpio', { t: 9, b: true, c: gris, al: 'der' });
    y += 22;
  };
  const saltoSi = alto => { if (y + alto > 790) { pie(); p.pagina(); y = 50; return true; } return false; };

  encabezado();
  g.cargas.forEach((c, i) => {
    const alto = c.viaje ? 32 : 22;
    if (saltoSi(alto)) encabezado();
    if (i % 2) p.rect(M, y, D - M, alto, { relleno: '#f6f8fb' });
    const d = deISO(c.fecha);
    p.texto(col.fecha, y + 15, `${DIAS[d.getDay()].slice(0, 3)} ${fCorta(c.fecha)}`, { t: 10 });
    p.texto(col.viaje, y + 15, p.recortar(ruta(c), 180), { t: 10 });
    if (c.viaje) p.texto(col.viaje, y + 27, p.recortar(c.viaje + (c.tipo ? ' · ' + c.tipo : ''), 180, 8), { t: 8, c: gris });
    p.texto(col.mi, y + 15, c.millas ? cifra(Math.round(c.millas)) : '', { t: 10, al: 'der' });
    p.texto(col.cob, y + 15, dinero(c.cobrado), { t: 10, al: 'der' });
    p.texto(col.pet, y + 15, dinero(-c.petroleo), { t: 10, c: '#b4462b', al: 'der' });
    p.texto(col.lim, y + 15, dinero(c.cobrado - c.petroleo), { t: 10, b: true, al: 'der' });
    y += alto;
  });
  p.linea(M, y, D, y, '#c3cad6');
  y += 18;

  if (g.gastos.length) {
    saltoSi(40);
    p.texto(M, y, 'Otros gastos que se restan antes de repartir', { t: 10, b: true }); y += 8;
    g.gastos.forEach(x => {
      saltoSi(20); y += 16;
      p.texto(col.fecha, y, fCorta(x.fecha), { t: 10 });
      p.texto(col.viaje, y, p.recortar(x.tipo + (x.detalle ? ' · ' + x.detalle : ''), 320), { t: 10 });
      p.texto(col.lim, y, dinero(-x.monto), { t: 10, c: '#b4462b', al: 'der' });
    });
    y += 22;
  }

  saltoSi(190);
  const bx = 300, bw = D - bx;
  const fila = (txt, val, op = {}) => { p.texto(bx + 12, y, txt, { t: 11, ...op }); p.texto(D - 12, y, val, { t: 11, al: 'der', ...op }); y += 19; };
  p.rect(bx, y, bw, 98 + (g.otros ? 19 : 0), { relleno: '#f6f8fb', borde: '#dfe4ec' });
  y += 22;
  fila('Total cobrado', dinero(g.cobrado));
  fila('Petróleo', dinero(-g.petroleo), { c: '#b4462b' });
  if (g.otros) fila('Otros gastos', dinero(-g.otros), { c: '#b4462b' });
  p.linea(bx + 12, y - 8, D - 12, y - 8, '#c3cad6');
  y += 4;
  fila('Limpio', dinero(g.limpio), { b: true, t: 13 });
  y += 10;
  p.rect(bx, y, bw, 52, { relleno: azul });
  p.texto(bx + 12, y + 20, `PARA EL CHOFER (${g.pct}%)`, { t: 10, b: true, c: '#d6e4ff' });
  p.texto(D - 12, y + 38, dinero(g.paraChofer), { t: 22, b: true, c: '#ffffff', al: 'der' });
  y += 70;
  fila(`Para el dueño (${100 - g.pct}%)`, dinero(g.paraDueno), { c: gris });
  pie();

  const fotos = S.aj.fotosPDF ? g.cargas.flatMap(c => (c.fotos || []).map(f => ({ f, c }))) : [];
  if (fotos.length) {
    const cw = 245, ch = 205, gap = 25;
    fotos.forEach(({ f, c }, i) => {
      const k = i % 6;
      if (k === 0) { p.pagina(); p.texto(M, 50, 'Fotos de las cargas', { t: 15, b: true, c: '#0f1b33' }); pie(); }
      const x = M + (k % 2) * (cw + gap), yy = 72 + Math.floor(k / 2) * (ch + 32);
      p.rect(x, yy, cw, ch, { relleno: '#eef1f6' });
      p.imagen(f, x, yy, cw, ch);
      p.texto(x, yy + ch + 14, p.recortar(`${fDia(c.fecha)} · ${ruta(c)}`, cw, 9), { t: 9, c: gris });
    });
  }
  return p.blob();
}

function textoMensaje(g, lunes) {
  return [
    `*${S.aj.negocio} – Liquidación semana ${fRango(lunes)}*`,
    `Chofer: ${g.chofer || '-'}`,
    `Camión: ${nombreCamion(g.camionId)}`,
    `Cargas: ${g.cargas.length}${g.millas ? ` · ${millas(g.millas)} · ${porMilla(g.cobrado, g.millas)}` : ''}`,
    ...(g.horas ? [`Horas: ${fHoras(g.horas)}`] : []),
    `Cobrado: ${dinero(g.cobrado)}`,
    `Petróleo: ${dinero(-g.petroleo)}`,
    ...(g.otros ? [`Otros gastos: ${dinero(-g.otros)}`] : []),
    `Limpio: ${dinero(g.limpio)}`,
    `*Te toca (${g.pct}%): ${dinero(g.paraChofer)}*`,
    `Pago: miércoles ${fCorta(pagoDe(lunes))}`,
  ].join('\n');
}

// ---------- respaldo y Excel ----------
function respaldo() {
  const datos = { app: 'camiones', version: 2, fecha: new Date().toISOString(), ajustes: S.aj };
  for (const t of db.TABLAS) datos[t] = S[t];
  compartir(new Blob([JSON.stringify(datos)], { type: 'application/json' }), `respaldo-ALE-${hoy()}.json`);
}
async function recuperar(archivo) {
  try {
    const datos = JSON.parse(await archivo.text());
    if (datos.app !== 'camiones') throw new Error();
    if (!confirm(`Esta copia tiene ${(datos.cargas || []).length} cargas y ${(datos.camiones || []).length} camiones.\n\nSe va a reemplazar todo lo que hay ahora en este aparato. ¿Seguir?`)) return;
    await db.restaurar(datos);
    await cargarTodo(); ir('cargas'); avisar('Copia recuperada');
  } catch { alert('Ese archivo no es una copia de esta app.'); }
}
function excel() {
  const us = S.aj.formato === 'us', sep = us ? ',' : ';';
  const n = v => v === '' || v == null ? '' : us ? String(Math.round(v * 100) / 100) : String(Math.round(v * 100) / 100).replace('.', ',');
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const cab = ['Fecha', 'Semana', 'Tipo', 'Camión', 'Chofer', 'ID viaje', 'Sale de', 'Llega a', 'Millas', 'Horas', 'Pago', 'Por milla', 'Petróleo', 'Otro gasto', 'Quién paga', 'Limpio'];
  const filas = [];
  S.cargas.forEach(x => filas.push([x.fecha, fRango(lunesDe(x.fecha)), 'Carga ' + (x.tipo || ''), nombreCamion(x.camionId), x.chofer, x.viaje, x.origen || x.detalle, x.destino, n(x.millas || ''), fHoras(x.horas), n(x.cobrado), x.millas ? n(x.cobrado / x.millas) : '', n(x.petroleo), '', 'Mitad y mitad', n(x.cobrado - x.petroleo)]));
  S.gastos.forEach(x => filas.push([x.fecha, fRango(lunesDe(x.fecha)), x.tipo, nombreCamion(x.camionId), x.chofer, '', x.detalle, '', '', '', '', '', '', n(x.monto), x.compartido ? 'Mitad y mitad' : 'Solo dueño', n(x.compartido ? -x.monto : 0)]));
  S.reparaciones.forEach(x => filas.push([x.inicio, fRango(lunesDe(x.inicio)), `Reparación (${x.dias} días)`, nombreCamion(x.camionId), x.chofer, '', x.detalle, x.taller, '', '', '', '', '', n(x.costo), x.compartido ? 'Mitad y mitad' : 'Solo dueño', n(x.compartido ? -x.costo : 0)]));
  const cuerpo = [cab, ...filas.sort((a, b) => a[0].localeCompare(b[0]))].map(f => f.map(c).join(sep)).join('\r\n');
  compartir(new Blob(['﻿' + cuerpo], { type: 'text/csv' }), `ALE-${hoy()}.csv`);
}

// ---------- eventos ----------
const grupoDe = k => liquidacion(semanaPago).find(g => g.k === k);

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.tagName === 'INPUT' && el.type !== 'checkbox') return;
  const a = el.dataset.a, id = el.dataset.id;
  switch (a) {
    case 'semana': semana = sumarDias(semana, +el.dataset.d); pintar(); break;
    case 'semanaHoy': semana = lunesDe(hoy()); pintar(); break;
    case 'semanaPago': semanaPago = sumarDias(semanaPago, +el.dataset.d); pintar(); break;
    case 'semanaTaller': semanaTaller = sumarDias(semanaTaller, +el.dataset.d); pintar(); break;
    case 'irCamiones': ir('camiones'); break;
    case 'nuevaCarga': formCarga(); break;
    case 'nuevoGasto': formGasto(); break;
    case 'nuevoCamion': formCamion(); break;
    case 'nuevaRep': formRep(); break;
    case 'repDeCamion': formRep({ inicio: hoy(), camionId: id, dias: 1, costo: 0, compartido: false }); break;
    case 'editarCarga': formCarga(S.cargas.find(x => x.id === id)); break;
    case 'editarGasto': formGasto(S.gastos.find(x => x.id === id)); break;
    case 'editarCamion': formCamion(camion(id)); break;
    case 'editarRep': formRep(S.reparaciones.find(x => x.id === id)); break;
    case 'repLista': {
      const r = S.reparaciones.find(x => x.id === id); if (!r) break;
      await guardar('reparaciones', { ...r, dias: Math.max(1, entreDias(r.inicio, hoy())), listo: hoy() });
      pintar(); avisar('Camión trabajando otra vez');
      break;
    }
    case 'verFoto': verFoto(fotosForm[+el.dataset.i].d); break;
    case 'verRecibo': verFoto(reciboForm.d); break;
    case 'quitarFoto': fotosForm.splice(+el.dataset.i, 1); pintarFotos(); break;
    case 'quitarRecibo': reciboForm = null; pintarRecibo(); break;
    case 'borrarCarga': if (confirm('¿Borrar esta carga?')) { await borrar('cargas', $('#formCarga').dataset.id); cerrarHoja(); pintar(); avisar('Carga borrada'); } break;
    case 'borrarGasto': if (confirm('¿Borrar este gasto?')) { await borrar('gastos', $('#formGasto').dataset.id); cerrarHoja(); pintar(); avisar('Gasto borrado'); } break;
    case 'borrarRep': if (confirm('¿Borrar esta reparación?')) { await borrar('reparaciones', $('#formRep').dataset.id); cerrarHoja(); pintar(); avisar('Reparación borrada'); } break;
    case 'borrarCamion': if (confirm('¿Borrar este camión?')) { await borrar('camiones', $('#formCamion').dataset.id); cerrarHoja(); pintar(); } break;
    case 'fotosPDF': S.aj.fotosPDF = el.checked; db.guardarAjustes(S.aj); break;
    case 'pdf': {
      const g = grupoDe(el.dataset.k); if (!g) break;
      const nombre = `Liquidacion ${(g.chofer || 'chofer').replace(/[^\wáéíóúñÁÉÍÓÚÑ ]/g, '')} ${semanaPago}.pdf`;
      compartir(pdfSemana(g, semanaPago), nombre);
      break;
    }
    case 'mensaje': {
      const g = grupoDe(el.dataset.k); if (!g) break;
      const tel = (camion(g.camionId)?.telefono || '').replace(/\D/g, '');
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(textoMensaje(g, semanaPago))}`, '_blank');
      break;
    }
    case 'pagado': {
      const g = grupoDe(el.dataset.k); if (!g) break;
      if (g.pago) { if (confirm('¿Quitar la marca de pagado?')) await borrar('pagos', g.pago.id); }
      else await guardar('pagos', { id: semanaPago + '|' + g.k, lunes: semanaPago, k: g.k, fecha: hoy(), pct: g.pct, monto: g.paraChofer });
      pintar();
      break;
    }
    case 'guardarAjustes': {
      const pct = Math.min(100, Math.max(0, numero($('#ajPct').value)));
      S.aj = { ...S.aj, negocio: $('#ajNegocio').value.trim() || 'ALE', dueno: $('#ajDueno').value.trim(), pctChofer: pct, decimales: $('#ajDec').value, formato: $('#ajFormato').value };
      await db.guardarAjustes(S.aj); pintar(); avisar('Ajustes guardados');
      break;
    }
    case 'respaldo': respaldo(); break;
    case 'recuperar': $('#archivoRespaldo').click(); break;
    case 'excel': excel(); break;
  }
});

document.addEventListener('input', e => {
  const a = e.target.dataset.a;
  if (a === 'calc') calcCarga();
  if (a === 'calcRep') calcRep();
});

document.addEventListener('change', async e => {
  const t = e.target, a = t.dataset.a;
  if (a === 'cambiaCamion') { $('#formCarga').chofer.value = camion(t.value)?.chofer || ''; }
  if (a === 'calcRep') calcRep();
  if (a === 'subirFotos' || a === 'subirRecibo') {
    const archivos = [...t.files]; if (!archivos.length) return;
    avisar('Preparando foto…');
    try {
      const fotos = await Promise.all(archivos.map(f => comprimir(f)));
      if (a === 'subirFotos') { fotosForm.push(...fotos); pintarFotos(); } else { reciboForm = fotos[0]; pintarRecibo(); }
      $('#aviso').classList.remove('ver');
    } catch { avisar('No se pudo leer la foto'); }
  }
  if (t.id === 'archivoRespaldo' && t.files[0]) { await recuperar(t.files[0]); t.value = ''; }
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  const id = f.dataset.id || nuevoId(), anterior = k => S[k].find(x => x.id === id);
  if (f.id === 'formCarga') {
    if (!d.camionId) return alert('Primero agrega un camión.');
    if (!numero(d.cobrado)) return alert('Escribe cuánto pagaron por la carga.');
    await guardar('cargas', {
      id, creado: anterior('cargas')?.creado || Date.now(), fecha: d.fecha, tipo: d.tipo, camionId: d.camionId, chofer: d.chofer.trim(),
      viaje: d.viaje.trim().toUpperCase(), origen: d.origen.trim(), destino: d.destino.trim(), detalle: '',
      millas: numero(d.millas), horas: horas(d.horas), cobrado: numero(d.cobrado), petroleo: numero(d.petroleo), fotos: fotosForm, recibo: reciboForm,
    });
    semana = lunesDe(d.fecha); avisar('Carga guardada');
  }
  if (f.id === 'formGasto') {
    if (!d.camionId) return alert('Primero agrega un camión.');
    if (!numero(d.monto)) return alert('Escribe el monto del gasto.');
    const viejo = anterior('gastos');
    await guardar('gastos', {
      id, creado: viejo?.creado || Date.now(), fecha: d.fecha, camionId: d.camionId,
      chofer: viejo && viejo.camionId === d.camionId ? viejo.chofer : camion(d.camionId)?.chofer || '',
      tipo: d.tipo, detalle: d.detalle.trim(), monto: numero(d.monto), compartido: d.compartido === '1', recibo: reciboForm,
    });
    semana = lunesDe(d.fecha); avisar('Gasto guardado');
  }
  if (f.id === 'formRep') {
    if (!d.camionId) return alert('Primero agrega un camión.');
    const viejo = anterior('reparaciones');
    await guardar('reparaciones', {
      ...(viejo || {}), id, creado: viejo?.creado || Date.now(), camionId: d.camionId, inicio: d.inicio, dias: Math.max(1, parseInt(d.dias) || 1),
      chofer: viejo && viejo.camionId === d.camionId ? viejo.chofer : camion(d.camionId)?.chofer || '',
      detalle: d.detalle.trim(), taller: d.taller.trim(), costo: numero(d.costo), compartido: d.compartido === '1', recibo: reciboForm,
    });
    avisar('Reparación guardada');
  }
  if (f.id === 'formCamion') {
    const viejo = anterior('camiones');
    await guardar('camiones', {
      ...(viejo || {}), id, creado: viejo?.creado || Date.now(), nombre: d.nombre.trim(), placa: d.placa.trim().toUpperCase(),
      anio: d.anio.trim(), modelo: d.modelo.trim(), vin: d.vin.trim().toUpperCase(),
      chofer: d.chofer.trim(), telefono: d.telefono.trim(), seguro: d.seguro, registro: d.registro, inspeccion: d.inspeccion,
      aceiteFecha: d.aceiteFecha, aceiteCada: numero(d.aceiteCada) || ACEITE_CADA, activo: viejo ? d.activo === 'on' : true,
    });
    avisar('Camión guardado');
  }
  cerrarHoja(); pintar();
});

$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ir(b.dataset.v); });
$('#cerrarHoja').addEventListener('click', cerrarHoja);
$('#hoja').addEventListener('click', e => { if (e.target.id === 'hoja') cerrarHoja(); });
$('#visor').addEventListener('click', () => { $('#visor').hidden = true; });

// ---------- arranque ----------
async function cargarTodo() {
  const datos = await Promise.all(db.TABLAS.map(db.todos)), aj = await db.leerAjustes();
  db.TABLAS.forEach((t, i) => { S[t] = datos[i]; });
  S.aj = { ...AJ_BASE, ...(aj || {}) };
  if (S.aj.negocio === 'Mis Camiones') S.aj.negocio = 'ALE';
}
// el logo se pasa a JPEG con fondo blanco para meterlo en el PDF
let logoPDF = null;
const logo = new Image();
logo.onload = () => {
  const k = 3, cv = document.createElement('canvas'); cv.width = logo.naturalWidth * k; cv.height = logo.naturalHeight * k;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.imageSmoothingQuality = 'high'; g.drawImage(logo, 0, 0, cv.width, cv.height);
  logoPDF = { d: cv.toDataURL('image/jpeg', .92), w: cv.width, h: cv.height };
};
logo.src = 'logo-ale.png';

await cargarTodo();
// si la semana pasada no tiene nada, Pagos abre en la semana actual
if (!liquidacion(semanaPago).length && liquidacion(lunesDe(hoy())).length) semanaPago = lunesDe(hoy());
ir('cargas');
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
