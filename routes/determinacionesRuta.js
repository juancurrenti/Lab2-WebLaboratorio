const express = require("express");
const router = express.Router();
const Examen = require("../models/examen");
const Determinacion = require("../models/determinacion");
const UnidadMedida = require("../models/unidadMedida"); // Cambia a mayúsculas para la convención de nombres de modelos
const auditoriaController = require("../routes/AuditoriaRuta");

// Ruta para mostrar el formulario de creación de determinaciones
router.get("/crear-determinacion", async (req, res) => {
  try {
    const examenes = await Examen.findAll();
    const unidadesMedida = await UnidadMedida.findAll({ raw: true });

    // Incluir las relaciones con unidades de medida en las determinaciones
    const determinaciones = await Determinacion.findAll({
      include: {
        model: UnidadMedida,
        as: "unidadMedida", // Alias definido en la asociación
        attributes: ["id_UnidadMedida", "nombreUnidadMedida"],
      },
    });

    // Serializar los datos para que incluyan las unidades relacionadas
    const serializedDeterminaciones = determinaciones.map(d => ({
      ...d.toJSON(),
      Unidad_Medida: d.unidadMedida?.id_UnidadMedida || null,
      nombreUnidadMedida: d.unidadMedida?.nombreUnidadMedida || null,
    }));

    res.render("crearDeterminacion", {
      examenes,
      determinaciones: serializedDeterminaciones,
      unidadesMedida,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener los datos necesarios para la vista.");
  }
});

router.post("/crear-determinacion/determinaciones", async (req, res) => {
  try {
    const { id_examen, determinaciones } = req.body;
    const usuarioId = req.user.dataValues.id_Usuario;
    // Validar que el examen existe
    const examen = await Examen.findByPk(id_examen);
    if (!examen) {
      return res.status(404).json({ error: "Examen no encontrado." });
    }
    const nuevasDeterminaciones = [];
    const actualizadasDeterminaciones = [];
    for (const det of determinaciones) {
      const unidadMedida = await UnidadMedida.findByPk(det.Unidad_Medida);
      if (!unidadMedida) {
        return res.status(404).json({
          error: `Unidad de medida con ID ${det.Unidad_Medida} no encontrada.`,
        });
      }

      if (det.id_Determinacion) {
        // Actualizar determinación existente
        const determinacionExistente = await Determinacion.findByPk(det.id_Determinacion);
        if (determinacionExistente) {
          await determinacionExistente.update({
            Nombre_Determinacion: det.Nombre_Determinacion,
            Valor: det.Valor,
            Unidad_Medida: det.Unidad_Medida,
            Sexo: det.Sexo,
            estado: det.estado === 1 || det.estado === "activo" ? 1 : 0,
          });
          actualizadasDeterminaciones.push(determinacionExistente);
          await auditoriaController.registrar(
            usuarioId,
            "Actualizar Determinación",
            `Determinación actualizada: ${determinacionExistente.Nombre_Determinacion}`
          );
          continue;
        }
      }

      // Crear una nueva determinación si no existe
      const nuevaDeterminacion = await Determinacion.create({
        id_examen,
        Nombre_Determinacion: det.Nombre_Determinacion,
        Valor: det.Valor,
        Unidad_Medida: det.Unidad_Medida,
        Sexo: det.Sexo,
        estado: det.estado === 1 || det.estado === "activo" ? 1 : 0,
      });

      nuevasDeterminaciones.push(nuevaDeterminacion);
      await auditoriaController.registrar(
        usuarioId,
        "Crear Determinación",
        `Nueva determinación creada: ${nuevaDeterminacion.Nombre_Determinacion}`
      );
    }

    res.status(201).json({
      message: "Determinaciones procesadas con éxito.",
      nuevas: nuevasDeterminaciones,
      actualizadas: actualizadasDeterminaciones,
    });
  } catch (error) {
    console.error("Error al procesar las determinaciones:", error);
    res.status(500).json({ error: "Error al procesar las determinaciones." });
  }
});

// Ruta DELETE para eliminar una determinación
router.delete("/:idDeterminacion", async (req, res) => {
  try {
    const { idDeterminacion } = req.params;
    const usuarioId = req.user.dataValues.id_Usuario;
    const determinacion = await Determinacion.findByPk(idDeterminacion);
    if (!determinacion) {
      return res.status(404).json({ error: "Determinación no encontrada." });
    }

    await determinacion.destroy();
    await auditoriaController.registrar(
      usuarioId,
      "Eliminar Determinación",
      `Determinación eliminada: ${determinacion}`
    );
    res.status(200).json({ message: "Determinación eliminada con éxito." });
  } catch (error) {
    console.error("Error al eliminar la determinación:", error);
    res.status(500).json({ error: "Error al eliminar la determinación." });
  }
});








router.get("/crear-determinacion/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const examenes = await Examen.findAll();
    const unidadesMedida = await UnidadMedida.findAll({ raw: true });

    const determinaciones = await Determinacion.findAll({
      include: {
        model: UnidadMedida,
        as: "unidadMedida",
        attributes: ["id_UnidadMedida", "nombreUnidadMedida"],
      },
    });

    const serializedDeterminaciones = determinaciones.map(d => ({
      ...d.toJSON(),
      Unidad_Medida: d.unidadMedida?.id_UnidadMedida || null,
      nombreUnidadMedida: d.unidadMedida?.nombreUnidadMedida || null,
    }));

    res.render("crearDeterminacion", {
      examenes,
      determinaciones: serializedDeterminaciones,
      unidadesMedida,
      idExamenSeleccionado: id, // Examen preseleccionado
    });
  } catch (error) {
    console.error("Error al obtener los datos necesarios para la vista:", error);
    res.status(500).send("Error al obtener los datos necesarios para la vista.");
  }
});


module.exports = router;
