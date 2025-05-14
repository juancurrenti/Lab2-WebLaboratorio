const express = require("express");
const router = express.Router();
const Examen = require("../models/examen");
const auditoriaController = require("../routes/AuditoriaRuta");
const TiposMuestra = require("../models/tipos_muestra");
// Ruta para buscar y modificar exámenes
router.get("/buscar-modificar-examen", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  try {
    const examenes = await Examen.findAll({
      attributes: [
        "id_examen",
        "nombre_examen",
        "descripcion",
        "codigo",
        "estado", // Esto se pasará como tinyint desde la BD
        "idTipoMuestra",
        "tiempoDemora",
      ],
    });

    const tiposMuestra = await TiposMuestra.findAll(); // Obtener los tipos de muestra

    res.render("buscarModificarExamen", { examenes, tiposMuestra });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener los exámenes y tipos de muestra.");
  }
});

// Ruta para procesar la búsqueda y mostrar el formulario de modificación
router.post("/buscar-modificar-examen", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  try {
    const { codigo, nombre_examen } = req.body;

    // Verifica que req.user esté definido y tiene dataValues
    if (!req.user || !req.user.dataValues) {
      return res
        .status(401)
        .send("Usuario no autenticado o datos de usuario no disponibles.");
    }

    const usuarioId = req.user.dataValues.id_Usuario;

    let examen;

    // Buscar el examen por código si se ha proporcionado
    if (codigo) {
      examen = await Examen.findOne({ where: { codigo } });
    }
    // Si no se ha proporcionado un código, buscar por nombre del examen
    else if (nombre_examen) {
      examen = await Examen.findOne({ where: { nombre_examen } });
    }

    if (!examen) {
      // Enviar el mensaje de "Examen no encontrado" en lugar de devolver un error
      return res.render("buscarModificarExamen", {
        error: "Examen no encontrado",
        examen: null,
      });
    }

    res.render("buscarModificarExamen", { examen });
  } catch (error) {
    console.error("Error al buscar y modificar el examen:", error);
    res.status(500).send("Error al buscar y modificar el examen.");
  }
});

// Ruta para procesar la modificación del examen
router.post("/modificar", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  try {
    const { id_examen, nombre_examen, descripcion, codigo, estado, tipo_muestra, tiempo_demora } = req.body;

    if (!req.user || !req.user.dataValues) {
      return res.status(401).send("Usuario no autenticado o datos de usuario no disponibles.");
    }

    const usuarioId = req.user.dataValues.id_Usuario;

    const examen = await Examen.findByPk(id_examen);
    if (!examen) {
      return res.status(404).send("Examen no encontrado");
    }

    examen.nombre_examen = nombre_examen;
    examen.descripcion = descripcion;
    examen.codigo = codigo;
    examen.estado = estado === "1"; // Convertimos el valor al boolean
    examen.idTipoMuestra = parseInt(tipo_muestra, 10);
    examen.tiempoDemora = parseInt(tiempo_demora, 10);

    await examen.save();

    await auditoriaController.registrar(
      usuarioId,
      "Modificación de Examen",
      `Examen modificado: Nombre: ${nombre_examen}, Código: ${codigo}, Estado: ${estado}, Tipo de Muestra: ${tipo_muestra}, Tiempo de Demora: ${tiempo_demora}`
    );

    res.render("buscarModificarExamen", {
      examenes: await Examen.findAll(),
      tiposMuestra: await TiposMuestra.findAll(),
      successMessage: "Examen modificado con éxito.",
    });
  } catch (error) {
    console.error("Error al modificar el examen:", error);
    res.status(500).send("Error al modificar el examen.");
  }
});

module.exports = router;
