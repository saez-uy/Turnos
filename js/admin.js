let todasLasReservas = [];
let adminPassword = CONFIG.adminPassword || 'admin1234';
let vistaActual = 'lista';

// ── Init ──

async function initAdmin() {
  const empresa = await cargarEmpresa();

  if (!empresa) {
    document.getElementById('login-screen').innerHTML = `
      <div class="login-card">
        <div class="login-logo">⚠️</div>
        <h2>Empresa no encontrada</h2>
        <p class="login-sub">Verificá que la URL incluya el parámetro <code>?empresa=nombre</code></p>
      </div>`;
    return;
  }

  try {
    if (CONFIG.appsScriptUrl && CONFIG.appsScriptUrl !== 'PEGAR_URL_AQUI') {
      const res  = await fetch(`${CONFIG.appsScriptUrl}?action=config`);
      const data = await res.json();
      if (data.general && data.general.adminPassword) adminPassword = data.general.adminPassword;
      if (data.colores) aplicarColores(data.colores);
    }
  } catch (e) { /* usa contraseña fallback */ }

  if (sessionStorage.getItem(`admin_ok_${empresa.slug}`) === '1') {
    mostrarDashboard();
  }
}

// ── Login ──

function login() {
  const val  = document.getElementById('pwd').value;
  const slug = new URLSearchParams(window.location.search).get('empresa') || '';
  if (val === adminPassword) {
    sessionStorage.setItem(`admin_ok_${slug}`, '1');
    mostrarDashboard();
  } else {
    document.getElementById('login-error').style.display = '';
    document.getElementById('pwd').value = '';
    document.getElementById('pwd').focus();
  }
}

function logout() {
  const slug = new URLSearchParams(window.location.search).get('empresa') || '';
  sessionStorage.removeItem(`admin_ok_${slug}`);
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = '';
  document.getElementById('pwd').value = '';
}

async function mostrarDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = '';
  document.getElementById('admin-negocio').textContent = CONFIG.negocio;

  try {
    if (CONFIG.appsScriptUrl && CONFIG.appsScriptUrl !== 'PEGAR_URL_AQUI') {
      const res  = await fetch(`${CONFIG.appsScriptUrl}?action=config`);
      const data = await res.json();
      if (data.colores) aplicarColores(data.colores);
    }
  } catch (e) { /* usa colores por defecto */ }

  setDefaultDates();
  cargarReservas();
}

