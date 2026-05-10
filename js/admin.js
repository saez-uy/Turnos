let todasLasReservas = [];
let adminPassword = CONFIG.adminPassword || 'admin1234';

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

  cargarReservas();
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

  const filtradas = todasLasReservas.filter(r => {
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

  renderTabla(filtradas);
}

function limpiarFiltros() {
  document.getElementById('f-desde').value  = '';
  document.getElementById('f-hasta').value  = '';
  document.getElementById('f-estado').value = '';
  document.getElementById('f-buscar').value = '';
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

  const ordenadas = [...lista].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
    return b.hora.localeCompare(a.hora);
  });

  const rows = ordenadas.map(r => `
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
  // Argentina: si empieza con 0, reemplazar por código de país 54
  if (digits.startsWith('0')) digits = '54' + digits.slice(1);
  // Si no tiene código de país, agregar 54
  if (!digits.startsWith('54')) digits = '54' + digits;
  return digits;
}

// ── Helpers ──

function toYMD(d) {
  return d.toISOString().split('T')[0];
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

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

initAdmin();
