const express = require("express");
const router = express.Router();


const { Examen, Determinacion } = require("../models");
const auditoriaController = require("./AuditoriaRuta");



router.get("/modificar-determinacion", async (req, res) => {
  try {
    const examenes = await Examen.findAll();
    res.render("buscarModificarDeterminacion", {pageTitle: 'Modificar Determinaciones', examenes, determinaciones: [] });
  } catch (error) {
    console.error("Error al obtener la lista de exámenes:", error);
    res.status(500).send("Error al obtener la lista de exámenes.");
  }
});



router.post("/buscar-determinacion", async (req, res) => {
  try {
    const { codigo, nombre_examen } = req.body;
    if (!codigo && !nombre_examen) {
      return res.status(400).send("Debe proporcionar el código o nombre del examen.");
    }

    let examen;
    if (codigo) {
      examen = await Examen.findOne({ where: { codigo } });
    } else {
      examen = await Examen.findOne({ where: { nombre_examen } });
    }

    if (!examen) {
      return res.render("buscarModificarDeterminacion", {pageTitle: 'Modificar Determinaciones', error: "Examen no encontrado" });
    }

    const determinacionesEncontradas = await Determinacion.findAll({ where: { id_examen: examen.id_examen } });
    const examenes = await Examen.findAll();
    res.render("buscarModificarDeterminacion", {
      pageTitle: `Modificando: ${examen.nombre_examen}`,
      examenes,
      determinacionesEncontradas,
      error: determinacionesEncontradas.length === 0 ? "No se encontraron determinaciones." : null,
    });
  } catch (error) {
    console.error("Error al buscar determinaciones:", error);
    res.status(500).send("Error al procesar la búsqueda.");
  }
});



router.post("/modificar-estado", async (req, res) => {
  try {
    const { id_Determinacion, estado } = req.body;

    const usuarioId = req.session.usuario.id;

    const determinacion = await Determinacion.findByPk(id_Determinacion);
    if (!determinacion) {
      return res.status(404).send("Determinación no encontrada");
    }

    determinacion.estado = parseInt(estado, 10);
    await determinacion.save();

    await auditoriaController.registrar(
      usuarioId,
      "Modificación de Estado de Determinación",
      `Se cambió el estado de la determinación ID: ${id_Determinacion} a ${parseInt(estado, 10) === 1 ? 'Activo' : 'Inactivo'}`
    );

    req.flash('success', 'Estado de la determinación modificado con éxito.');
    res.redirect("/modificar-determinacion/modificar-determinacion");
  } catch (error) {
    console.error("Error al modificar el estado:", error);
    res.status(500).send("Error al modificar el estado de la determinación.");
  }
});

module.exports = router;