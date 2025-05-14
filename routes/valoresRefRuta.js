const express = require("express");
const router = express.Router();
const ValoresReferencia = require("../models/valoresReferencia");
const Determinacion = require("../models/determinacion");
const UnidadMedida = require("../models/unidadMedida");
const auditoriaController = require("../routes/AuditoriaRuta");
const Examen = require("../models/examen");

// Ruta para mostrar el formulario de creación de valores de referencia
router.get("/crear-valores", async (req, res) => {
       // Verifica la autenticación del usuario
       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  try {
    const determinaciones = await Determinacion.findAll({
      include: [
        {
          model: UnidadMedida,
          as: "unidadMedida",
          attributes: ["nombreUnidadMedida"],
        },
        {
          model: Examen,
          as: "examen",
          attributes: ["nombre_examen"], // Solo traer el nombre del examen
        },
      ],
    });

    const valoresReferenciaExistentes = await ValoresReferencia.findAll();

    res.render("crearValores", { determinaciones, valoresReferenciaExistentes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al cargar la vista.");
  }
});

// Ruta para obtener los valores de referencia asociados a una determinación
router.get("/valores/:idDeterminacion", async (req, res) => {
       // Verifica la autenticación del usuario
       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  try {
    const { idDeterminacion } = req.params;
    const valoresReferencia = await ValoresReferencia.findAll({
      where: { id_Determinacion: idDeterminacion },
      attributes: [
        "id_ValorReferencia",
        "Edad_Minima",
        "Edad_Maxima",
        "Sexo",
        "Valor_Referencia_Minimo",
        "Valor_Referencia_Maximo",
        "Estado",
      ],
    });

    res.json({ valoresReferencia });
  } catch (error) {
    console.error("Error al obtener los valores de referencia:", error);
    res.status(500).send("Error al obtener los valores de referencia.");
  }
});

router.post("/guardar-valores", async (req, res) => {
       // Verifica la autenticación del usuario
       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  const { id_Determinacion, valoresReferencia } = req.body;

  try {
    for (const valor of valoresReferencia) {
      if (valor.id_ValorReferencia) {
        // Actualizar valores existentes
        await ValoresReferencia.update(
          {
            Edad_Minima: valor.Edad_Minima,
            Edad_Maxima: valor.Edad_Maxima,
            Sexo: valor.Sexo,
            Valor_Referencia_Minimo: valor.Valor_Referencia_Minimo,
            Valor_Referencia_Maximo: valor.Valor_Referencia_Maximo,
            Estado: valor.Estado,
          },
          
          { where: { id_ValorReferencia: valor.id_ValorReferencia } }
        );
        
      } else {
        // Crear nuevos valores
        await ValoresReferencia.create({
          id_Determinacion,
          Edad_Minima: valor.Edad_Minima,
          Edad_Maxima: valor.Edad_Maxima,
          Sexo: valor.Sexo,
          Valor_Referencia_Minimo: valor.Valor_Referencia_Minimo,
          Valor_Referencia_Maximo: valor.Valor_Referencia_Maximo,
          Estado: valor.Estado,
          
        });
        console.log("Datos recibidos:", req.body);
      }
    }

    // Registrar en auditoría
    await auditoriaController.registrar(
      req.user.dataValues.id_Usuario,
      "Guardar Valores de Referencia",
      `Se guardaron valores de referencia para la determinación ID: ${id_Determinacion}`
    );

    res.status(200).send("Valores de referencia guardados con éxito.");
  } catch (error) {
    console.error("Error al guardar los valores de referencia:", error);
    res.status(500).send("Error al guardar los valores de referencia.");
  }
});

router.delete("/eliminar/:id", async (req, res) => {
       // Verifica la autenticación del usuario
       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  const { id } = req.params;

  try {
    const valorReferencia = await ValoresReferencia.findByPk(id);
    if (!valorReferencia) {
      return res.status(404).json({ error: "Valor de referencia no encontrado." });
    }

    await valorReferencia.destroy();
    await auditoriaController.registrar(
      req.user.dataValues.id_Usuario,
      "Elimina valor de referencia",
      `Se elimino el valor de referencia para la determinación ID: ${id}`
    );
    res.status(200).json({ message: "Valor de referencia eliminado con éxito." });
  } catch (error) {
    console.error("Error al eliminar el valor de referencia:", error);
    res.status(500).json({ error: "Error al eliminar el valor de referencia." });
  }
});

module.exports = router;
