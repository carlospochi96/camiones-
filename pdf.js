// Generador de PDF sencillo, sin librerías ni internet.
// Coordenadas desde arriba a la izquierda, en puntos (hoja A4 = 595 x 842).

const ANCHO_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const ANCHO_NEG = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const ESPECIALES = { '–': 0x96, '—': 0x97, '•': 0x95, '€': 0x80, '“': 0x93, '”': 0x94, '‘': 0x91, '’': 0x92 };

function aWin(s) {
  let r = '';
  for (const ch of String(s)) {
    const c = ch.charCodeAt(0);
    if (c < 256) r += ch; else if (ESPECIALES[ch]) r += String.fromCharCode(ESPECIALES[ch]); else r += '?';
  }
  return r;
}
const escapar = s => aWin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');

function anchoLetra(ch, negrita) {
  const t = negrita ? ANCHO_NEG : ANCHO_REG;
  let c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return t[c - 32];
  const base = ch.normalize('NFD')[0];
  c = base.charCodeAt(0);
  if (c >= 32 && c <= 126) return t[c - 32];
  return 556;
}

const color = hex => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' ');
};

function base64Bytes(dataURL) {
  const b = atob(dataURL.split(',')[1]), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

export class PDF {
  constructor() { this.W = 595; this.H = 842; this.paginas = []; this.imagenes = new Map(); this.pagina(); }
  pagina() { this.c = []; this.paginas.push(this.c); }
  Y(y) { return (this.H - y).toFixed(2); }

  ancho(s, tam = 10, negrita = false) {
    let w = 0; for (const ch of String(s)) w += anchoLetra(ch, negrita);
    return w * tam / 1000;
  }
  // Corta un texto con "…" si no cabe
  recortar(s, max, tam = 10, negrita = false) {
    s = String(s);
    if (this.ancho(s, tam, negrita) <= max) return s;
    while (s.length && this.ancho(s + '...', tam, negrita) > max) s = s.slice(0, -1);
    return s + '...';
  }
  texto(x, y, s, { t = 10, b = false, c = '#1d2433', al = 'izq' } = {}) {
    s = String(s);
    if (al === 'der') x -= this.ancho(s, t, b);
    else if (al === 'centro') x -= this.ancho(s, t, b) / 2;
    this.c.push(`BT ${color(c)} rg /${b ? 'F2' : 'F1'} ${t} Tf ${x.toFixed(2)} ${this.Y(y)} Td (${escapar(s)}) Tj ET`);
  }
  rect(x, y, w, h, { relleno, borde, grosor = 1 } = {}) {
    let op = '';
    if (relleno) op += `${color(relleno)} rg `;
    if (borde) op += `${color(borde)} RG ${grosor} w `;
    op += `${x.toFixed(2)} ${this.Y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re ${relleno && borde ? 'B' : relleno ? 'f' : 'S'}`;
    this.c.push(op);
  }
  linea(x1, y1, x2, y2, c = '#d5dae3', grosor = .8) {
    this.c.push(`${color(c)} RG ${grosor} w ${x1.toFixed(2)} ${this.Y(y1)} m ${x2.toFixed(2)} ${this.Y(y2)} l S`);
  }
  // foto = { d: 'data:image/jpeg;base64,...', w, h }; se ajusta dentro del cuadro sin deformarse
  imagen(foto, x, y, w, h) {
    if (!foto || !foto.d || !foto.d.startsWith('data:image/jpeg')) return;
    let nombre = this.imagenes.get(foto.d)?.nombre;
    if (!nombre) { nombre = 'Im' + (this.imagenes.size + 1); this.imagenes.set(foto.d, { nombre, foto }); }
    const k = Math.min(w / foto.w, h / foto.h), iw = foto.w * k, ih = foto.h * k;
    const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
    this.c.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${this.Y(iy + ih)} cm /${nombre} Do Q`);
  }

  blob() {
    const partes = [], offsets = [];
    let largo = 0;
    const enc = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    const poner = d => { const u = typeof d === 'string' ? enc(d) : d; partes.push(u); largo += u.length; };
    const objeto = (n, cuerpo, flujo) => {
      offsets[n] = largo;
      if (flujo) { poner(`${n} 0 obj\n${cuerpo}\nstream\n`); poner(flujo); poner('\nendstream\nendobj\n'); }
      else poner(`${n} 0 obj\n${cuerpo}\nendobj\n`);
    };

    const imgs = [...this.imagenes.values()];
    const primeraImg = 5, primeraPag = primeraImg + imgs.length;
    const kids = this.paginas.map((_, i) => `${primeraPag + i * 2 + 1} 0 R`).join(' ');
    const xobj = imgs.map((im, i) => `/${im.nombre} ${primeraImg + i} 0 R`).join(' ');

    poner('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objeto(2, `<< /Type /Pages /Kids [${kids}] /Count ${this.paginas.length} >>`);
    objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objeto(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    imgs.forEach((im, i) => {
      const bytes = base64Bytes(im.foto.d);
      objeto(primeraImg + i, `<< /Type /XObject /Subtype /Image /Width ${im.foto.w} /Height ${im.foto.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`, bytes);
    });
    this.paginas.forEach((ops, i) => {
      const flujo = enc(ops.join('\n'));
      const nc = primeraPag + i * 2, np = nc + 1;
      objeto(nc, `<< /Length ${flujo.length} >>`, flujo);
      objeto(np, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobj} >> >> /Contents ${nc} 0 R >>`);
    });

    const total = primeraPag + this.paginas.length * 2;
    const inicioXref = largo;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let n = 1; n < total; n++) xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    poner(xref + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);
    return new Blob(partes, { type: 'application/pdf' });
  }
}
