const express = require("express");
const router = express.Router();

const { UnidadMedida } = require("../models"); 

/**
 * @route   
 * @desc    
 * @access  
 */
router.post("/crear", async (req, res) => {

  if (!req.isAuthenticated() || !req.session.usuario.esEmpleado) {
    return res.status(403).json({ error: "Acceso no autorizado." });
  }


  const { nombreUnidadMedida, tipo } = req.body;


  if (!nombreUnidadMedida || !tipo) {
    return res.status(400).json({ error: "El nombre y el tipo de la unidad son requeridos." });
  }

  try {

    const nuevaUnidad = await UnidadMedida.create({
      nombreUnidadMedida,
      tipo
    });


    res.status(201).json(nuevaUnidad);

  } catch (error) {

    console.error("Error al crear la unidad de medida:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

module.exports = router;