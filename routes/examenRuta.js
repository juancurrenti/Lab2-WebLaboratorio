const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();


const { Examen, TiposMuestra } = require("../models");
const auditoriaController = require("./AuditoriaRuta");



router.get("/crear-examen", async (req, res) => {

  try {
    const tiposMuestra = await TiposMuestra.findAll();
    res.render("crearExamen", { pageTitle: 'Crear Nuevo Examen', tiposMuestra });
  } catch (error) {
    console.error("Error al cargar los tipos de muestra:", error);
    res.status(500).send("Error al cargar los tipos de muestra.");
  }
});



router.post("/crear-examen", async (req, res) => {
    try {
        const { nombre_examen, descripcion, codigo, estado, tiempo_demora, idTipoMuestra } = req.body;
        const usuarioId = req.session.usuario.id;

        if (!nombre_examen || !codigo || !idTipoMuestra || estado === undefined || tiempo_demora === undefined) {
            return res.status(400).send("Todos los campos son obligatorios.");
        }


        const examenExistente = await Examen.findOne({
            where: {
                [Op.or]: [
                    { nombre_examen: nombre_examen.trim() },
                    { codigo: codigo.trim() }
                ]
            }
        });

        if (examenExistente) {
            let errorMsg = '';
            if (examenExistente.nombre_examen.toLowerCase() === nombre_examen.trim().toLowerCase()) {
                errorMsg = `El nombre de examen "${nombre_examen}" ya está en uso.`;
            } else {
                errorMsg = `El código de examen "${codigo}" ya está en uso.`;
            }


            const tiposMuestra = await TiposMuestra.findAll();
            return res.render('crearExamen', {
                pageTitle: 'Crear Nuevo Examen',
                error: errorMsg,
                tiposMuestra: tiposMuestra,
                examen: req.body
            });
        }



        const examen = await Examen.create({
            nombre_examen,
            descripcion,
            codigo,
            estado: parseInt(estado, 10),
            tiempo_demora: parseInt(tiempo_demora, 10),
            idTipoMuestra,
        });

        await auditoriaController.registrar(
            usuarioId,
            "Creación de Examen",
            `Se creó el examen: ${nombre_examen} (Código: ${codigo})`
        );

        res.redirect(`/determinacion/crear-determinacion/${examen.id_examen}`);
    } catch (error) {
        console.error("Error al crear el examen:", error);
        res.status(500).send("Error al crear el examen.");
    }
});



router.get("/listado-examenes", async (req, res) => {
  try {
    const exams = await Examen.findAll();
    res.render("listado-examenes", { pageTitle: 'Listado de Exámenes', exams });
  } catch (error) {
    console.error("Error al obtener los exámenes:", error);
    res.status(500).send("Error al obtener los exámenes");
  }
});

module.exports = router;