function setDefaultDates() {
  document.getElementById('f-desde').value = toYMD(new Date());
  document.getElementById('f-hasta').value = toYMD(addDays(new Date(), 7));
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

// ── Carga de datos ──

async function cargarReservas() {
  document.getElementById('tabla-wrapper').innerHTML =
    '<p class="slots-empty" style="padding:20px">Cargando reservas...</p>';

  try {
    const url  = `${CONFIG.appsScriptUrl}?action=reservas`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    todasLasReservas = data.reservas || [];
    actualizarStats();
    aplicarFiltros();
  } catch (e) {
    document.getElementById('tabla-wrapper').innerHTML =
      `<div class="alert alert-danger" style="margin:20px">Error al cargar reservas: ${e.message}</div>`;
  }
}

// ── Stats ──

function actualizarStats() {
  const hoy       = toYMD(new Date());
  const inicioSem = inicioSemana();

  const activas   = todasLasReservas.filter(r => r.estado !== 'Cancelado');
  const deHoy     = activas.filter(r => r.fecha === hoy);
  const deSemana  = activas.filter(r => r.fecha >= inicioSem && r.fecha <= hoy);
  const pendientes= activas.filter(r => r.estado === 'Pendiente');

  document.getElementById('stat-hoy').textContent       = deHoy.length;
  document.getElementById('stat-semana').textContent    = deSemana.length;
  document.getElementById('stat-pendientes').textContent= pendientes.length;
  document.getElementById('stat-total').textContent     = todasLasReservas.length;
}

// ── Filtros ──

function aplicarFiltros() {
  const desde  = document.getElementById('f-desde').value;
  const hasta  = document.getElementById('f-hasta').value;
  const estado = document.getElementById('f-estado').value;
  const buscar = document.getElementById('f-buscar').value.toLowerCase().trim();
  const orden  = document.getElementById('f-orden').value;

  let filtradas = todasLasReservas.filter(r => {
    if (desde  && r.fecha < desde)  return false;
    if (hasta  && r.fecha > hasta)  return false;
    if (estado && r.estado !== estado) return false;
    if (buscar) {
      const hay = [r.nombre, r.telefono, r.email, r.servicio, r.notas]
        .join(' ').toLowerCase();
      if (!hay.includes(buscar)) return false;
    }
    return true;
  });

  filtradas.sort((a, b) => {
    const cmp = a.fecha !== b.fecha
      ? a.fecha.localeCompare(b.fecha)
      : a.hora.localeCompare(b.hora);
    return orden === 'asc' ? cmp : -cmp;
  });

  if (vistaActual === 'semana') {
    renderCalendario(filtradas);
  } else {
    renderTabla(filtradas);
  }
}

function limpiarFiltros() {
  setDefaultDates();
  document.getElementById('f-estado').value = '';
  document.getElementById('f-buscar').value = '';
  document.getElementById('f-orden').value  = 'desc';
  aplicarFiltros();
}

// ── Vista ──

function cambiarVista(vista) {
  vistaActual = vista;
  document.getElementById('btn-vista-lista').classList.toggle('active', vista === 'lista');
  document.getElementById('btn-vista-semana').classList.toggle('active', vista === 'semana');
  aplicarFiltros();
}

// ── Tabla ──

function renderTabla(lista) {
  document.getElementById('tabla-count').textContent =
    `${lista.length} reserva${lista.length !== 1 ? 's' : ''}`;

  if (!lista.length) {
    document.getElementById('tabla-wrapper').innerHTML =
      '<p class="slots-empty" style="padding:20px">No hay reservas para mostrar.</p>';
    return;
  }

  const rows = lista.map(r => `
    <tr>
      <td>${formatFecha(r.fecha)}</td>
      <td><strong>${r.hora}</strong></td>
      <td>${esc(r.nombre)}</td>
      <td class="muted">${esc(r.telefono)}</td>
      <td class="muted">${esc(r.email)}</td>
      <td>${esc(r.servicio)}</td>
      <td><span class="badge badge-${r.estado.toLowerCase()}">${r.estado}</span></td>
      <td class="muted">${esc(r.notas)}</td>
      <td class="acciones">
        ${r.estado === 'Cancelado' ? '—' : `
          <button class="btn btn-danger btn-sm" onclick="cancelar('${r.id}', this)">Cancelar</button>
          ${r.estado !== 'Confirmada'
            ? `<button class="btn btn-success btn-sm" onclick="confirmarTurno('${r.id}', this)">Confirmar</button>`
            : ''}
        `}
      </td>
    </tr>
  `).join('');

  document.getElementById('tabla-wrapper').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Nombre</th>
          <th>Teléfono</th>
          <th>Email</th>
          <th>Servicio</th>
          <th>Estado</th>
          <th>Notas</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Calendario semanal ──

function renderCalendario(lista) {
  const hoy   = toYMD(new Date());
  const desde = document.getElementById('f-desde').value || hoy;
  const hasta = document.getElementById('f-hasta').value || toYMD(addDays(new Date(), 7));

  const dias = [];
  let cur = new Date(desde + 'T00:00:00');
  const fin = new Date(hasta + 'T00:00:00');
  while (cur <= fin && dias.length <= 31) {
    dias.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const porDia = {};
  dias.forEach(d => porDia[d] = []);
  lista.forEach(r => { if (porDia[r.fecha] !== undefined) porDia[r.fecha].push(r); });
  dias.forEach(d => porDia[d].sort((a, b) => a.hora.localeCompare(b.hora)));

  const total = lista.length;
  document.getElementById('tabla-count').textContent =
    `${total} reserva${total !== 1 ? 's' : ''}`;

  const cols = dias.map(d => {
    const esHoy = d === hoy;
    const cards = porDia[d].length === 0
      ? '<p class="cal-empty">Sin turnos</p>'
      : porDia[d].map(r => `
          <div class="cal-card cal-${r.estado.toLowerCase()}">
            <div class="cal-hora">${r.hora}</div>
            <div class="cal-nombre">${esc(r.nombre)}</div>
            <div class="cal-servicio">${esc(r.servicio)}</div>
            <span class="badge badge-${r.estado.toLowerCase()}">${r.estado}</span>
            ${r.estado !== 'Cancelado' ? `
              <div class="cal-acciones">
                <button class="btn btn-danger btn-sm" onclick="cancelar('${r.id}', this)">Cancelar</button>
                ${r.estado !== 'Confirmada'
                  ? `<button class="btn btn-success btn-sm" onclick="confirmarTurno('${r.id}', this)">Confirmar</button>`
                  : ''}
              </div>
            ` : ''}
          </div>
        `).join('');

    return `
      <div class="cal-col">
        <div class="cal-dia-header${esHoy ? ' hoy' : ''}">${formatFechaCorta(d)}</div>
        <div class="cal-dia-body">${cards}</div>
      </div>
    `;
  }).join('');

  document.getElementById('tabla-wrapper').innerHTML =
    `<div class="cal-grid">${cols}</div>`;
}

// ── Cancelar / Confirmar ──

async function cancelar(id, btn) {
  if (!confirm('¿Cancelar este turno?')) return;
  const reserva = todasLasReservas.find(x => x.id === id);
  await cambiarEstado(id, 'cancelar', 'Cancelado', btn, 'Cancelar', reserva);
}

async function confirmarTurno(id, btn) {
  if (!confirm('¿Confirmar este turno?')) return;
  const reserva = todasLasReservas.find(x => x.id === id);
  await cambiarEstado(id, 'confirmar', 'Confirmada', btn, 'Confirmar', reserva);
}

async function cambiarEstado(id, action, nuevoEstado, btn, labelOriginal, reserva) {
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const url  = `${CONFIG.appsScriptUrl}?action=${action}&id=${encodeURIComponent(id)}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');

    if (reserva) reserva.estado = nuevoEstado;
    actualizarStats();
    aplicarFiltros();

    if (reserva) abrirWhatsApp(reserva, nuevoEstado);
  } catch (e) {
    alert(`No se pudo actualizar: ${e.message}`);
    btn.disabled = false;
    btn.textContent = labelOriginal;
  }
}

function abrirWhatsApp(reserva, estado) {
  const tel = formatearTelefono(reserva.telefono);
  if (!tel) return;

  const fecha = formatFecha(reserva.fecha);
  let mensaje;

  if (estado === 'Confirmada') {
    mensaje =
      `Hola ${reserva.nombre}! Te confirmamos tu turno de *${reserva.servicio}* ` +
      `para el *${fecha}* a las *${reserva.hora}*. ¡Te esperamos!`;
  } else {
    mensaje =
      `Hola ${reserva.nombre}, lamentamos informarte que tu turno de *${reserva.servicio}* ` +
      `para el *${fecha}* a las *${reserva.hora}* fue cancelado. ` +
      `Comunicate con nosotros para reprogramarlo.`;
  }

  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function formatearTelefono(tel) {
  if (!tel) return '';
  let digits = tel.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '54' + digits.slice(1);
  if (!digits.startsWith('54')) digits = '54' + digits;
  return digits;
}

// ── Helpers ──

function toYMD(d) {
  return d.toISOString().split('T')[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function inicioSemana() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toYMD(d);
}

function formatFecha(ymd) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatFechaCorta(ymd) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit'
  });
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

initAdmin();
