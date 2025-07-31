const express = require("express");
const router = express.Router();


const { Op } = require("sequelize"); 
const {sequelize, ValoresReferencia, Determinacion, UnidadMedida, Examen } = require("../models");
const auditoriaController = require("./AuditoriaRuta");



router.get("/crear-valores", async (req, res) => {

  try {
    const determinaciones = await Determinacion.findAll({
      include: [
        { model: UnidadMedida, as: "unidadMedida" },
        { model: Examen, as: "examen" },
      ],
    });

    res.render("crearValores", {pageTitle: 'Crear/Editar Valores de Referencia', determinaciones });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al cargar la vista.");
  }
});



router.get("/valores/:idDeterminacion", async (req, res) => {
  try {
    const { idDeterminacion } = req.params;
    const valoresReferencia = await ValoresReferencia.findAll({
      where: { id_Determinacion: idDeterminacion },
      attributes: [
        "id_ValorReferencia", "Edad_Minima", "Edad_Maxima", "Sexo",
        "Valor_Referencia_Minimo", "Valor_Referencia_Maximo", "Valor_Esperado", "Estado",
      ],
    });
    res.json({ valoresReferencia });
  } catch (error) {
    console.error("Error al obtener los valores de referencia:", error);
    res.status(500).send("Error al obtener los valores de referencia.");
  }
});

router.post("/guardar-valores", async (req, res) => {
  const { id_Determinacion, valoresReferencia } = req.body;
  const usuarioId = req.session.usuario.id;
  const transaction = await sequelize.transaction();

  try {
    const determinacion = await Determinacion.findByPk(id_Determinacion, {
      include: [{ model: UnidadMedida, as: "unidadMedida" }],
      transaction
    });
    
    const unidadesCualitativas = ['Positivo / Negativo', 'Reactivo / No Reactivo', 'Ausencia / Presencia'];
    const esCualitativa = unidadesCualitativas.includes(determinacion.unidadMedida.nombreUnidadMedida);

    for (const valor of valoresReferencia) {
      const { id_ValorReferencia, Edad_Minima, Edad_Maxima, Sexo } = valor;

      const existingRanges = await ValoresReferencia.findAll({
        where: {
          id_Determinacion,
          Sexo,
          id_ValorReferencia: { [Op.ne]: id_ValorReferencia || null }
        },
        transaction
      });

      for (const range of existingRanges) {
        if (Edad_Minima <= range.Edad_Maxima && Edad_Maxima >= range.Edad_Minima) {
          await transaction.rollback();
          return res.status(400).json({
            error: `El rango de edad (${Edad_Minima}-${Edad_Maxima}) se superpone con un rango existente (${range.Edad_Minima}-${range.Edad_Maxima}) para el sexo seleccionado.`
          });
        }
      }

      let data = {
        Edad_Minima,
        Edad_Maxima,
        Sexo,
        Estado: valor.Estado,
      };

      if (esCualitativa) {

        data.Valor_Esperado = valor.Valor_Esperado;
        data.Valor_Referencia_Minimo = null;
        data.Valor_Referencia_Maximo = null;
      } else {

        data.Valor_Referencia_Minimo = valor.Valor_Referencia_Minimo;
        data.Valor_Referencia_Maximo = valor.Valor_Referencia_Maximo;
        data.Valor_Esperado = null;
      }

      if (id_ValorReferencia) {
        await ValoresReferencia.update(data, { where: { id_ValorReferencia }, transaction });
      } else {
        await ValoresReferencia.create({ ...data, id_Determinacion }, { transaction });
      }
    }

    await auditoriaController.registrar(
      usuarioId,
      "Guardar Valores de Referencia",
      `Se guardaron valores para la determinación ID: ${id_Determinacion}`,
      { transaction }
    );
    
    await transaction.commit();
    res.status(200).send("Valores de referencia guardados con éxito.");
    
  } catch (error) {
    await transaction.rollback();
    console.error("Error al guardar los valores de referencia:", error);
    res.status(500).send("Error al guardar los valores de referencia.");
  }
});



router.delete("/eliminar/:id", async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.usuario.id;

  try {
    const valorReferencia = await ValoresReferencia.findByPk(id);
    if (!valorReferencia) {
      return res.status(404).json({ error: "Valor de referencia no encontrado." });
    }

    await valorReferencia.destroy();
    await auditoriaController.registrar(
      usuarioId,
      "Eliminar valor de referencia",
      `Se eliminó el valor de referencia ID: ${id}`
    );
    res.status(200).json({ message: "Valor de referencia eliminado con éxito." });
  } catch (error) {
    console.error("Error al eliminar el valor de referencia:", error);
    res.status(500).json({ error: "Error al eliminar el valor de referencia." });
  }
});

module.exports = router;