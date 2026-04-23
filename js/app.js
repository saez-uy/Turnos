let selectedSlot = null;

// ---- Inicialización ----

async function init() {
  document.getElementById('header-title').textContent  = CONFIG.negocio;
  document.getElementById('header-slogan').textContent = CONFIG.slogan;
  document.title = CONFIG.negocio;

  try {
    if (CONFIG.appsScriptUrl && CONFIG.appsScriptUrl !== 'PEGAR_URL_AQUI') {
      const res  = await fetch(`${CONFIG.appsScriptUrl}?action=config`);
      const data = await res.json();
      if (data.servicios && data.servicios.length) CONFIG.servicios = data.servicios;
      if (data.colores) aplicarColores(data.colores);
    }
  } catch (e) {
    console.warn('No se pudo cargar configuración dinámica:', e);
  }

  populateServicios();
  setDateLimits();
}

function aplicarColores(colores) {
  const map = {
    'primary':      '--primary',
    'primary-dark': '--primary-dark',
    'success':      '--success',
    'danger':       '--danger',
    'bg':           '--bg',
  };
  const root = document.documentElement;
  Object.entries(colores).forEach(([key, val]) => {
    if (map[key] && /^#[0-9a-fA-F]{3,6}$/.test(val)) {
      root.style.setProperty(map[key], val);
    }
  });
}

function populateServicios() {
  const sel = document.getElementById('servicio');
  CONFIG.servicios.forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s.nombre;
    opt.dataset.dur = s.duracion;
    opt.textContent = `${s.nombre} (${s.duracion} min)`;
    sel.appendChild(opt);
  });
}

function setDateLimits() {
  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const maxDay = new Date();
  maxDay.setDate(today.getDate() + CONFIG.diasAnticipacion);
  const input = document.getElementById('fecha');
  input.min = toYMD(tomorrow);
  input.max = toYMD(maxDay);
}

// ---- Helpers ----

function toYMD(d) {
  return d.toISOString().split('T')[0];
}

function getServicio() {
  const sel = document.getElementById('servicio');
  const opt = sel.options[sel.selectedIndex];
  return opt && opt.value ? { nombre: opt.value, duracion: parseInt(opt.dataset.dur) } : null;
}

