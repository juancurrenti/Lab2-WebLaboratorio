const express = require("express");
const router = express.Router();
const Examen = require("../models/examen");
const ValoresReferencia = require("../models/valoresReferencia");
const auditoriaController = require("../routes/AuditoriaRuta");
const TipoMuestra = require("../models/tipos_muestra");

// Ruta para mostrar el formulario de creación de exámenes
router.get("/crear-examen", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const tiposMuestra = await TipoMuestra.findAll({
      attributes: ["idTipoMuestra", "tipoDeMuestra"],
      raw: true,
    });

    res.render("crearExamen", { tiposMuestra });
  } catch (error) {
    console.error("Error al cargar los tipos de muestra:", error);
    res.status(500).send("Error al cargar los tipos de muestra.");
  }
});

// Ruta para procesar el formulario de creación de exámenes
router.post("/crear-examen", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const {
      nombre_examen,
      descripcion,
      codigo,
      estado,
      tiempo_demora,
      idTipoMuestra,
    } = req.body;

    // Validar campos requeridos
    if (
      !nombre_examen ||
      !codigo ||
      !idTipoMuestra ||
      estado === undefined ||
      tiempo_demora === undefined
    ) {
      return res
        .status(400)
        .send("Todos los campos son obligatorios. Por favor, complétalos.");
    }

    // Convertir valores a tipos apropiados
    const estadoParsed = parseInt(estado, 10);
    const tiempoDemoraParsed = parseInt(tiempo_demora, 10);

    // Validar estado y tiempo_demora
    if (
      ![0, 1].includes(estadoParsed) ||
      isNaN(tiempoDemoraParsed) ||
      tiempoDemoraParsed < 0
    ) {
      return res
        .status(400)
        .send("Datos inválidos. Verifica los valores ingresados.");
    }

    if (!req.user || !req.user.dataValues) {
      return res
        .status(401)
        .send("Usuario no autenticado o datos de usuario no disponibles.");
    }

    const usuarioId = req.user.dataValues.id_Usuario;

    // Crear el examen
    const examen = await Examen.create({
      nombre_examen,
      descripcion,
      codigo,
      estado: estadoParsed,
      tiempo_demora: tiempoDemoraParsed,
      idTipoMuestra,
    });

    console.log("Examen creado con éxito:", examen);

    // Registro de auditoría
    const tipoMuestraNombre = await TipoMuestra.findByPk(idTipoMuestra, {
      attributes: ["tipoDeMuestra"],
      raw: true,
    });

    await auditoriaController.registrar(
      usuarioId,
      "Creación de Examen",
      `Creación de un nuevo examen. 
      Nombre: ${nombre_examen}, 
      Descripción: ${descripcion || "N/A"}, 
      Código: ${codigo}, 
      Estado: ${estadoParsed === 1 ? "Activo" : "Inactivo"}, 
      Tiempo de demora: ${tiempoDemoraParsed} días, 
      Tipo de muestra: ${tipoMuestraNombre?.tipoDeMuestra || "N/A"}`
    );

    // Redireccionar al formulario de creación de determinaciones con el id del examen
    res.redirect(`/determinacion/crear-determinacion/${examen.id_examen}`);
  } catch (error) {
    console.error("Error al crear el examen:", error);
    res.status(500).send("Error al crear el examen.");
  }
});

// -------------------------------------------------------------------------
// NUEVA RUTA para listar exámenes disponibles
// -------------------------------------------------------------------------
router.get("/listado-examenes", async (req, res) => {
  // Verificar autenticación (opcional, ya que el middleware checkRole ya lo hace)
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    // Obtén todos los exámenes desde la base de datos
    const exams = await Examen.findAll({ raw: true });

    // Renderiza la vista 'listado-examenes.pug'
    res.render("listado-examenes", { exams });
  } catch (error) {
    console.error("Error al obtener los exámenes:", error);
    res.status(500).send("Error al obtener los exámenes");
  }
});

module.exports = router;
