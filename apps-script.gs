// ============================================================
//  GOOGLE APPS SCRIPT — pegá este código en script.google.com
// ============================================================

const HOJA_NOMBRE   = "Reservas";
const CONFIG_NOMBRE = "Configuracion";

const HEADERS = [
  "ID", "Nombre", "Telefono", "Email",
  "Servicio", "Duracion", "Fecha", "Hora",
  "Estado", "Notas", "Notificar", "Creado"
];

const CONFIG_DEFAULTS = [
  ["servicio", "Consulta general",        "30",                          "Duración en minutos"],
  ["servicio", "Consulta especializada",  "60",                          "Duración en minutos"],
  ["servicio", "Seguimiento",             "20",                          "Duración en minutos"],
  ["servicio", "Tratamiento completo",    "90",                          "Duración en minutos"],
  ["color",    "primary",                 "#4f6ef7",                     "Color principal (botones, encabezado)"],
  ["color",    "primary-dark",            "#3a57e8",                     "Color principal al pasar el mouse"],
  ["color",    "success",                 "#22c55e",                     "Color de éxito (confirmación)"],
  ["color",    "danger",                  "#ef4444",                     "Color de error y cancelar"],
  ["color",    "bg",                      "#f1f5f9",                     "Color de fondo de la página"],
  ["general",  "negocio",                 "Mi Negocio",                  "Nombre del negocio (aparece en el encabezado)"],
  ["general",  "slogan",                  "Reservá tu turno online",     "Texto debajo del nombre"],
  ["general",  "direccion",              "",                            "Dirección del local (aparece debajo del slogan)"],
  ["general",  "telefono",                "11-1234-5678",                "Teléfono de contacto"],
  ["general",  "mensaje",                 "¡Tu turno fue reservado con éxito! Te esperamos.", "Mensaje al confirmar una reserva"],
  ["general",  "diasAnticipacion",        "30",                          "Días máximos de anticipación para reservar"],
  ["general",  "intervalo",               "30",                          "Minutos entre turnos disponibles"],
  ["general",  "adminPassword",           "admin1234",                   "Contraseña del panel de administración"],
  ["horario",  "lunes",                   "09:00-18:00",                 "Vacío = no atiende ese día"],
  ["horario",  "martes",                  "09:00-18:00",                 "Vacío = no atiende ese día"],
  ["horario",  "miercoles",               "09:00-18:00",                 "Vacío = no atiende ese día"],
  ["horario",  "jueves",                  "09:00-18:00",                 "Vacío = no atiende ese día"],
  ["horario",  "viernes",                 "09:00-17:00",                 "Vacío = no atiende ese día"],
  ["horario",  "sabado",                  "09:00-13:00",                 "Vacío = no atiende ese día"],
  ["horario",  "domingo",                 "",                            "Vacío = no atiende ese día"],
];

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "slots") {
      const fecha = e.parameter.fecha;
      if (!fecha) return respuesta({ error: "Falta el parámetro fecha" });
      return respuesta({ ocupados: getOcupados(fecha) });
    }

    if (action === "save") {
      return guardarReserva(e.parameter);
    }

    if (action === "config") {
      return respuesta(getConfig());
    }

    if (action === "reservas") {
      return respuesta({ reservas: getTodasLasReservas() });
    }

    if (action === "cancelar") {
      const id = e.parameter.id;
      if (!id) return respuesta({ error: "Falta el parámetro id" });
      return cambiarEstado(id, "Cancelado");
    }

    if (action === "confirmar") {
      const id = e.parameter.id;
      if (!id) return respuesta({ error: "Falta el parámetro id" });
      return cambiarEstado(id, "Confirmada");
    }

    // debug: ver qué hay en el sheet
    if (action === "list") {
      const sheet = getSheet();
      const data  = sheet.getDataRange().getValues();
      return respuesta({ filas: data.map(row => row.map(celda => String(celda))) });
    }

    return respuesta({ ok: true, msg: "API activa" });
  } catch (err) {
    return respuesta({ error: err.message });
  }
}

// ---- Guardar reserva ----
function guardarReserva(p) {
  const requeridos = ["nombre", "telefono", "servicio", "fecha", "hora"];
  for (const campo of requeridos) {
    if (!p[campo]) return respuesta({ error: `Campo requerido: ${campo}` });
  }

  const duracion  = parseInt(p.duracion) || 30;
  const ocupados  = getOcupados(p.fecha);
  const inicioMin = horaAMin(p.hora);
  const finMin    = inicioMin + duracion;

  const choca = ocupados.some(o => {
    const oIni = horaAMin(o.hora);
    const oFin = oIni + (parseInt(o.duracion) || 30);
    return inicioMin < oFin && oIni < finMin;
  });

  if (choca) return respuesta({ error: "El turno ya no está disponible. Por favor elegí otro." });

  const sheet = getSheet();
  const id    = new Date().getTime().toString();

  // Guardamos fecha y hora como texto con apóstrofe para evitar que Sheets los convierta a Date
  sheet.appendRow([
    id,
    p.nombre,
    p.telefono,
    p.email      || "",
    p.servicio,
    duracion,
    "'" + p.fecha,   // fuerza texto: evita auto-conversión a Date
    "'" + p.hora,    // fuerza texto: evita auto-conversión a Time
    "Pendiente",
    p.notas      || "",
    p.notificar  || "",
    new Date().toLocaleString("es-AR")
  ]);

  return respuesta({ ok: true, id });
}

