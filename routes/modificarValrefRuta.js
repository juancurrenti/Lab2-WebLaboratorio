const express = require("express");
const router = express.Router();


const { Determinacion, ValoresReferencia } = require("../models");
const auditoriaController = require("./AuditoriaRuta");


router.get("/buscar-valores-referencia", async (req, res) => {
  try {
    const determinaciones = await Determinacion.findAll();
    res.render("buscarModificarValref", {pageTitle: 'Buscar Valores de Referencia', determinaciones, valoresReferenciaEncontrados: [] });
  } catch (error) {
    console.error("Error al obtener la lista de determinaciones:", error);
    res.status(500).send("Error al obtener la lista de determinaciones.");
  }
});



router.post("/buscar-valores-referencia", async (req, res) => {
  try {
    const { id_Determinacion } = req.body;
    if (!id_Determinacion) {
      req.flash('error', 'Debe seleccionar una determinación para buscar.');
      return res.redirect('/valores-referencia/buscar-valores-referencia');
    }

    const valoresReferenciaEncontrados = await ValoresReferencia.findAll({
      where: { id_Determinacion: id_Determinacion },
    });
    
    const determinaciones = await Determinacion.findAll();

    res.render("buscarModificarValref", {
      pageTitle: `Valores para: ${determinacion ? determinacion.Nombre_Determinacion : ''}`,
      determinaciones,
      valoresReferenciaEncontrados,
      determinacionSeleccionada: id_Determinacion,
      error: valoresReferenciaEncontrados.length === 0 ? "No se encontraron valores de referencia." : null,
    });
  } catch (error) {
    console.error("Error al buscar valores de referencia:", error);
    res.status(500).send("Error al procesar la búsqueda.");
  }
});


router.get("/crear-modificar-valores-referencia/:valorId", async (req, res) => {
  try {
    const { valorId } = req.params;
    const valorReferenciaExistente = await ValoresReferencia.findByPk(valorId);
    const determinaciones = await Determinacion.findAll();

    res.render("crearModificarValref", {
      pageTitle: title,
      determinaciones,
      valorReferenciaExistente,
    });
  } catch (error) {
    console.error("Error al obtener el valor de referencia:", error);
    res.status(500).send("Error al obtener el valor de referencia.");
  }
});


router.post("/crear-modificar-valores-referencia/:valorId", async (req, res) => {
  try {
    const { valorId } = req.params;
    const { Edad_Minima, Edad_Maxima, Sexo, Valor_Referencia_Minimo, Valor_Referencia_Maximo, estado, id_Determinacion } = req.body;
    

    const usuarioId = req.session.usuario.id;

    const valorReferenciaExistente = await ValoresReferencia.findByPk(valorId);

    if (valorReferenciaExistente) {

      await valorReferenciaExistente.update({
        Edad_Minima, Edad_Maxima, Sexo, Valor_Referencia_Minimo, Valor_Referencia_Maximo,
        estado: estado === "1",
      });

      await auditoriaController.registrar(usuarioId, "Modificación de Valores de Referencia", `Modificación del valor ID: ${valorId}`);
    } else {

      await ValoresReferencia.create({
        id_Determinacion, Edad_Minima, Edad_Maxima, Sexo, Valor_Referencia_Minimo, Valor_Referencia_Maximo,
        estado: estado === "1",
      });

      await auditoriaController.registrar(usuarioId, "Creación de Valores de Referencia", `Nuevo valor para determinación ID: ${id_Determinacion}`);
    }

    req.flash('success', 'Valores de referencia guardados con éxito.');
    res.redirect("/valores-referencia/buscar-valores-referencia");
  } catch (error) {
    console.error("Error al procesar valores de referencia:", error);
    res.status(500).send("Error al procesar la creación/modificación.");
  }
});


module.exports = router;