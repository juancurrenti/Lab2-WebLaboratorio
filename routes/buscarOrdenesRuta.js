const express = require("express");
const router = express.Router();
const OrdenTrabajo = require("../models/ordenes_trabajo");
const Paciente = require("../models/paciente");
const Muestra = require("../models/muestra");
const Examen = require("../models/examen");
const OrdenesExamen = require("../models/ordenes_examen");
const auditoriaController = require("../routes/AuditoriaRuta");
const TiposMuestra = require("../models/tipos_muestra");
const OrdenesExamenes = require("../models/ordenes_examen");

const { Op } = require("sequelize");
const sequelize = require("../config/database");

// Ruta para buscar un paciente y mostrar sus órdenes de trabajo
router.get("/", (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  res.render("buscarPacientesOrdenes", { title: "Buscar Órdenes de Trabajo" });
});

router.post("/buscar-ordenes", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const { idPaciente } = req.body;

  console.log("Datos recibidos:", req.body); // Depuración

  if (!idPaciente) {
    return res.status(400).json({ error: "ID de paciente no proporcionado." });
  }

  try {
    const ordenes = await OrdenTrabajo.findAll({
      where: { id_Paciente: idPaciente, estado: { [Op.not]: "cancelada" } },
      include: {
        model: Paciente,
        attributes: ["nombre", "apellido", "dni", "id_Paciente"],
      },
      attributes: [
        "id_Orden",
        "Fecha_Creacion",
        "Fecha_Entrega",
        "estado",
        "id_Paciente",
      ],
    });

    if (ordenes.length === 0) {
      return res.json({
        message: "No se encontraron órdenes para este paciente.",
      });
    }

    res.json(ordenes);
  } catch (error) {
    console.error("Error al buscar órdenes:", error);
    res.status(500).json({ error: "Error al buscar órdenes de trabajo." });
  }
});

// Ruta para manejar la búsqueda de órdenes de trabajo por DNI del paciente
router.post("/ordenes", async (req, res) => {
  // Verifica la autenticación del usuario
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
      attributes: [
        "id_Orden",
        "Fecha_Creacion",
        "Fecha_Entrega",
        "estado",
        "id_Paciente",
      ],
    });

    if (ordenesTrabajo.length === 0) {
      return res.json({
        message: "No se encontraron órdenes para este paciente.",
      });
    }

    res.json(ordenesTrabajo);
  } catch (error) {
    console.error("Error al buscar órdenes:", error);
    res.status(500).json({ error: "Error al buscar órdenes de trabajo." });
  }
});

// Ruta para obtener los detalles adicionales de una orden de trabajo
router.get("/detalles/:id_Orden", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const { id_Orden } = req.params;

    const orden = await OrdenTrabajo.findByPk(id_Orden, {
      include: [
        {
          model: Paciente,
          attributes: ["nombre", "apellido", "dni"],
        },
        {
          model: Muestra,
          attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"],
        },
      ],
    });

    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada." });
    }

    res.json(orden);
  } catch (error) {
    console.error("Error al obtener los detalles de la orden:", error);
    res
      .status(500)
      .json({ error: "Error al obtener los detalles de la orden." });
  }
});

