import * as db from './db.js';
import { PDF } from './pdf.js';

// ---------- estado (todo en memoria; se guarda en el teléfono al cambiar) ----------
const AJ_BASE = { negocio: 'ALE', dueno: '', pctChofer: 50, decimales: 'auto', formato: 'us', moneda: '$', fotosPDF: true };
const S = { camiones: [], cargas: [], gastos: [], pagos: [], aj: { ...AJ_BASE } };
const TIPOS_GASTO = ['Petróleo', 'Peaje / casetas', 'Reparación', 'Llantas', 'Aceite', 'Lavado', 'Comida', 'Multa', 'Otro'];

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
  telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
const iniciales = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

// ---------- fechas ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const hoy = () => iso(new Date());
const sumarDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
const lunesDe = s => sumarDias(s, -((deISO(s).getDay() + 6) % 7));
const pagoDe = lunes => sumarDias(lunes, 9); // el miércoles siguiente al domingo
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fCorta = s => { const d = deISO(s); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const fDia = s => { const d = deISO(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const fRango = l => `${fCorta(l)} – ${fCorta(sumarDias(l, 6))}`;

// ---------- dinero ----------
function dinero(n) {
  const neg = n < -0.004; n = Math.abs(Math.round(n * 100) / 100);
  const d = S.aj.decimales === 'no' ? 0 : S.aj.decimales === 'si' ? 2 : (Number.isInteger(n) ? 0 : 2);
  const us = S.aj.formato === 'us';
  let [e, f] = n.toFixed(d).split('.');
  e = e.replace(/\B(?=(\d{3})+(?!\d))/g, us ? ',' : '.');
  return (neg ? '-' : '') + S.aj.moneda + e + (f ? (us ? '.' : ',') + f : '');
}
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
const aTexto = n => n ? (S.aj.formato === 'us' ? String(n) : String(n).replace('.', ',')) : '';

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const camion = id => S.camiones.find(c => c.id === id);
const nombreCamion = id => { const c = camion(id); return c ? c.nombre + (c.placa ? ` (${c.placa})` : '') : 'Camión borrado'; };
const ordenCamiones = () => [...S.camiones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));

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
  S.cargas.filter(dentro).forEach(c => grupo(c.camionId, c.chofer).cargas.push(c));
  S.gastos.filter(dentro).forEach(g => { const gr = grupo(g.camionId, g.chofer); (g.compartido ? gr.gastos : gr.soloDueno).push(g); });
  const suma = (l, f) => l.reduce((t, x) => t + (+x[f] || 0), 0);
  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado;
  return [...grupos.values()].map(g => {
    g.cargas.sort(porFecha); g.gastos.sort(porFecha); g.soloDueno.sort(porFecha);
    g.pago = S.pagos.find(p => p.id === lunes + '|' + g.k);
    g.pct = g.pago ? g.pago.pct : S.aj.pctChofer;
    g.cobrado = suma(g.cargas, 'cobrado');
    g.petroleo = suma(g.cargas, 'petroleo');
    g.otros = suma(g.gastos, 'monto');
    g.limpio = g.cobrado - g.petroleo - g.otros;
    g.paraChofer = Math.round(g.limpio * g.pct) / 100;
    g.paraDueno = g.limpio - g.paraChofer;
    g.gastoDueno = suma(g.soloDueno, 'monto');
    return g;
  }).sort((a, b) => nombreCamion(a.camionId).localeCompare(nombreCamion(b.camionId), 'es', { numeric: true }));
}

// ---------- fotos ----------
function comprimir(archivo, max = 1400, calidad = .72) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok({ d: cv.toDataURL('image/jpeg', calidad), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}
function verFoto(d) {
  const v = $('#visor'); v.querySelector('img').src = d; v.hidden = false;
}

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

function ir(v) {
  vista = v;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('activo', b.dataset.v === v));
  pintar();
  window.scrollTo(0, 0);
}
function pintar() {
  const t = { cargas: 'Cargas', pagos: 'Pagos', camiones: 'Camiones', mas: 'Ajustes' }[vista];
  $('#titulo').textContent = t;
  const fh = fDia(hoy());
  $('#negocio').textContent = (S.aj.negocio && S.aj.negocio !== 'ALE' ? S.aj.negocio + ' · ' : '') + fh[0].toUpperCase() + fh.slice(1);
  $('#vista').innerHTML = ({ cargas: vistaCargas, pagos: vistaPagos, camiones: vistaCamiones, mas: vistaMas })[vista]();
}

const selectorSemana = (l, a) => `
  <div class="semana">
    <button class="flecha" data-a="${a}" data-d="-7" aria-label="Semana anterior">${ic('izq')}</button>
    <div><b>${fRango(l)}</b><small>Se paga el miércoles ${fCorta(pagoDe(l))}</small></div>
    <button class="flecha" data-a="${a}" data-d="7" aria-label="Semana siguiente">${ic('der')}</button>
  </div>`;

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
  const cobrado = cargas.reduce((t, c) => t + c.cobrado, 0), petroleo = cargas.reduce((t, c) => t + c.petroleo, 0);
  const otros = gastos.filter(g => g.compartido).reduce((t, g) => t + g.monto, 0);
  const dias = [...new Set([...cargas, ...gastos].map(x => x.fecha))].sort().reverse();
  const actual = semana === lunesDe(hoy());
  return `
    ${selectorSemana(semana, 'semana')}
    ${actual ? '' : '<button class="link centro" data-a="semanaHoy">Volver a esta semana</button>'}
    <div class="stats">
      <div class="stat"><span class="ico">${ic('caja')}</span><div><small>Cargas</small><b>${cargas.length}</b></div></div>
      <div class="stat"><span class="ico">${ic('dolar')}</span><div><small>Cobrado</small><b>${dinero(cobrado)}</b></div></div>
      <div class="stat"><span class="ico rojo">${ic('petroleo')}</span><div><small>Petróleo</small><b class="rojo">${dinero(-petroleo)}</b></div></div>
      <div class="stat"><span class="ico verde">${ic('cartera')}</span><div><small>Limpio</small><b class="verde">${dinero(cobrado - petroleo - otros)}</b></div></div>
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
  return `
  <button class="fila" data-a="editarCarga" data-id="${c.id}">
    ${c.fotos?.[0] ? `<img class="mini" src="${c.fotos[0].d}" alt="">` : `<span class="mini icono">${ic('caja')}</span>`}
    <span class="txt"><b>${esc(c.detalle || 'Carga')}</b><small>${esc(c.chofer || 'Sin chofer')} · ${esc(cam ? cam.nombre : 'Camión borrado')}</small></span>
    <span class="num"><b>${dinero(c.cobrado)}</b><small class="rojo">${dinero(-c.petroleo)}</small><small class="verde">${dinero(c.cobrado - c.petroleo)}</small></span>
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
  const totalChofer = lista.reduce((t, g) => t + g.paraChofer, 0);
  const totalDueno = lista.reduce((t, g) => t + g.paraDueno - g.gastoDueno, 0);
  const estado = h === pago ? `<div class="banner hoy">${ic('dolar')} Hoy es miércoles: toca pagar esta semana</div>`
    : h < pago && h > sumarDias(semanaPago, 6) ? `<div class="banner">${ic('reloj')} Se paga el miércoles ${fCorta(pago)}</div>`
      : h <= sumarDias(semanaPago, 6) ? `<div class="banner gris">${ic('reloj')} Semana en curso: se va sumando con cada carga</div>` : '';
  return `
    ${selectorSemana(semanaPago, 'semanaPago')}
    ${estado}
    ${lista.length ? `
      <div class="stats">
        <div class="stat"><span class="ico">${ic('persona')}</span><div><small>Para choferes</small><b>${dinero(totalChofer)}</b></div></div>
        <div class="stat"><span class="ico verde">${ic('cartera')}</span><div><small>Para el dueño</small><b class="verde">${dinero(totalDueno)}</b></div></div>
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
  const lista = ordenCamiones(), activos = lista.filter(c => c.activo !== false), fuera = lista.filter(c => c.activo === false);
  const fila = c => `
    <button class="fila" data-a="editarCamion" data-id="${c.id}">
      <span class="mini icono">${ic('camion')}</span>
      <span class="txt"><b>${esc(c.nombre)}${c.placa ? `<span class="placa">${esc(c.placa)}</span>` : ''}</b><small>${esc(c.chofer || 'Sin chofer')}${c.telefono ? ' · ' + esc(c.telefono) : ''}</small></span>
      <span class="num"><small>${S.cargas.filter(x => x.camionId === c.id).length} cargas</small></span>
      ${ic('der', 'chev')}
    </button>`;
  return `
    <div class="stats">
      <div class="stat"><span class="ico">${ic('camion')}</span><div><small>En servicio</small><b>${activos.length}</b></div></div>
      <div class="stat"><span class="ico">${ic('persona')}</span><div><small>Choferes</small><b>${new Set(activos.map(c => c.chofer).filter(Boolean)).size}</b></div></div>
    </div>
    <button class="btn grande" data-a="nuevoCamion">${ic('mas')} Agregar camión</button>
    ${activos.length ? `<h3 class="dia">En servicio</h3><div class="grupo">${activos.map(fila).join('')}</div>` : '<p class="nada">Todavía no hay camiones.</p>'}
    ${fuera.length ? `<h3 class="dia">Fuera de servicio / vendidos</h3><div class="grupo">${fuera.map(fila).join('')}</div>` : ''}`;
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
      <p class="ayuda">Saca todas las cargas y gastos en un archivo que abre Excel o Numbers.</p>
      <button class="btn suave" data-a="excel">${ic('tabla')} Exportar a Excel</button>
    </div>
    <div class="tarjeta">
      <h3>Instalar en el iPhone</h3>
      <p class="ayuda">Abre esta página en <b>Safari</b>, toca el botón <b>Compartir</b> (el cuadrito con la flecha hacia arriba) y elige <b>“Agregar a pantalla de inicio”</b>. Funciona sin internet.</p>
    </div>
    <p class="pie">${S.cargas.length} cargas · ${S.gastos.length} gastos · ${S.camiones.length} camiones guardados en este teléfono</p>`;
}

// ---------- hoja (formulario que sube desde abajo) ----------
let alCerrar = null;
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
  alCerrar = null;
}
const opcionesCamion = sel => ordenCamiones().filter(c => c.activo !== false || c.id === sel)
  .map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}${c.placa ? ' (' + esc(c.placa) + ')' : ''}</option>`).join('');
