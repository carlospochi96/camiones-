// Guardado en el mismo teléfono (IndexedDB). Nada sale del aparato.
const NOMBRE = 'camiones', VERSION = 2;
export const TABLAS = ['camiones', 'cargas', 'gastos', 'pagos', 'reparaciones'];

let base;
function abrir() {
  if (base) return Promise.resolve(base);
  return new Promise((ok, mal) => {
    const r = indexedDB.open(NOMBRE, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const t of TABLAS) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('ajustes')) d.createObjectStore('ajustes');
    };
    r.onsuccess = () => { base = r.result; ok(base); };
    r.onerror = () => mal(r.error);
  });
}

function paso(tabla, modo, fn) {
  return abrir().then(d => new Promise((ok, mal) => {
    const tx = d.transaction(tabla, modo), st = tx.objectStore(tabla);
    let res; const q = fn(st);
    if (q) q.onsuccess = () => { res = q.result; };
    tx.oncomplete = () => ok(res);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  }));
}

export const todos = t => paso(t, 'readonly', st => st.getAll());
export const guardar = (t, obj) => paso(t, 'readwrite', st => st.put(obj));
export const borrar = (t, id) => paso(t, 'readwrite', st => st.delete(id));
export const leerAjustes = () => paso('ajustes', 'readonly', st => st.get('ajustes'));
export const guardarAjustes = a => paso('ajustes', 'readwrite', st => st.put(a, 'ajustes'));

// Reemplaza todo con un respaldo
export async function restaurar(datos) {
  const d = await abrir();
  await new Promise((ok, mal) => {
    const tx = d.transaction([...TABLAS, 'ajustes'], 'readwrite');
    for (const t of TABLAS) {
      const st = tx.objectStore(t); st.clear();
      for (const o of datos[t] || []) st.put(o);
    }
    if (datos.ajustes) tx.objectStore('ajustes').put(datos.ajustes, 'ajustes');
    tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
  });
}