// Ruta para mostrar el formulario de creación/modificación de órdenes
router.get("/crear-modificar-orden/:idOrden", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const { idOrden } = req.params;
    const orden = await OrdenTrabajo.findByPk(idOrden, {
      include: [
        {
          model: Muestra,
          attributes: ["idTipoMuestra", "Fecha_Recepcion", "estado"],
          include: {
            model: TiposMuestra,
            as: "TipoMuestra", // Especifica el alias aquí
            attributes: ["tipoDeMuestra"], // Trae el campo que necesitas
          },
        },
        {
          model: OrdenesExamen,
          include: {
            model: Examen,
            attributes: ["nombre_examen", "id_examen"],
          },
        },
      ],
    });

    if (!orden) {
      return res.status(404).send("Orden no encontrada.");
    }
    const paciente = await Paciente.findByPk(orden.id_Paciente, {
      attributes: ["nombre", "apellido"],
    });

    if (!paciente) {
      return res.status(404).send("Paciente no encontrado.");
    }
    const examenes = await Examen.findAll({
      include: {
        model: TiposMuestra,
        as: "tipoMuestra",
        attributes: ["tipoDeMuestra"],
      },
    });

    res.render("crearModificarOrden", { orden, examenes, paciente });
  } catch (error) {
    console.error("Error al obtener la orden:", error);
    res.status(500).send("Error al obtener la orden.");
  }
});
router.post("/crear-modificar-orden/:idOrden", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const {
      estado,
      examenesSelectedIds,
      examenesRemovedIds, // IDs de exámenes eliminados
      id_paciente,
      dni_paciente,
      tipos_muestra, // Este campo debe ser un array
    } = req.body;

    const usuarioId = user.dataValues.id_Usuario;

    // Validaciones
    if (!id_paciente || !dni_paciente) {
      return res.status(400).send("Paciente no seleccionado.");
    }

    if (!examenesSelectedIds || examenesSelectedIds.trim() === "") {
      return res.status(400).send("Debe seleccionar al menos un examen.");
    }

    const examenesSelectedIdsArray = examenesSelectedIds
      .split(",")
      .map(Number)
      .filter(Boolean);
    const examenesRemovedIdsArray = examenesRemovedIds
      ? examenesRemovedIds.split(",").map(Number).filter(Boolean)
      : [];

    // Buscar la orden existente
    const orden = await OrdenTrabajo.findByPk(req.params.idOrden);
    if (!orden) {
      return res.status(404).send("Orden no encontrada.");
    }

    // Actualizar los datos básicos de la orden
    orden.estado = estado;
    orden.dni = dni_paciente;
    orden.Fecha_Entrega = sumarDias(
      new Date(),
      await Examen.max("tiempoDemora", {
        where: { id_examen: examenesSelectedIdsArray },
      })
    );
    await orden.save();

    // Manejar eliminación de exámenes y sus muestras asociadas
    if (examenesRemovedIdsArray.length > 0) {
      for (const examenId of examenesRemovedIdsArray) {
        // Eliminar el examen de la relación OrdenesExamenes
        await OrdenesExamenes.destroy({
          where: { id_Orden: orden.id_Orden, id_examen: examenId },
        });

        // Verificar si la muestra asociada ya no es necesaria
        const examen = await Examen.findByPk(examenId, {
          include: { model: TiposMuestra, as: "tipoMuestra" },
        });

        if (examen && examen.tipoMuestra) {
          const tipoDeMuestra = examen.tipoMuestra.tipoDeMuestra;

          // Contar si quedan exámenes asociados a esta muestra
          const remainingExams = await OrdenesExamenes.count({
            where: { id_Orden: orden.id_Orden },
            include: [
              {
                model: Examen,
                as: "Examen", // Alias correcto para Examen
                include: {
                  model: TiposMuestra,
                  as: "tipoMuestra", // Alias correcto para TiposMuestra
                  where: { tipoDeMuestra },
                },
              },
            ],
          });

          if (remainingExams === 0) {
            // Eliminar la muestra si ya no es necesaria
            await Muestra.destroy({
              where: {
                id_Orden: orden.id_Orden,
                idTipoMuestra: examen.tipoMuestra.idTipoMuestra,
              },
            });
          }
        }
      }
    }

    // Actualizar o crear exámenes asociados
    for (const examenId of examenesSelectedIdsArray) {
      const examen = await Examen.findByPk(examenId, {
        include: { model: TiposMuestra, as: "tipoMuestra" },
      });

      if (!examen) continue;

      const [ordenExamen] = await OrdenesExamenes.findOrCreate({
        where: { id_Orden: orden.id_Orden, id_examen: examenId },
      });

      // Actualizar información del examen si aplica
      await ordenExamen.save();

      // Asociar los tipos de muestra requeridos por el examen
      if (examen.tipoMuestra) {
        const tipoMuestra = await TiposMuestra.findOrCreate({
          where: { tipoDeMuestra: examen.tipoMuestra.tipoDeMuestra },
        });

        const idTipoMuestra = tipoMuestra[0].idTipoMuestra;

        const [muestra] = await Muestra.findOrCreate({
          where: { id_Orden: orden.id_Orden, idTipoMuestra },
          defaults: {
            id_Paciente: id_paciente,
            Fecha_Recepcion: new Date(),
            estado: "pendiente",
          },
        });

        // Actualizar información de la muestra si aplica
        await muestra.save();
      }
    }

    // Manejar tipos de muestra seleccionados manualmente
    if (tipos_muestra) {
      const tiposMuestraArray = Array.isArray(tipos_muestra)
        ? tipos_muestra
        : [tipos_muestra];

      for (const tipoMuestra of tiposMuestraArray) {
        const idTipoMuestra = await obtenerIdTipoMuestra(tipoMuestra.trim());
        if (!idTipoMuestra) continue;

        const [muestra] = await Muestra.findOrCreate({
          where: { id_Orden: orden.id_Orden, idTipoMuestra },
          defaults: {
            id_Paciente: id_paciente,
            Fecha_Recepcion: new Date(),
            estado: "pendiente",
          },
        });

        // Actualizar información de la muestra si aplica
        await muestra.save();
      }
    }

    // Registrar auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Modificación de Orden de Trabajo",
      `Actualización de la orden con ID: ${orden.id_Orden}`
    );

    // Redirigir según el rol del usuario
    const rolesRedirect = {
      tecnico: "/tecnico",
      recepcionista: "/recepcionista",
      bioquimico: "/bioquimico",
      admin: "/admin",
    };

    const userRole = req.user.rol;
    if (req.isAuthenticated() && rolesRedirect[userRole]) {
      res.redirect(
        `${rolesRedirect[userRole]}?success=Orden+actualizada+con+éxito`
      );
    } else {
      res.status(403).send("Acceso no autorizado");
    }
  } catch (error) {
    console.error("Error al procesar la actualización de la orden:", error);
    res.status(500).send("Error al procesar la actualización de la orden.");
  }
});

