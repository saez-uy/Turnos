// ============================================================
//  GOOGLE APPS SCRIPT — pegá este código en script.google.com
// ============================================================

const HOJA_NOMBRE = "Reservas";

const HEADERS = [
  "ID", "Nombre", "Telefono", "Email",
  "Servicio", "Duracion", "Fecha", "Hora",
  "Estado", "Notas", "Creado"
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
    p.email    || "",
    p.servicio,
    duracion,
    "'" + p.fecha,   // fuerza texto: evita auto-conversión a Date
    "'" + p.hora,    // fuerza texto: evita auto-conversión a Time
    "Pendiente",
    p.notas    || "",
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
      id:       limpiarCelda(row[0]),
      nombre:   limpiarCelda(row[1]),
      telefono: limpiarCelda(row[2]),
      email:    limpiarCelda(row[3]),
      servicio: limpiarCelda(row[4]),
      duracion: limpiarCelda(row[5]),
      fecha:    limpiarCelda(row[6]),
      hora:     limpiarCelda(row[7]),
      estado:   limpiarCelda(row[8]),
      notas:    limpiarCelda(row[9]),
      creado:   limpiarCelda(row[10]),
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
// ============================================================