function formatFecha(ymd) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function generateAllSlots(duracion) {
  const fecha    = document.getElementById('fecha').value;
  if (!fecha) return [];
  const dow      = new Date(fecha + 'T00:00:00').getDay();
  const horario  = CONFIG.horarios[dow];
  if (!horario) return [];

  const slots = [];
  let [hh, mm] = horario.inicio.split(':').map(Number);
  const [fh, fm] = horario.fin.split(':').map(Number);
  const finMin = fh * 60 + fm;

  while (hh * 60 + mm + duracion <= finMin) {
    slots.push(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
    mm += CONFIG.intervalo;
    if (mm >= 60) { hh += Math.floor(mm / 60); mm = mm % 60; }
  }
  return slots;
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ---- Navegación entre pasos ----

function goToStep(n) {
  document.querySelectorAll('.step').forEach((el, i) => {
    el.style.display = (i + 1 === n) ? '' : 'none';
  });
  document.querySelectorAll('.dot').forEach((el, i) => {
    el.classList.toggle('active', i < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Paso 1 → 2 ----

function irPaso2() {
  const sv   = getServicio();
  const fecha = document.getElementById('fecha').value;
  if (!sv)    { alert('Seleccioná un servicio.'); return; }
  if (!fecha) { alert('Seleccioná una fecha.');   return; }

  const dow = new Date(fecha + 'T00:00:00').getDay();
  if (!CONFIG.horarios[dow]) {
    alert('No hay atención ese día. Por favor elegí otra fecha.');
    return;
  }
  goToStep(2);
  loadSlots();
}

// ---- Carga de slots disponibles ----

async function loadSlots() {
  const sv    = getServicio();
  const fecha = document.getElementById('fecha').value;
  const container = document.getElementById('slots-container');
  container.innerHTML = '<p class="slots-empty">Consultando disponibilidad...</p>';
  selectedSlot = null;
  document.getElementById('btn-paso2').disabled = true;

  const todosSlots = generateAllSlots(sv.duracion);
  if (!todosSlots.length) {
    container.innerHTML = '<p class="slots-empty">No hay turnos disponibles ese día.</p>';
    return;
  }

  let ocupados = [];
  try {
    if (CONFIG.appsScriptUrl && CONFIG.appsScriptUrl !== 'PEGAR_URL_AQUI') {
      const url = `${CONFIG.appsScriptUrl}?action=slots&fecha=${fecha}`;
      const res  = await fetch(url);
      const data = await res.json();
      ocupados   = data.ocupados || [];
    }
  } catch (e) {
    console.warn('No se pudo verificar disponibilidad:', e);
  }

  const slots = todosSlots.map(hora => {
    const inicioMin = timeToMin(hora);
    const finMin    = inicioMin + sv.duracion;
    const bloqueado = ocupados.some(o => {
      const oIni = timeToMin(o.hora);
      const oFin = oIni + (parseInt(o.duracion) || CONFIG.intervalo);
      return inicioMin < oFin && oIni < finMin;
    });
    return { hora, disponible: !bloqueado };
  });

  renderSlots(slots, container);
}

function renderSlots(slots, container) {
  const disponibles = slots.filter(s => s.disponible);
  if (!disponibles.length) {
    container.innerHTML = '<p class="slots-empty">Todos los turnos están ocupados para este día.</p>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'slots-grid';
  slots.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = s.hora;
    if (!s.disponible) {
      btn.disabled = true;
    } else {
      btn.onclick = () => selectSlot(s.hora, btn);
    }
    grid.appendChild(btn);
  });
  container.innerHTML = '';
  container.appendChild(grid);
}

function selectSlot(hora, btn) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSlot = hora;
  document.getElementById('btn-paso2').disabled = false;
}

// ---- Paso 2 → 3 ----

function irPaso3() {
  if (!selectedSlot) { alert('Seleccioná un horario.'); return; }
  renderResumen('resumen-paso3');
  goToStep(3);
}

// ---- Resumen ----

function renderResumen(targetId) {
  const sv    = getServicio();
  const fecha = document.getElementById('fecha').value;
  const rows  = [
    ['Servicio',  sv ? sv.nombre : ''],
    ['Fecha',     formatFecha(fecha)],
    ['Hora',      selectedSlot],
    ['Nombre',    document.getElementById('nombre').value.trim()],
    ['Teléfono',  document.getElementById('telefono').value.trim()],
  ];
  const email = document.getElementById('email').value.trim();
  if (email) rows.push(['Email', email]);

  document.getElementById(targetId).innerHTML =
    rows.map(([k, v]) => `<div class="resumen-row"><span>${k}</span><span>${v}</span></div>`).join('');
}

// ---- Confirmar ----

function irPaso3desdeAjuste() {
  renderResumen('resumen-paso3');
  goToStep(3);
}

async function confirmar() {
  const nombre   = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  if (!nombre || !telefono) { alert('Nombre y teléfono son obligatorios.'); return; }
  if (nombre.length < 8) { alert('El nombre debe tener al menos 8 caracteres.'); return; }

  renderResumen('resumen-paso3');

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Confirmando...';
  document.getElementById('alerta-confirmar').innerHTML = '';

  const sv = getServicio();
  const payload = {
    nombre,
    telefono,
    email:    document.getElementById('email').value.trim(),
    servicio: sv ? sv.nombre : '',
    duracion: sv ? sv.duracion : CONFIG.intervalo,
    fecha:    document.getElementById('fecha').value,
    hora:     selectedSlot,
    notas:    document.getElementById('notas').value.trim(),
  };

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15000);

  try {
    let ok = false;
    let errorMsg = '';

    if (CONFIG.appsScriptUrl && CONFIG.appsScriptUrl !== 'PEGAR_URL_AQUI') {
      // Usamos GET con parámetros para evitar el problema del redirect de Apps Script con POST
      const params = new URLSearchParams({
        action:   'save',
        nombre:   payload.nombre,
        telefono: payload.telefono,
        email:    payload.email,
        servicio: payload.servicio,
        duracion: payload.duracion,
        fecha:    payload.fecha,
        hora:     payload.hora,
        notas:    payload.notas,
      });
      const res  = await fetch(`${CONFIG.appsScriptUrl}?${params}`, {
        signal:   controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.ok) {
        ok = true;
      } else {
        errorMsg = data.error || 'Error al guardar la reserva.';
      }
    } else {
      // Sin URL configurada: simular éxito (útil para desarrollo)
      clearTimeout(timeout);
      console.log('Reserva (modo demo):', payload);
      ok = true;
    }

    if (ok) {
      renderResumen('resumen-exito');
      document.getElementById('msg-exito').textContent = CONFIG.mensajeConfirmacion;
      goToStep(4);
    } else {
      document.getElementById('alerta-confirmar').innerHTML =
        `<div class="alert alert-danger">${errorMsg}</div>`;
      btn.disabled = false;
      btn.textContent = 'Confirmar turno';
    }
  } catch (e) {
    clearTimeout(timeout);
    const msg = e.name === 'AbortError'
      ? 'El servidor tardó demasiado. Intentá de nuevo.'
      : 'No se pudo guardar la reserva. Intentá de nuevo.';
    document.getElementById('alerta-confirmar').innerHTML =
      `<div class="alert alert-danger">${msg}</div>`;
    btn.disabled = false;
    btn.textContent = 'Confirmar turno';
  }
}

function nuevaReserva() {
  document.getElementById('servicio').selectedIndex  = 0;
  document.getElementById('fecha').value     = '';
  document.getElementById('nombre').value    = '';
  document.getElementById('telefono').value  = '';
  document.getElementById('email').value     = '';
  document.getElementById('notas').value     = '';
  document.getElementById('slots-container').innerHTML =
    '<p class="slots-empty">Seleccioná una fecha para ver los turnos disponibles.</p>';
  document.getElementById('alerta-confirmar').innerHTML = '';
  document.getElementById('btn-confirmar').disabled    = false;
  document.getElementById('btn-confirmar').textContent = 'Confirmar turno';
  selectedSlot = null;
  goToStep(1);
}

init();