router.get("/buscar-paciente-dinamico", async (req, res) => {
  // Verifica la autenticación del usuario
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
      attributes: ["id_Paciente", "nombre", "apellido", "dni", "email"], // Sólo selecciona los campos necesarios
    });
    console.log(pacientes);

    res.json(pacientes);
  } catch (error) {
    console.error("Error al buscar pacientes:", error);
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

// Ruta para cancelar una orden
router.post("/cancelar-orden/:idOrden", async (req, res) => {
  // Verifica la autenticación del usuario
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
    req.flash("success", "Orden cancelada con éxito.");
    const rolesRedirect = {
      tecnico: "/tecnico",
      recepcionista: "/recepcionista",
      bioquimico: "/bioquimico",
      admin: "/admin",
    };

    const userRole = req.user.rol;
    if (req.isAuthenticated() && rolesRedirect[userRole]) {
      res.redirect(
        `${rolesRedirect[userRole]}?success=Orden+cancelada+con+éxito`
      );
    } else {
      res.status(403).send("Acceso no autorizado");
    }
  } catch (error) {
    console.error("Error al cancelar la orden:", error);
    res.status(500).send("Error al cancelar la orden.");
  }
});

// Ruta para obtener órdenes informadas
router.get("/ordenes/informadas", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  try {
    const ordenes = await OrdenTrabajo.findAll({
      where: { estado: "informada" },
      include: [
        {
          model: Paciente,
          attributes: ["nombre", "apellido", "dni"],
        },
        {
          model: Muestra,
          attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"],
        },
      ],
    });

    res.render("ordenesInformadas", { ordenes });
  } catch (error) {
    console.error("Error al obtener órdenes informadas:", error);
    res.status(500).send("Error al obtener órdenes informadas.");
  }
});
// Función para sumar días a una fecha
function sumarDias(fecha, dias) {
  const nuevaFecha = new Date(fecha);
  nuevaFecha.setDate(nuevaFecha.getDate() + dias);
  return nuevaFecha;
}

// Función para obtener el ID de tipo de muestra por su nombre
async function obtenerIdTipoMuestra(nombreTipoMuestra) {
  const tipoMuestra = await TiposMuestra.findOne({
    where: { tipoDeMuestra: nombreTipoMuestra },
  });
  return tipoMuestra ? tipoMuestra.idTipoMuestra : null;
}

module.exports = router;