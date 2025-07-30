const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { sequelize, OrdenTrabajo, Paciente, Muestra, Examen, OrdenesExamen, TiposMuestra } = require("../models");
const auditoriaController = require("./AuditoriaRuta");

router.get("/", (req, res) => {
  res.render("buscarPacientesOrdenes", { pageTitle: "Buscar Órdenes de Trabajo" });
});

router.post("/buscar-ordenes", async (req, res) => {

    const { idPaciente, page = 1 } = req.body;
    
    if (!idPaciente) {
        return res.status(400).json({ error: "ID de paciente no proporcionado." });
    }

    try {
        const limit = 4;
        const offset = (page - 1) * limit;


        const { count, rows: ordenes } = await OrdenTrabajo.findAndCountAll({
            where: { 
                id_Paciente: idPaciente,
                estado: { [Op.not]: "cancelada" } 
            },
            include: {
                model: Paciente,
                as: 'paciente',
                where: { estado: 'activo' },
                required: true,
                attributes: []
            },
            limit,
            offset,
            attributes: ["id_Orden", "Fecha_Creacion", "Fecha_Entrega", "estado", "diagnostico"],
            order: [['Fecha_Creacion', 'DESC']]
        });
        
        const totalPages = Math.ceil(count / limit);

        res.json({ ordenes, totalPages });
        
    } catch (error) {
        console.error("Error al buscar órdenes:", error); 
        res.status(500).json({ error: "Error al buscar las órdenes de trabajo en el servidor." });
    }
});
router.get("/detalles/:id_Orden", async (req, res) => {
  try {
    const { id_Orden } = req.params;
    const orden = await OrdenTrabajo.findByPk(id_Orden, {
      include: [
        { model: Paciente, as: 'paciente', attributes: ["nombre", "apellido", "dni"] },
        { model: Muestra, as: 'Muestras', attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"] },
      ],
    });

    if (!orden) return res.status(404).json({ error: "Orden no encontrada." });
    res.json(orden);
  } catch (error) {
    console.error("Error al obtener los detalles de la orden:", error);
    res.status(500).json({ error: "Error al obtener los detalles de la orden." });
  }
});

router.get("/crear-modificar-orden/:idOrden", async (req, res) => {
  try {
    const { idOrden } = req.params;
    const orden = await OrdenTrabajo.findByPk(idOrden, {
      include: [
        { 
          model: Muestra, 
          as: 'Muestras', 
          include: { 
            model: TiposMuestra, 
            as: "tipoMuestra"
          } 
        },
        { model: OrdenesExamen, as: 'OrdenesExamenes', include: { model: Examen, as: 'examen' } },
        { model: Paciente,
          where: { estado: 'activo' }, 
          as: 'paciente',
          required: true }
      ],
    });

    if (!orden) return res.status(404).send("Orden no encontrada.");
    
    const examenes = await Examen.findAll({ 
      include: { 
        model: TiposMuestra, 
        as: "tipoMuestra"
      } 
    });
    
    res.render("crearModificarOrden", {pageTitle: `Modificar Orden N° ${orden.id_Orden}`, orden, examenes, paciente: orden.paciente });
  } catch (error) {
    console.error("Error al obtener la orden:", error);
    res.status(500).send("Error al obtener la orden.");
  }
});


router.get("/buscar-paciente-dinamico", async (req, res) => {
  const { query } = req.query;
  try {
    const pacientes = await Paciente.findAll({
      where: {
        estado: 'activo',
        [Op.or]: [
          { nombre: { [Op.like]: `%${query}%` } },
          { apellido: { [Op.like]: `%${query}%` } },
          { dni: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id_paciente", "nombre", "apellido", "dni"],
    });
    res.json(pacientes);
  } catch (error) {
    console.error("Error al buscar pacientes:", error);
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

router.post("/cancelar-orden/:idOrden", async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { idOrden } = req.params;

        const { motivoCancelacion } = req.body; 
        const usuarioId = req.session.usuario.id;

        if (!motivoCancelacion || motivoCancelacion.trim() === '') {
            req.flash('error', 'Debe proporcionar un motivo para la cancelación.');
            return res.redirect(`/buscarOrdenes/crear-modificar-orden/${idOrden}`);
        }

        const orden = await OrdenTrabajo.findByPk(idOrden, { transaction });
        if (!orden) {
            await transaction.rollback();
            return res.status(404).send("Orden no encontrada.");
        }

        orden.estado = "cancelada";
        orden.descripcionCancelacion = motivoCancelacion;
        await orden.save({ transaction });

        await auditoriaController.registrar(
            usuarioId,
            "Cancelación de Orden",
            `Se canceló la orden ID: ${idOrden}. Motivo: ${motivoCancelacion}`,
            { transaction }
        );

        await transaction.commit();
        
        req.flash('success', 'Orden cancelada con éxito');
        res.redirect(`/buscarOrdenes`);

    } catch (error) {
        if(transaction) await transaction.rollback();
        console.error("Error al cancelar la orden:", error);
        req.flash('error', 'Ocurrió un error al cancelar la orden.');
        res.redirect(`/buscarOrdenes`);
    }
});

router.get("/ordenes/informadas", async (req, res) => {
  try {
    const ordenes = await OrdenTrabajo.findAll({
      where: { estado: "informada" },
      include: [
        { model: Paciente,
          as: 'paciente',
          attributes: ["nombre", "apellido", "dni"], 
          where: { estado: 'activo' },
          required: true
        },
          
        { model: Muestra, as: 'Muestras', attributes: ["Tipo_Muestra", "Fecha_Recepcion", "estado"] },
      ],
    });
    res.render("ordenesInformadas", { pageTitle: 'Órdenes Informadas', ordenes });
  } catch (error) {
    console.error("Error al obtener órdenes informadas:", error);
    res.status(500).send("Error al obtener órdenes informadas.");
  }
});

module.exports = router;