// ---- Listar todas las reservas (para el panel admin) ----
function getTodasLasReservas() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  const reservas = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    reservas.push({
      id:        limpiarCelda(row[0]),
      nombre:    limpiarCelda(row[1]),
      telefono:  limpiarCelda(row[2]),
      email:     limpiarCelda(row[3]),
      servicio:  limpiarCelda(row[4]),
      duracion:  limpiarCelda(row[5]),
      fecha:     limpiarCelda(row[6]),
      hora:      limpiarCelda(row[7]),
      estado:    limpiarCelda(row[8]),
      notas:     limpiarCelda(row[9]),
      notificar: limpiarCelda(row[10]),
      creado:    limpiarCelda(row[11]),
    });
  }
  return reservas;
}

// ---- Cambiar estado de una reserva ----
function cambiarEstado(id, nuevoEstado) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (limpiarCelda(data[i][0]) === id) {
      sheet.getRange(i + 1, 9).setValue(nuevoEstado);
      return respuesta({ ok: true });
    }
  }
  return respuesta({ error: "Reserva no encontrada" });
}

// ---- Configuración dinámica ----
function getConfig() {
  const sheet = getOrCreateConfigSheet();
  const data  = sheet.getDataRange().getValues();
  const servicios = [];
  const colores   = {};
  const general   = {};
  const horarios  = {};

  const diasMap = {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3,
    jueves: 4, viernes: 5, sabado: 6
  };

  for (let i = 1; i < data.length; i++) {
    const tipo   = String(data[i][0]).trim().toLowerCase();
    const nombre = String(data[i][1]).trim();
    const valor  = String(data[i][2]).trim();
    if (!tipo || !nombre) continue;

    if (tipo === "servicio" && valor) {
      servicios.push({ nombre, duracion: parseInt(valor) || 30 });
    } else if (tipo === "color" && valor) {
      colores[nombre] = valor;
    } else if (tipo === "general" && valor) {
      general[nombre] = valor;
    } else if (tipo === "horario") {
      const dow = diasMap[nombre.toLowerCase()];
      if (dow === undefined) continue;
      if (!valor) continue; // día sin atención
      const partes = valor.split("-");
      if (partes.length === 2) {
        horarios[dow] = { inicio: partes[0].trim(), fin: partes[1].trim() };
      }
    }
  }
  return { servicios, colores, general, horarios };
}

function getOrCreateConfigSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG_NOMBRE);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_NOMBRE);
    const headers = ["Tipo", "Nombre", "Valor", "Descripción"];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#4f6ef7")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    CONFIG_DEFAULTS.forEach(row => sheet.appendRow(row));
    sheet.autoResizeColumns(1, 4);
  }
  return sheet;
}

// Ejecutar esta función una vez desde el editor para agregar las filas nuevas
function setupConfig() {
  const sheet = getOrCreateConfigSheet();
  const data  = sheet.getDataRange().getValues();
  const existentes = new Set(
    data.slice(1).map(r => `${String(r[0]).trim()}|${String(r[1]).trim()}`)
  );
  CONFIG_DEFAULTS.forEach(row => {
    const key = `${row[0]}|${row[1]}`;
    if (!existentes.has(key)) {
      sheet.appendRow(row);
    }
  });
  sheet.autoResizeColumns(1, 4);
}

// ---- Leer turnos ocupados ----
function getOcupados(fecha) {
  const sheet    = getSheet();
  const data     = sheet.getDataRange().getValues();
  const ocupados = [];

  for (let i = 1; i < data.length; i++) {
    const row       = data[i];
    const rowFecha  = limpiarCelda(row[6]);
    const rowEstado = limpiarCelda(row[8]);

    if (rowFecha === fecha && rowEstado !== "Cancelado") {
      ocupados.push({
        hora:     limpiarCelda(row[7]),
        duracion: parseInt(row[5]) || 30
      });
    }
  }
  return ocupados;
}

// ---- Helpers ----

// Convierte cualquier valor de celda a string limpio (maneja Date, Number, String)
function limpiarCelda(val) {
  if (val instanceof Date) {
    // Si es solo fecha (hora 00:00:00), devolvemos YYYY-MM-DD
    if (val.getHours() === 0 && val.getMinutes() === 0 && val.getSeconds() === 0) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Si tiene hora (time value), devolvemos HH:MM
    const h = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }
  return String(val).trim();
}

