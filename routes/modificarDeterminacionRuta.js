// modificarDeterminacionRuta.js
const express = require("express");
const router = express.Router();
const Examen = require("../models/examen");
const Determinacion = require("../models/determinacion");
const auditoriaController = require("../routes/AuditoriaRuta");

// Ruta para mostrar el formulario de búsqueda y modificación de determinaciones
router.get("/modificar-determinacion", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  try {
    const examenes = await Examen.findAll();
    const determinaciones = await Determinacion.findAll();
    res.render("buscarModificarDeterminacion", { examenes, determinaciones });
  } catch (error) {
    error(error);
    res
      .status(500)
      .send("Error al obtener la lista de exámenes y determinaciones.");
  }
});

// Ruta para procesar la búsqueda de determinaciones según el id_examen
router.post("/buscar-determinacion", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  try {
    const { codigo, nombre_examen } = req.body;

    // Verifica que se haya proporcionado al menos un criterio de búsqueda
    if (!codigo && !nombre_examen) {
      return res
        .status(400)
        .send(
          "Debe proporcionar el código o nombre del examen para realizar la búsqueda."
        );
    }



    // Buscar el examen por código o nombre del examen
    let examen;
    if (codigo) {
      examen = await Examen.findOne({ where: { codigo } });
    } else if (nombre_examen) {
      examen = await Examen.findOne({ where: { nombre_examen } });
    }

    // Si no se encuentra el examen, muestra un mensaje
    if (!examen) {
      return res.render("buscarModificarDeterminacion", {
        error: "Examen no encontrado",
        determinacionesEncontradas: null,
      });
    }

    // Buscar determinaciones asociadas al examen encontrado
    const determinacionesEncontradas = await Determinacion.findAll({
      where: { id_examen: examen.id_examen },
    });



    // Renderizar la página con las determinaciones encontradas o un mensaje si no se encuentran
    res.render("buscarModificarDeterminacion", {
      determinacionesEncontradas,
      error:
        determinacionesEncontradas.length === 0
          ? "No se encontraron determinaciones."
          : null,
    });
  } catch (error) {
    error("Error al procesar la búsqueda de determinaciones:", error);
    res.status(500).send("Error al procesar la búsqueda de determinaciones.");
  }
});

// Ruta para procesar la modificación del estado de determinaciones
router.post("/modificar-estado", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  try {
    const { id_Determinacion, estado } = req.body;

    // Verifica que req.user esté definido y tiene dataValues
    if (!req.user || !req.user.dataValues) {
      return res
        .status(401)
        .send("Usuario no autenticado o datos de usuario no disponibles.");
    }

    const usuarioId = req.user.dataValues.id_Usuario;

    log("ID de determinación recibido:", id_Determinacion);
    log("Nuevo estado recibido:", estado);
    const determinacion = await Determinacion.findByPk(id_Determinacion);

    if (!determinacion) {
      return res.status(404).send("Determinación no encontrada");
    }

    determinacion.estado = parseInt(estado, 10);
    await determinacion.save();

    log("Estado de determinación modificado con éxito.");

    // Registro de auditoría
    await auditoriaController.registrar(
      usuarioId, // usuarioId
      "Modificación de Estado de Determinación", // operación
      `Modificación del estado de la determinación con ID: ${id_Determinacion} a ${estado}` // detalles
    );

    res.redirect("/modificar-determinacion/modificar-determinacion");
  } catch (error) {
    error("Error al modificar el estado de la determinación:", error);
    res.status(500).send("Error al modificar el estado de la determinación.");
  }
});

module.exports = router;
