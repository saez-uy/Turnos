// ============================================================
//  CONFIGURACIÓN — editá este archivo para personalizar el sistema
// ============================================================

const CONFIG = {

  // --- Datos del negocio ---
  negocio:  "Mi Negocio",
  slogan:   "Reservá tu turno online",
  telefono: "11-1234-5678",
  mensajeConfirmacion: "¡Tu turno fue reservado con éxito! Te esperamos.",

  // --- URL del Google Apps Script ---
  // Completá esto después de publicar el script (ver instrucciones en apps-script.js)
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwkWIcsNgu22XQa5N6RUCvds2NVJD3R-03QsI7CD8CDhSMJGGZwFUCf6U25_OuJ5bRM_w/exec",

  // --- Servicios ---
  // { nombre, duracion en minutos }
  servicios: [
    { nombre: "Consulta general",      duracion: 30 },
    { nombre: "Consulta especializada", duracion: 60 },
    { nombre: "Seguimiento",            duracion: 20 },
    { nombre: "Tratamiento completo",   duracion: 90 },
  ],

  // --- Horarios por día ---
  // Claves: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
  // Eliminá o comentá los días que no trabajás
  horarios: {
    1: { inicio: "09:00", fin: "18:00" },
    2: { inicio: "09:00", fin: "18:00" },
    3: { inicio: "09:00", fin: "18:00" },
    4: { inicio: "09:00", fin: "18:00" },
    5: { inicio: "09:00", fin: "17:00" },
    6: { inicio: "09:00", fin: "13:00" },
  },

  // Intervalo entre slots en minutos
  intervalo: 30,

  // Cuántos días hacia adelante se pueden hacer reservas
  diasAnticipacion: 30,

  // Contraseña del panel de administración
  adminPassword: "admin1234",
};
