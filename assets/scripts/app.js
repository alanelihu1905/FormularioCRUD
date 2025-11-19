/* ==========================================
   CRUD · Escuela (personas) – AJAX vanilla
   ========================================== */

(() => {
  // --- Configuración del endpoint ---
  const URL = 'https://fi.jcaguilar.dev/v1/escuela/persona';
  const CABECERAS_JSON = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

  // --- Mapeos y helpers de UI ---
  const rolesPorId = { 1: 'Alumno', 2: 'Profesor', 3: 'Administrativo', 4: 'Otro' };
  const aMF = (sexoApi) => (String(sexoApi).toLowerCase() === 'h' ? 'M' : 'F');   // 'h/m' -> 'M/F'
  const aHM = (sexoUi)  => (sexoUi === 'M' ? 'h' : 'm');                          // 'M/F' -> 'h/m'
  const fechaHumana = (iso) => {
    if (!iso) return '—';
    const ymd = iso.slice(0,10);
    const [y,m,d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- Elementos del DOM ---
  const cuerpoTabla     = document.getElementById('cuerpoTabla');
  const btnNuevaPersona = document.getElementById('btnNuevaPersona');
  const btnRecargar     = document.getElementById('btnRecargar');

  const cortinaModal    = document.getElementById('cortinaModal');
  const tituloModal     = document.getElementById('tituloModal');
  const formulario      = document.getElementById('formularioPersona');
  const btnGuardar      = document.getElementById('btnGuardar');
  const btnCancelar     = document.getElementById('btnCancelar');

  const capaCargando    = document.getElementById('capaCargando');
  const toast           = document.getElementById('toast');

  // --- Estado ---
  let modo = 'crear'; // 'crear' | 'editar'
  let personaEditando = null; // objeto completo de la persona seleccionada

  // --- UX helpers ---
  const bloquearUI = (b=true) => capaCargando.classList.toggle('activa', b);
  const toastMsg = (t) => { toast.textContent = t; toast.classList.add('activo'); setTimeout(()=>toast.classList.remove('activo'), 2200); };

  const abrirModal = (modoNuevo, datos = null) => {
    modo = modoNuevo;
    tituloModal.textContent = modo === 'crear' ? 'Registrar persona' : 'Editar persona';
    formulario.reset();
    personaEditando = datos;

    if (modo === 'editar' && datos) {
      document.getElementById('id_persona').value = datos.id_persona ?? datos.id ?? '';
      document.getElementById('nombre').value     = datos.nombre ?? '';
      document.getElementById('apellido').value   = datos.apellido ?? '';
      document.getElementById('sexo').value       = aMF(datos.sexo ?? 'h');       // API -> UI
      document.getElementById('fecha').value      = (datos.fh_nac || '').slice(0,10);
      const idRol = ('id_rol' in datos && datos.id_rol != null) ? Number(datos.id_rol) : '';
      document.getElementById('id_rol').value     = idRol;
      document.getElementById('calificacion').value = datos.calificacion ?? '';
    }
    cortinaModal.classList.add('activa');
    setTimeout(()=>document.getElementById('nombre').focus(), 60);
  };
  const cerrarModal = () => cortinaModal.classList.remove('activa');

  const validar = () => {
    const req = ['nombre','apellido','sexo','fecha','id_rol'];
    let ok = true;
    req.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value) { el.setCustomValidity('Requerido'); ok = false; }
      else el.setCustomValidity('');
    });
    if (!ok) formulario.reportValidity();
    return ok;
  };

  // --- Render de tabla ---
  const renderTabla = (personas=[]) => {
    cuerpoTabla.innerHTML = '';
    if (!Array.isArray(personas) || personas.length === 0) {
      cuerpoTabla.innerHTML = `<tr><td class="estado" colspan="7">No hay registros para mostrar.</td></tr>`;
      return;
    }
    personas.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.nombre ?? ''}</td>
        <td>${p.apellido ?? ''}</td>
        <td>${aMF(p.sexo) === 'M' ? 'Masculino' : 'Femenino'}</td>
        <td>${fechaHumana(p.fh_nac)}</td>
        <td>${('id_rol' in p) ? (rolesPorId[p.id_rol] || '—') : (p.rol || '—')}</td>
        <td>${('calificacion' in p && p.calificacion != null) ? p.calificacion : '—'}</td>
        <td class="acciones"></td>
      `;
      const celda = tr.querySelector('.acciones');

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'boton btn-sec';
      btnEdit.textContent = 'Editar';
      btnEdit.addEventListener('click', () => abrirModal('editar', p));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'boton btn-peligro';
      btnDel.textContent = 'Borrar';
      btnDel.addEventListener('click', () => borrarPersona(p));

      celda.append(btnEdit, btnDel);
      cuerpoTabla.appendChild(tr);
    });
  };

  // --- API calls ---
  const traerPersonas = async () => {
    cuerpoTabla.innerHTML = `<tr><td class="estado" colspan="7">Cargando datos…</td></tr>`;
    try {
      const res = await fetch(URL);
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      const lista = await res.json();
      renderTabla(lista);
    } catch (e) {
      console.error(e);
      cuerpoTabla.innerHTML = `<tr><td class="estado" colspan="7">⚠️ Error al cargar los datos.</td></tr>`;
    }
  };

  const datosDelFormulario = () => ({
    id_persona: document.getElementById('id_persona').value ? Number(document.getElementById('id_persona').value) : null,
    nombre: document.getElementById('nombre').value.trim(),
    apellido: document.getElementById('apellido').value.trim(),
    sexo: aHM(document.getElementById('sexo').value),      // UI -> API ('h'/'m')
    fh_nac: document.getElementById('fecha').value,        // 'YYYY-MM-DD'
    id_rol: Number(document.getElementById('id_rol').value),
    // calificación no se envía porque el schema del backend no la define
  });

  const guardarPersona = async () => {
    if (!validar()) return;
    const datos = datosDelFormulario();

    bloquearUI(true);
    try {
      if (modo === 'crear') {
        // POST /persona  (sin id_persona)
        const { id_persona, ...payload } = datos;
        const res = await fetch(URL, { method: 'POST', headers: CABECERAS_JSON, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Error creando (${res.status})`);
        toastMsg('✔️ Registro creado');
      } else {
        // PATCH /persona  (con id_persona en el body)
        if (!datos.id_persona) throw new Error('Falta id_persona para editar');
        const res = await fetch(URL, { method: 'PATCH', headers: CABECERAS_JSON, body: JSON.stringify(datos) });
        if (!res.ok) throw new Error(`Error actualizando (${res.status})`);
        toastMsg('✔️ Registro actualizado');
      }
      cerrarModal();
      await traerPersonas();
    } catch (e) {
      console.error(e);
      toastMsg('❌ No se pudo guardar. Revisa los datos.');
    } finally {
      bloquearUI(false);
    }
  };

  const borrarPersona = async (p) => {
    const id = p.id_persona ?? p.id;
    if (!id) return toastMsg('No tengo el id_persona del registro 😵‍💫');
    const ok = window.confirm(`¿Borrar a ${p.nombre} ${p.apellido}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    bloquearUI(true);
    try {
      // DELETE /persona  (body: { id_persona })
      const res = await fetch(URL, {
        method: 'DELETE',
        headers: CABECERAS_JSON,
        body: JSON.stringify({ id_persona: Number(id) })
      });
      if (!res.ok) throw new Error(`Error eliminando (${res.status})`);
      toastMsg('🗑️ Registro eliminado');
      await traerPersonas();
    } catch (e) {
      console.error(e);
      toastMsg('❌ No se pudo borrar el registro.');
    } finally {
      bloquearUI(false);
    }
  };

  // --- Eventos ---
  btnNuevaPersona.addEventListener('click', () => abrirModal('crear'));
  btnRecargar.addEventListener('click', () => traerPersonas());
  btnCancelar.addEventListener('click', () => cerrarModal());
  btnGuardar.addEventListener('click', () => guardarPersona());
  cortinaModal.addEventListener('click', (e) => { if (e.target === cortinaModal) cerrarModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cortinaModal.classList.contains('activa')) cerrarModal(); });

  // --- Carga inicial ---
  traerPersonas();
})();