const avisoPagada = fecha => {
  const l = lunesDe(fecha);
  return S.pagos.some(p => p.lunes === l) ? '<div class="banner gris">Ojo: esa semana ya tiene pagos marcados.</div>' : '';
};

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
  c = c || { fecha: hoy(), camionId: ultimo && camion(ultimo.camionId)?.activo !== false ? ultimo.camionId : ordenCamiones().find(x => x.activo !== false)?.id, cobrado: 0, petroleo: 0, fotos: [] };
  if (nuevo) c.chofer = camion(c.camionId)?.chofer || '';
  fotosForm = [...(c.fotos || [])]; reciboForm = c.recibo || null;
  abrirHoja(nuevo ? 'Nueva carga' : 'Editar carga', `
    <form id="formCarga" data-id="${c.id || ''}">
      ${nuevo ? '' : avisoPagada(c.fecha)}
      <label>Fecha<input type="date" name="fecha" value="${c.fecha}" required></label>
      <label>Camión<select name="camionId" data-a="cambiaCamion">${opcionesCamion(c.camionId)}</select></label>
      <label>Chofer<input name="chofer" value="${esc(c.chofer)}" placeholder="Nombre del chofer"></label>
      <label>Carga / destino <small>(opcional)</small><input name="detalle" value="${esc(c.detalle)}" placeholder="Ej: arena a la obra de Juan"></label>
      <label>Cobrado por la carga<input name="cobrado" inputmode="decimal" value="${aTexto(c.cobrado)}" placeholder="0" data-a="calc"></label>
      <label>Petróleo usado en esta carga<input name="petroleo" inputmode="decimal" value="${aTexto(c.petroleo)}" placeholder="0" data-a="calc"></label>
      <div class="limpio"><span>Limpio de esta carga</span><b id="limpio">${dinero(c.cobrado - c.petroleo)}</b></div>
      <div class="campo"><span>Fotos de la carga</span><div class="fotos" id="fotos"></div></div>
      <div class="campo"><span>Recibo del petróleo <small>(opcional)</small></span><div class="fotos" id="recibo"></div></div>
      <button class="btn grande" type="submit">${ic('check')} Guardar carga</button>
      ${nuevo ? '' : '<button class="btn borrar" type="button" data-a="borrarCarga">Borrar esta carga</button>'}
    </form>`);
  pintarFotos(); pintarRecibo();
}

