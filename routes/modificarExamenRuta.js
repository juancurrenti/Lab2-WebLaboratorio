const express = require("express");
const router = express.Router();
const { Examen, TiposMuestra } = require("../models");
const auditoriaController = require("./AuditoriaRuta");


router.get("/buscar-modificar-examen", async (req, res) => {
  try {

    const examenes = await Examen.findAll();
    const tiposMuestra = await TiposMuestra.findAll();


    res.render("buscarModificarExamen", {pageTitle: 'Buscar y Modificar Examen', examenes, tiposMuestra });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).send("Error al obtener los exámenes y tipos de muestra.");
  }
});


router.post("/buscar-modificar-examen", async (req, res) => {
  try {
    const { codigo, nombre_examen } = req.body;

    let examen;
    if (codigo) {
      examen = await Examen.findOne({ where: { codigo } });
    } else if (nombre_examen) {
      examen = await Examen.findOne({ where: { nombre_examen } });
    }


    const examenes = await Examen.findAll();
    const tiposMuestra = await TiposMuestra.findAll();

    if (!examen) {
      return res.render("buscarModificarExamen", {
        pageTitle: 'Buscar y Modificar Examen',
        examenes,
        tiposMuestra,
        error: "Examen no encontrado",
      });
    }

    res.render("buscarModificarExamen", {
      pageTitle: `Modificando: ${examen.nombre_examen}`,
      examenes,
      examen,
      tiposMuestra
    });
  } catch (error) {
    console.error("Error al buscar el examen:", error);
    res.status(500).send("Error al buscar el examen.");
  }
});


router.post("/modificar", async (req, res) => {
    try {
      const { id_examen, nombre_examen, descripcion, codigo, estado, tipo_muestra, tiempo_demora } = req.body;
      const usuarioId = req.session.usuario.id;
  
      const examen = await Examen.findByPk(id_examen);
      if (!examen) {
        return res.status(404).send("Examen no encontrado");
      }
  
      await examen.update({
        nombre_examen,
        descripcion,
        codigo,
        estado: estado === "1",
        idTipoMuestra: parseInt(tipo_muestra, 10),
        tiempoDemora: parseInt(tiempo_demora, 10),
      });
  
      await auditoriaController.registrar(
        usuarioId,
        "Modificación de Examen",
        `Se modificó el Examen: ${nombre_examen} (Código: ${codigo})`
      );
  
      req.flash('success', 'Examen modificado con éxito.');
      res.redirect("/modificar-examen/buscar-modificar-examen");
    } catch (error) {
      console.error("Error al modificar el examen:", error);
      res.status(500).send("Error al modificar el examen.");
    }
  });

module.exports = router;