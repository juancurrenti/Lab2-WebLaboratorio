const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");

// Modelos
const OrdenTrabajo = require("../models/ordenes_trabajo");
const Paciente = require("../models/paciente");
const Muestra = require("../models/muestra");
const Examen = require("../models/examen");
const OrdenesExamen = require("../models/ordenes_examen");
const TiposMuestra = require("../models/tipos_muestra");

// --- RUTAS DE BÚSQUEDA Y VISUALIZACIÓN ---

// Ruta para renderizar la página principal de búsqueda
router.get("/", (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  res.render("buscarPacientesOrdenes", { title: "Buscar Órdenes de Trabajo" });
});

// Ruta para buscar órdenes de un paciente (usado por AJAX)
router.post("/buscar-ordenes", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const { idPaciente } = req.body;

  if (!idPaciente) {
    return res.status(400).json({ error: "ID de paciente no proporcionado." });
  }

  try {
    const ordenes = await OrdenTrabajo.findAll({
      where: { id_Paciente: idPaciente, estado: { [Op.not]: "cancelada" } },
      include: {
        model: Paciente,
        as: 'paciente',
        attributes: ["nombre", "apellido", "dni", "id_Paciente"],
      },
      attributes: ["id_Orden", "Fecha_Creacion", "Fecha_Entrega", "estado", "id_Paciente"],
    });

    if (ordenes.length === 0) {
      return res.json({ message: "No se encontraron órdenes para este paciente." });
    }
    res.json(ordenes);
  } catch (error) {
    console.error("Error al buscar órdenes:", error);
    res.status(500).json({ error: "Error al buscar órdenes de trabajo." });
  }
});

// Ruta para buscar órdenes por DNI (otra búsqueda AJAX)
router.post("/ordenes", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const { dniPaciente } = req.body;
    const ordenesTrabajo = await OrdenTrabajo.findAll({
      where: { dni: dniPaciente, estado: { [Op.not]: "cancelada" } },
      include: {
        model: Paciente,
        attributes: ["nombre", "apellido", "dni", "id_Paciente"],
      },
      attributes: ["id_Orden", "Fecha_Creacion", "Fecha_Entrega", "estado", "id_Paciente"],
    });

    if (ordenesTrabajo.length === 0) {
      return res.json({ message: "No se encontraron órdenes para este paciente." });
    }
    res.json(ordenesTrabajo);
  } catch (error) {
    console.error("Error al buscar órdenes:", error);
    res.status(500).json({ error: "Error al buscar órdenes de trabajo." });
  }
});

// Ruta para obtener detalles de una orden (usado por AJAX)
router.get("/detalles/:id_Orden", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const { id_Orden } = req.params;
    const orden = await OrdenTrabajo.findByPk(id_Orden, {
      include: [
        { model: Paciente, attributes: ["nombre", "apellido", "dni"] },
        { model: Muestra, attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"] },
      ],
    });

    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada." });
    }
    res.json(orden);
  } catch (error) {
    console.error("Error al obtener los detalles de la orden:", error);
    res.status(500).json({ error: "Error al obtener los detalles de la orden." });
  }
});

// Ruta para MOSTRAR el formulario de modificación de una orden
router.get("/crear-modificar-orden/:idOrden", async (req, res) => {
  try {
    const { idOrden } = req.params;
    const orden = await OrdenTrabajo.findByPk(idOrden, {
      include: [
        {
          model: Muestra,
          as: 'Muestras',
          include: { model: TiposMuestra, as: "TipoMuestra" },
        },
        {
          model: OrdenesExamen,
          as: 'OrdenesExamenes',
          include: { model: Examen, as: 'Examen' },
        },
      ],
    });

    if (!orden) {
      return res.status(404).send("Orden no encontrada.");
    }

    const paciente = await Paciente.findByPk(orden.id_Paciente);
    if (!paciente) {
      return res.status(404).send("Paciente no encontrado.");
    }
    
    const examenes = await Examen.findAll({
      include: { model: TiposMuestra, as: "tipoMuestra" },
    });
    
    res.render("crearModificarOrden", { orden, examenes, paciente });

  } catch (error) {
    console.error("Error al obtener la orden:", error);
    res.status(500).send("Error al obtener la orden.");
  }
});

// --- OTRAS RUTAS AUXILIARES ---

// Ruta para la búsqueda dinámica de pacientes (AJAX)
router.get("/buscar-paciente-dinamico", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const { query } = req.query;

  try {
    const pacientes = await Paciente.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: `%${query}%` } },
          { apellido: { [Op.like]: `%${query}%` } },
          { dni: { [Op.like]: `%${query}%` } },
          { email: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id_Paciente", "nombre", "apellido", "dni", "email"],
    });
    res.json(pacientes);
  } catch (error) {
    console.error("Error al buscar pacientes:", error);
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

// Ruta para cancelar una orden
router.post("/cancelar-orden/:idOrden", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const { idOrden } = req.params;
    const { descripcionCancelacion } = req.body;

    const orden = await OrdenTrabajo.findByPk(idOrden);
    if (!orden) {
      return res.status(404).send("Orden no encontrada.");
    }

    orden.estado = "cancelada";
    orden.descripcionCancelacion = descripcionCancelacion;
    await orden.save();
    
    const rolesRedirect = {
      tecnico: "/tecnico",
      recepcionista: "/recepcionista",
      bioquimico: "/bioquimico",
      admin: "/admin",
    };

    const userRole = req.user.rol;
    if (req.isAuthenticated() && rolesRedirect[userRole]) {
      res.redirect(`${rolesRedirect[userRole]}?success=Orden+cancelada+con+éxito`);
    } else {
      res.status(403).send("Acceso no autorizado");
    }
  } catch (error) {
    console.error("Error al cancelar la orden:", error);
    res.status(500).send("Error al cancelar la orden.");
  }
});

// Ruta para ver órdenes informadas
router.get("/ordenes/informadas", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const ordenes = await OrdenTrabajo.findAll({
      where: { estado: "informada" },
      include: [
        { model: Paciente, attributes: ["nombre", "apellido", "dni"] },
        { model: Muestra, attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"] },
      ],
    });
    res.render("ordenesInformadas", { ordenes });
  } catch (error) {
    console.error("Error al obtener órdenes informadas:", error);
    res.status(500).send("Error al obtener órdenes informadas.");
  }
});

module.exports = router;