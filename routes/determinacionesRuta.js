const express = require("express");
const router = express.Router();
const { Examen, Determinacion, UnidadMedida } = require("../models");
const auditoriaController = require("./AuditoriaRuta");


router.get("/crear-determinacion/:id?", async (req, res) => {
  try {
    const { id } = req.params;
    let examenSeleccionado = null;

    if (id) {
      examenSeleccionado = await Examen.findByPk(id);
      if (!examenSeleccionado) {
        return res.status(404).send("El examen con ese ID no fue encontrado.");
      }
    }
    

    const examenes = await Examen.findAll();
    const unidadesMedida = await UnidadMedida.findAll();
    const determinaciones = await Determinacion.findAll();


    res.render("crearDeterminacion", { 
      pageTitle: 'Asignar Determinaciones a Examen',
      examenes,
      unidadesMedida,
      determinaciones,
      idExamenSeleccionado: examenSeleccionado ? examenSeleccionado.id_examen : null,
      nombreExamenSeleccionado: examenSeleccionado ? examenSeleccionado.nombre_examen : null
    });

  } catch (error) {
    console.error("Error al obtener datos para la vista de determinaciones:", error);
    res.status(500).send("Error al cargar la página.");
  }
});


router.post("/crear-determinacion/determinaciones", async (req, res) => {
  try {
    const { id_examen, determinaciones } = req.body;
    const usuarioId = req.session.usuario.id;
    
    if (!id_examen || !determinaciones) {
      return res.status(400).json({ error: "Datos incompletos." });
    }

    for (const det of determinaciones) {
      const data = {
        id_examen,
        Nombre_Determinacion: det.Nombre_Determinacion,
        Unidad_Medida: det.Unidad_Medida,
        estado: det.estado === 1 || det.estado === 'activo' ? 1 : 0,
      };

      if (det.id_Determinacion) {

        await Determinacion.update(data, { where: { id_Determinacion: det.id_Determinacion } });
      } else {

        await Determinacion.create(data);
      }
    }
    
    await auditoriaController.registrar(usuarioId, "Guardar Determinaciones", `Se guardaron determinaciones para el examen ID: ${id_examen}`);
    res.status(201).json({ message: "Determinaciones procesadas con éxito." });

  } catch (error) {

    console.error("Error al procesar las determinaciones:", error); 
    res.status(500).json({ error: "Error al guardar las determinaciones." });
  }
});


router.delete("/:idDeterminacion", async (req, res) => {
  try {
    const { idDeterminacion } = req.params;
    const usuarioId = req.session.usuario.id;

    const determinacion = await Determinacion.findByPk(idDeterminacion);
    if (!determinacion) {
      return res.status(404).json({ error: "Determinación no encontrada." });
    }

    const nombreDeterminacion = determinacion.Nombre_Determinacion;
    await determinacion.destroy();
    
    await auditoriaController.registrar(usuarioId, "Eliminar Determinación", `Determinación eliminada: ${nombreDeterminacion}`);
    res.status(200).json({ message: "Determinación eliminada con éxito." });
  } catch (error) {
    console.error("Error al eliminar la determinación:", error);
    res.status(500).json({ error: "Error al eliminar la determinación." });
  }
});

module.exports = router;