function formGasto(g) {
  const nuevo = !g;
  g = g || { fecha: hoy(), camionId: ordenCamiones().find(x => x.activo !== false)?.id, tipo: TIPOS_GASTO[1], monto: 0, compartido: true };
  reciboForm = g.recibo || null;
  abrirHoja(nuevo ? 'Otro gasto' : 'Editar gasto', `
    <form id="formGasto" data-id="${g.id || ''}">
      ${nuevo ? '' : avisoPagada(g.fecha)}
      <p class="ayuda">El petróleo de cada carga va en la carga. Aquí van los demás gastos: peajes, reparaciones, llantas…</p>
      <label>Fecha<input type="date" name="fecha" value="${g.fecha}" required></label>
      <label>Camión<select name="camionId">${opcionesCamion(g.camionId)}</select></label>
      <label>Tipo de gasto<select name="tipo">${TIPOS_GASTO.map(t => `<option ${t === g.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Detalle <small>(opcional)</small><input name="detalle" value="${esc(g.detalle)}"></label>
      <label>Monto<input name="monto" inputmode="decimal" value="${aTexto(g.monto)}" placeholder="0"></label>
      <div class="campo"><span>¿Quién lo paga?</span>
        <label class="radio"><input type="radio" name="compartido" value="1" ${g.compartido ? 'checked' : ''}> Mitad y mitad <small>(se resta antes de repartir)</small></label>
        <label class="radio"><input type="radio" name="compartido" value="0" ${g.compartido ? '' : 'checked'}> Solo el dueño <small>(no le afecta al chofer)</small></label>
      </div>
      <div class="campo"><span>Foto del recibo <small>(opcional)</small></span><div class="fotos" id="recibo"></div></div>
      <button class="btn grande" type="submit">${ic('check')} Guardar gasto</button>
      ${nuevo ? '' : '<button class="btn borrar" type="button" data-a="borrarGasto">Borrar este gasto</button>'}
    </form>`);
  pintarRecibo();
}

function formCamion(c) {
  const nuevo = !c;
  if (nuevo) {
    // nombre automático: el siguiente número libre
    let n = S.camiones.length + 1;
    while (S.camiones.some(x => x.nombre.toLowerCase() === 'camión ' + n)) n++;
    c = { nombre: 'Camión ' + n, activo: true };
  }
  const usado = !nuevo && (S.cargas.some(x => x.camionId === c.id) || S.gastos.some(x => x.camionId === c.id));
  abrirHoja(nuevo ? 'Nuevo camión' : 'Editar camión', `
    <form id="formCamion" data-id="${c.id || ''}">
      <label>Nombre<input name="nombre" value="${esc(c.nombre)}" required></label>
      <label>Placa / patente <small>(opcional)</small><input name="placa" value="${esc(c.placa)}" autocapitalize="characters"></label>
      <label>Chofer<input name="chofer" value="${esc(c.chofer)}" placeholder="Nombre del chofer"></label>
      <label>WhatsApp del chofer <small>(con código de país)</small><input name="telefono" type="tel" value="${esc(c.telefono)}" placeholder="Ej: +56 9 1234 5678"></label>
      ${nuevo ? '' : `<label class="check"><input type="checkbox" name="activo" ${c.activo !== false ? 'checked' : ''}> En servicio <small>(quítalo si lo vendiste)</small></label>`}
      <button class="btn grande" type="submit">${ic('check')} Guardar camión</button>
      ${nuevo ? '' : usado ? '<p class="ayuda">Este camión tiene cargas guardadas. Si ya no lo usas, quita “En servicio” para que no salga en la lista.</p>'
        : '<button class="btn borrar" type="button" data-a="borrarCamion">Borrar camión</button>'}
    </form>`);
}

// ---------- PDF de la semana para un chofer ----------
function pdfSemana(g, lunes) {
  const p = new PDF(), M = 40, D = 555, azul = '#0a52d6', gris = '#6e7891';
  const pie = () => p.texto(M, 820, `${S.aj.negocio} · hecho el ${fCorta(hoy())} ${deISO(hoy()).getFullYear()}`, { t: 8, c: gris });
  const cabecera = () => {
    if (logoPDF) p.imagen(logoPDF, M - 4, 26, 130, 52);
    else p.texto(M, 60, 'ALE', { t: 30, b: true, c: azul });
    p.texto(D, 42, 'LIQUIDACIÓN SEMANAL', { t: 17, b: true, c: '#0f1b33', al: 'der' });
    p.texto(D, 62, S.aj.negocio + (S.aj.dueno ? ' · ' + S.aj.dueno : ''), { t: 10, c: gris, al: 'der' });
    p.rect(M, 92, D - M, 3, { relleno: azul });
    p.rect(M, 104, D - M, 30, { relleno: '#eaf1ff' });
    p.texto(M + 12, 123, 'Día de pago', { t: 10, c: '#3a4560' });
    p.texto(D - 12, 123, 'miércoles ' + fCorta(pagoDe(lunes)) + ' ' + deISO(pagoDe(lunes)).getFullYear(), { t: 11, b: true, c: azul, al: 'der' });
  };
  cabecera();
  let y = 160;
  p.texto(M, y, 'Chofer', { t: 9, c: gris }); p.texto(230, y, 'Camión', { t: 9, c: gris }); p.texto(410, y, 'Semana', { t: 9, c: gris });
  y += 17;
  p.texto(M, y, p.recortar(g.chofer || 'Sin chofer', 180, 13, true), { t: 13, b: true });
  p.texto(230, y, p.recortar(nombreCamion(g.camionId), 170, 13, true), { t: 13, b: true });
  p.texto(410, y, `lun ${fCorta(lunes)} – dom ${fCorta(sumarDias(lunes, 6))}`, { t: 12, b: true });
  y += 28;

  const encabezado = () => {
    p.rect(M, y, D - M, 22, { relleno: '#eef1f7' });
    p.texto(M + 8, y + 15, 'Fecha', { t: 9, b: true, c: gris });
    p.texto(118, y + 15, 'Carga', { t: 9, b: true, c: gris });
    p.texto(395, y + 15, 'Cobrado', { t: 9, b: true, c: gris, al: 'der' });
    p.texto(475, y + 15, 'Petróleo', { t: 9, b: true, c: gris, al: 'der' });
    p.texto(D - 8, y + 15, 'Limpio', { t: 9, b: true, c: gris, al: 'der' });
    y += 22;
  };
  const saltoSi = alto => { if (y + alto > 790) { pie(); p.pagina(); y = 50; return true; } return false; };

  encabezado();
  g.cargas.forEach((c, i) => {
    if (saltoSi(22)) encabezado();
    if (i % 2) p.rect(M, y, D - M, 22, { relleno: '#f6f8fb' });
    const d = deISO(c.fecha);
    p.texto(M + 8, y + 15, `${DIAS[d.getDay()].slice(0, 3)} ${fCorta(c.fecha)}`, { t: 10 });
    p.texto(118, y + 15, p.recortar(c.detalle || 'Carga', 210), { t: 10 });
    p.texto(395, y + 15, dinero(c.cobrado), { t: 10, al: 'der' });
    p.texto(475, y + 15, dinero(-c.petroleo), { t: 10, c: '#b4462b', al: 'der' });
    p.texto(D - 8, y + 15, dinero(c.cobrado - c.petroleo), { t: 10, b: true, al: 'der' });
    y += 22;
  });
  p.linea(M, y, D, y, '#c3cad6');
  y += 18;

  if (g.gastos.length) {
    saltoSi(40);
    p.texto(M, y, 'Otros gastos que se restan antes de repartir', { t: 10, b: true }); y += 8;
    g.gastos.forEach(x => {
      saltoSi(20); y += 16;
      p.texto(M + 8, y, fCorta(x.fecha), { t: 10 });
      p.texto(118, y, p.recortar(x.tipo + (x.detalle ? ' · ' + x.detalle : ''), 300), { t: 10 });
      p.texto(D - 8, y, dinero(-x.monto), { t: 10, c: '#b4462b', al: 'der' });
    });
    y += 22;
  }

  // cuadro de totales
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

  // fotos de las cargas
  const fotos = S.aj.fotosPDF ? g.cargas.flatMap(c => (c.fotos || []).map(f => ({ f, c }))) : [];
  if (fotos.length) {
    const cw = 245, ch = 205, gap = 25;
    fotos.forEach(({ f, c }, i) => {
      const k = i % 6;
      if (k === 0) {
        p.pagina(); p.texto(M, 50, 'Fotos de las cargas', { t: 15, b: true, c: '#0f1b33' }); pie();
      }
      const x = M + (k % 2) * (cw + gap), yy = 72 + Math.floor(k / 2) * (ch + 32);
      p.rect(x, yy, cw, ch, { relleno: '#eef1f6' });
      p.imagen(f, x, yy, cw, ch);
      p.texto(x, yy + ch + 14, p.recortar(`${fDia(c.fecha)}${c.detalle ? ' · ' + c.detalle : ''}`, cw, 9), { t: 9, c: gris });
    });
  }
  return p.blob();
}

function textoMensaje(g, lunes) {
  return [
    `*${S.aj.negocio} – Liquidación semana ${fRango(lunes)}*`,
    `Chofer: ${g.chofer || '-'}`,
    `Camión: ${nombreCamion(g.camionId)}`,
    `Cargas: ${g.cargas.length}`,
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
  const datos = { app: 'camiones', version: 1, fecha: new Date().toISOString(), ajustes: S.aj, camiones: S.camiones, cargas: S.cargas, gastos: S.gastos, pagos: S.pagos };
  compartir(new Blob([JSON.stringify(datos)], { type: 'application/json' }), `respaldo-camiones-${hoy()}.json`);
}
async function recuperar(archivo) {
  try {
    const datos = JSON.parse(await archivo.text());
    if (datos.app !== 'camiones') throw new Error();
    const n = (datos.cargas || []).length;
    if (!confirm(`Esta copia tiene ${n} cargas y ${(datos.camiones || []).length} camiones.\n\nSe va a reemplazar todo lo que hay ahora en el teléfono. ¿Seguir?`)) return;
    await db.restaurar(datos);
    await cargarTodo(); ir('cargas'); avisar('Copia recuperada');
  } catch { alert('Ese archivo no es una copia de esta app.'); }
}
function excel() {
  const us = S.aj.formato === 'us', sep = us ? ',' : ';';
  const n = v => us ? String(Math.round(v * 100) / 100) : String(Math.round(v * 100) / 100).replace('.', ',');
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const filas = [['Fecha', 'Semana', 'Tipo', 'Camión', 'Chofer', 'Detalle', 'Cobrado', 'Petróleo', 'Otro gasto', 'Quién paga', 'Limpio']];
  S.cargas.forEach(x => filas.push([x.fecha, fRango(lunesDe(x.fecha)), 'Carga', nombreCamion(x.camionId), x.chofer, x.detalle, n(x.cobrado), n(x.petroleo), '', 'Mitad y mitad', n(x.cobrado - x.petroleo)]));
  S.gastos.forEach(x => filas.push([x.fecha, fRango(lunesDe(x.fecha)), x.tipo, nombreCamion(x.camionId), x.chofer, x.detalle, '', '', n(x.monto), x.compartido ? 'Mitad y mitad' : 'Solo dueño', n(x.compartido ? -x.monto : 0)]));
  const cuerpo = [filas[0], ...filas.slice(1).sort((a, b) => a[0].localeCompare(b[0]))].map(f => f.map(c).join(sep)).join('\r\n');
  compartir(new Blob(['﻿' + cuerpo], { type: 'text/csv' }), `camiones-${hoy()}.csv`);
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
    case 'nuevaCarga': formCarga(); break;
    case 'nuevoGasto': formGasto(); break;
    case 'nuevoCamion': formCamion(); break;
    case 'editarCarga': formCarga(S.cargas.find(x => x.id === id)); break;
    case 'editarGasto': formGasto(S.gastos.find(x => x.id === id)); break;
    case 'editarCamion': formCamion(camion(id)); break;
    case 'verFoto': verFoto(fotosForm[+el.dataset.i].d); break;
    case 'verRecibo': verFoto(reciboForm.d); break;
    case 'quitarFoto': fotosForm.splice(+el.dataset.i, 1); pintarFotos(); break;
    case 'quitarRecibo': reciboForm = null; pintarRecibo(); break;
    case 'borrarCarga': {
      const f = $('#formCarga');
      if (confirm('¿Borrar esta carga?')) { await borrar('cargas', f.dataset.id); cerrarHoja(); pintar(); avisar('Carga borrada'); }
      break;
    }
    case 'borrarGasto': {
      const f = $('#formGasto');
      if (confirm('¿Borrar este gasto?')) { await borrar('gastos', f.dataset.id); cerrarHoja(); pintar(); avisar('Gasto borrado'); }
      break;
    }
    case 'borrarCamion': {
      const f = $('#formCamion');
      if (confirm('¿Borrar este camión?')) { await borrar('camiones', f.dataset.id); cerrarHoja(); pintar(); }
      break;
    }
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
  if (a === 'calc') {
    const f = $('#formCarga');
    $('#limpio').textContent = dinero(numero(f.cobrado.value) - numero(f.petroleo.value));
  }
});

document.addEventListener('change', async e => {
  const t = e.target, a = t.dataset.a;
  if (a === 'cambiaCamion') { const f = $('#formCarga'); f.chofer.value = camion(t.value)?.chofer || ''; }
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
    if (!numero(d.cobrado)) return alert('Escribe cuánto se cobró por la carga.');
    await guardar('cargas', {
      id, creado: anterior('cargas')?.creado || Date.now(), fecha: d.fecha, camionId: d.camionId, chofer: d.chofer.trim(),
      detalle: d.detalle.trim(), cobrado: numero(d.cobrado), petroleo: numero(d.petroleo), fotos: fotosForm, recibo: reciboForm,
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
  if (f.id === 'formCamion') {
    const viejo = anterior('camiones');
    await guardar('camiones', {
      id, creado: viejo?.creado || Date.now(), nombre: d.nombre.trim(), placa: d.placa.trim().toUpperCase(),
      chofer: d.chofer.trim(), telefono: d.telefono.trim(), activo: viejo ? d.activo === 'on' : true,
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
  const [camiones, cargas, gastos, pagos, aj] = await Promise.all([...db.TABLAS.map(db.todos), db.leerAjustes()]);
  Object.assign(S, { camiones, cargas, gastos, pagos, aj: { ...AJ_BASE, ...(aj || {}) } });
  if (S.aj.negocio === 'Mis Camiones') S.aj.negocio = 'ALE';
}
// el logo se pasa a JPEG con fondo blanco para meterlo en el PDF
let logoPDF = null;
const img = new Image();
img.onload = () => {
  const k = 3, cv = document.createElement('canvas'); cv.width = img.naturalWidth * k; cv.height = img.naturalHeight * k;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, cv.width, cv.height);
  logoPDF = { d: cv.toDataURL('image/jpeg', .92), w: cv.width, h: cv.height };
};
img.src = 'logo-ale.png';
await cargarTodo();
// si la semana pasada no tiene nada, Pagos abre en la semana actual
if (!liquidacion(semanaPago).length && liquidacion(lunesDe(hoy())).length) semanaPago = lunesDe(hoy());
ir('cargas');
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