function getSheet() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HOJA_NOMBRE);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_NOMBRE);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#4f6ef7")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }
  return sheet;
}

function horaAMin(hora) {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}

// ---- Recordatorios por email ----

// Ejecutar createDailyTrigger() UNA vez desde el editor para activar el envío automático
function sendReminders() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  const tz       = Session.getScriptTimeZone();
  const manana   = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaStr = Utilities.formatDate(manana, tz, "yyyy-MM-dd");

  const config  = getConfig();
  const negocio = (config.general && config.general.negocio) ? config.general.negocio : "Tu negocio";

  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const fecha    = limpiarCelda(row[6]);
    const estado   = limpiarCelda(row[8]);
    const notificar = limpiarCelda(row[10]);
    const email    = limpiarCelda(row[3]);

    if (fecha !== mananaStr) continue;
    if (estado !== "Confirmada") continue;
    if (notificar !== "true") continue;
    if (!email) continue;

    const nombre   = limpiarCelda(row[1]);
    const hora     = limpiarCelda(row[7]);
    const servicio = limpiarCelda(row[4]);
    const fechaES  = formatearFechaES(fecha);

    const asunto = `Recordatorio de turno — ${negocio}`;

    const cuerpoTexto =
      `Hola ${nombre},\n\n` +
      `Te recordamos que mañana tenés un turno:\n\n` +
      `📅 Fecha: ${fechaES}\n` +
      `🕐 Hora: ${hora}\n` +
      `💼 Servicio: ${servicio}\n\n` +
      `Si necesitás cancelar o reprogramar, comunicate con nosotros.\n\n` +
      `— ${negocio}`;

    const cuerpoHtml =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Te recordamos que mañana tenés un turno:</p>` +
      `<table style="border-collapse:collapse;margin:12px 0">` +
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b">📅 Fecha</td><td style="padding:4px 0"><strong>${fechaES}</strong></td></tr>` +
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b">🕐 Hora</td><td style="padding:4px 0"><strong>${hora}</strong></td></tr>` +
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b">💼 Servicio</td><td style="padding:4px 0"><strong>${servicio}</strong></td></tr>` +
      `</table>` +
      `<p style="color:#64748b;font-size:0.9em">Si necesitás cancelar o reprogramar, comunicate con nosotros.</p>` +
      `<p>— ${negocio}</p>`;

    try {
      GmailApp.sendEmail(email, asunto, cuerpoTexto, {
        htmlBody: cuerpoHtml,
        name: negocio,
      });
    } catch (e) {
      console.log("Error enviando recordatorio a " + email + ": " + e.message);
    }
  }
}

function formatearFechaES(ymd) {
  const [y, m, d] = ymd.split("-");
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
                 "agosto","septiembre","octubre","noviembre","diciembre"];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

// Ejecutar esta función UNA VEZ desde el editor de Apps Script para programar el envío diario
function createDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "sendReminders")
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("sendReminders")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  console.log("Trigger creado: sendReminders se ejecutará diariamente a las 8 AM.");
}

function respuesta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  INSTRUCCIONES DE CONFIGURACIÓN
// ============================================================
//
//  1. Abrí el Google Sheet → Extensiones → Apps Script
//  2. Borrá el código existente y pegá este archivo completo
//  3. Guardá con Ctrl+S
//  4. Implementar → Nueva implementación:
//       - Tipo:               Aplicación web
//       - Ejecutar como:      Yo
//       - Quién tiene acceso: Cualquier usuario
//  5. Copiá la URL y pegala en js/config.js → appsScriptUrl
//
//  IMPORTANTE: cada vez que modifiques el script debés crear
//  una NUEVA implementación para que los cambios tomen efecto.
//
// ============================================================
//  CONFIGURAR RECORDATORIOS POR EMAIL
// ============================================================
//
//  REQUISITO: el script debe ejecutarse con la cuenta de Google
//  que es dueña de la casilla turnosuy2026@gmail.com.
//  Si el sheet/script está en otra cuenta, el email se enviará
//  desde esa cuenta (no desde turnosuy2026@gmail.com).
//
//  Para activar los recordatorios automáticos:
//  1. En el editor de Apps Script, seleccioná la función
//     "createDailyTrigger" en el menú desplegable
//  2. Hacé clic en "Ejecutar"
//  3. Aceptá los permisos que pide (Gmail, Sheets)
//  4. Listo: sendReminders() correrá todos los días a las 8 AM
//     y enviará recordatorios a quienes eligieron la opción
//     "Notificarme el día antes" y su turno está Confirmado.
//
//  Para verificar que el trigger existe:
//  Activadores (reloj) → deberías ver sendReminders con
//  frecuencia "Basado en tiempo - Día - 8 a.m."
// ============================================================
