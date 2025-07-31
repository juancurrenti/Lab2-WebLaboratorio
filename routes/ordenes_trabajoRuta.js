const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");


const { 
  sequelize, OrdenTrabajo, Muestra, Examen, Paciente, 
  OrdenesExamen, TiposMuestra, Resultado, Determinacion
} = require("../models");
const auditoriaController = require("./AuditoriaRuta");


async function actualizarEstadoOrden(idOrden, transaction = null) {
  try {
    const muestras = await Muestra.findAll({
      where: { id_Orden: idOrden },
      ...(transaction && { transaction }),
    });

    if (!muestras || muestras.length === 0) {
      console.log(`Orden ${idOrden} sin muestras. No se cambia el estado.`);
      return; 
    }

    const totalMuestras = muestras.length;
    const muestrasFinalizadas = muestras.filter((m) =>
      ["Pre-Informe", "Informada", "Validada"].includes(m.estado)
    ).length;
    
    const muestrasEnProceso = muestras.filter((m) =>
      ["ingresada", "analitica", "en proceso"].includes(m.estado.toLowerCase())
    ).length;

    const muestrasPendientes = muestras.filter(m => 
      m.estado.toLowerCase() === 'pendiente'
    ).length;

    let nuevoEstadoOrden = "Preanalitica";

    if (muestrasPendientes === totalMuestras) {
        nuevoEstadoOrden = "Preanalitica";
    } else if (muestrasFinalizadas === totalMuestras) {

      nuevoEstadoOrden = "Para Validar"; 
    } else if (muestrasEnProceso > 0) { 
      nuevoEstadoOrden = "Analitica";
    }


    const ordenActual = await OrdenTrabajo.findByPk(idOrden, { attributes: ['estado'], transaction });
    if (ordenActual && ordenActual.estado !== nuevoEstadoOrden) {
        await OrdenTrabajo.update(
          { estado: nuevoEstadoOrden },
          {
            where: { id_Orden: idOrden },
            ...(transaction && { transaction }),
          }
        );
        console.log(`Estado de la orden ${idOrden} actualizado a: ${nuevoEstadoOrden}`);
    }

  } catch (error) {
    console.error(`Error al actualizar el estado de la orden ${idOrden}:`, error);
  }
}




function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}
async function obtenerIdTipoMuestra(nombreTipoMuestra) {
  try {
    const tipoMuestra = await TiposMuestra.findOne({
      where: { tipoDeMuestra: nombreTipoMuestra },
    });
    return tipoMuestra ? tipoMuestra.idTipoMuestra : null;
  } catch (error) {
    console.error(
      `Error al obtener ID para tipo de muestra "${nombreTipoMuestra}":`,
      error
    );
    return null;
  }
}
router.get("/ordenes", (req, res) => {
  res.render("buscarPacientesOrdenes", { pageTitle: 'Buscar Órdenes' });
});

router.get("/ordenesAnalitica", async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const limit = 10;
        const offset = (page - 1) * limit;

        const { rows: ordenes, count: totalOrdenes } =
            await OrdenTrabajo.findAndCountAll({

                where: {
                    estado: { [Op.ne]: 'cancelada' }
                },
                limit,
                offset,
                include: {
                    model: Paciente,
                    as: 'paciente',
                    where: { estado: 'activo' },
                    required: true,
                    attributes: ["nombre", "apellido"],
                },
                order: [["Fecha_Creacion", "DESC"]],
            });

        const totalPages = Math.ceil(totalOrdenes / limit);
        res.render("muestrasOrden", {
            pageTitle: 'Órdenes de Trabajo',
            ordenes,
            currentPage: parseInt(page, 10),
            totalPages,
        });
    } catch (error) {
        console.error("Error al obtener órdenes de trabajo:", error);
        res.status(500).send("Error al cargar las órdenes de trabajo.");
    }
});


router.get("/generacion-orden/:dni?", async (req, res) => {
  try {
    const { dni } = req.params;

    const examenes = await Examen.findAll({
      where: { estado: 1 },
      include: {
        model: TiposMuestra,
        as: "tipoMuestra",
        attributes: ["idTipoMuestra", "tipoDeMuestra"],
      },
    });


    const pacientes = await Paciente.findAll({
      where: { estado: 'activo' },
      attributes: ["id_paciente", "nombre", "apellido", "dni"],
    });

    let pacienteSeleccionado = null;
    if (dni) {
      pacienteSeleccionado = await Paciente.findOne({
         where: { dni, estado: 'activo' },
        attributes: ["id_paciente", "nombre", "apellido", "dni"],
      });
    }

    res.render("generarOrden", {
      pageTitle: 'Generar Nueva Orden',
      examenes,
      pacientes,
      pacienteSeleccionado,
    });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).send("Error al cargar la página de generación de orden.");
  }
});


router.post("/generacion-orden", async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id_paciente, examenesSelectedIds, ...rest } = req.body;
    

    const usuarioId = req.session.usuario.id;
    const rolEmpleado = req.session.usuario.rolEmpleado;

    if (!id_paciente) {
      return res.status(400).send("Se debe seleccionar un paciente.");
    }
    
    const paciente = await Paciente.findByPk(id_paciente, { transaction });
    if (!paciente) {
      await transaction.rollback();
      return res.status(404).send("Paciente no encontrado.");
    }

  

    let fechaEntrega = sumarDias(new Date(), 1);
    if (examenesSelectedIds && examenesSelectedIds.trim() !== '') {
      const examenesIdsArray = examenesSelectedIds.split(",").map(id => parseInt(id)).filter(Boolean);
      if (examenesIdsArray.length > 0) {
        const tiempoMaximoDemora = await Examen.max("tiempoDemora", {
          where: { id_examen: examenesIdsArray },
          transaction,
        });
        if(tiempoMaximoDemora) {
          fechaEntrega = sumarDias(new Date(), tiempoMaximoDemora);
        }
      }
    }

    const nuevaOrden = await OrdenTrabajo.create({
      id_Paciente: id_paciente,
      dni: paciente.dni,
      Fecha_Creacion: new Date(),
      Fecha_Entrega: fechaEntrega,
      estado: "Preanalitica",
      diagnostico: req.body.diagnostico
    }, { transaction });

    if (examenesSelectedIds && examenesSelectedIds.trim() !== '') {
      const examenesIds = examenesSelectedIds.split(',').map(Number).filter(Boolean);
      for (const examenId of examenesIds) {
        await OrdenesExamen.create({
          id_Orden: nuevaOrden.id_Orden,
          id_examen: examenId,
        }, { transaction });
      }
      const examenesRequeridos = await Examen.findAll({
        where: { id_examen: { [Op.in]: examenesIds } },
        include: [{ model: TiposMuestra, as: 'tipoMuestra' }],
        transaction
      });
      const tiposMuestraUnicos = new Map();
      examenesRequeridos.forEach(examen => {
        if (examen.tipoMuestra) {
          tiposMuestraUnicos.set(examen.tipoMuestra.idTipoMuestra, examen.tipoMuestra.tipoDeMuestra);
        }
      });
      for (const [idTipoMuestra, nombreTipoMuestra] of tiposMuestraUnicos.entries()) {
        const estadoKey = `estado_muestra_${nombreTipoMuestra}`;
        const estado = rest[estadoKey] === 'ingresada' ? 'ingresada' : 'pendiente';
        await Muestra.create({
            id_Orden: nuevaOrden.id_Orden,
            id_Paciente: id_paciente,
            idTipoMuestra: idTipoMuestra,
            Fecha_Recepcion: new Date(),
            estado: estado,
        }, { transaction });
      }
    }
    
    await actualizarEstadoOrden(nuevaOrden.id_Orden, transaction);

    await auditoriaController.registrar(
      usuarioId,
      "Generación de Orden de Trabajo",
      `Generación de una nueva orden con ID: ${nuevaOrden.id_Orden}`,
      { transaction }
    );

    await transaction.commit();
    req.flash('success', "Orden generada con éxito");
    res.redirect(`/${rolEmpleado}`);

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al procesar el formulario de generación:", error);
    res.status(500).send("Error al procesar el formulario.");
  }
});


router.get("/muestras/ver/:id_Orden", async (req, res) => {
  const { id_Orden } = req.params;

  try {
    const muestras = await Muestra.findAll({
      where: { id_Orden },
      include: [
        {
          model: TiposMuestra,

          as: "tipoMuestra",
          attributes: ["tipoDeMuestra"],
        },
      ],
    });
    
    if (!muestras || muestras.length === 0) {
      return res.render("no-muestras", { pageTitle: 'Sin Muestras', id_Orden });
    }

    res.render("ver-muestras", { pageTitle: `Muestras de la Orden N° ${id_Orden}`, muestras, id_Orden });
  } catch (error) {
    console.error("Error al obtener las muestras:", error);
    res.status(500).send("Ocurrió un error al obtener las muestras.");
  }
});


router.post("/muestras/preinformar/:id_Orden", async (req, res) => {
  const { id_Orden } = req.params;
  const usuarioId = req.user.dataValues.id_Usuario;
  const pageTitle = `Muestras de la Orden N° ${id_Orden}`;
  try {

    const muestrasPendientes = await Muestra.count({
      where: {
        id_Orden,
        estado: { [Op.ne]: "Pre-Informe" },
      },
    });

    if (muestrasPendientes === 0) {

      return res.render("ver-muestras", {
        pageTitle,
        muestras: await Muestra.findAll({
          where: { id_Orden },
          include: [
            {
              model: TiposMuestra,
              as: "TipoMuestra",
              attributes: ["tipoDeMuestra"],
            },
          ],
        }),
        id_Orden,
        success: null,
        error: "Todas las muestras ya están en estado Pre-Informe.",
      });
    }


    const [updatedRows] = await Muestra.update(
      { estado: "Pre-Informe" },
      { where: { id_Orden, estado: { [Op.ne]: "Pre-Informe" } } }
    );

    if (updatedRows > 0) {

      await auditoriaController.registrar(
        usuarioId,
        "Actualizar Muestras a Pre-Informe",
        `Se actualizaron ${updatedRows} muestras de la orden ${id_Orden} a estado Pre-Informe.`
      );


      await actualizarEstadoOrden(id_Orden);


      return res.render("ver-muestras", {
        pageTitle,
        muestras: await Muestra.findAll({
          where: { id_Orden },
          include: [
            {
              model: TiposMuestra,
              as: "TipoMuestra",
              attributes: ["tipoDeMuestra"],
            },
          ],
        }),
        id_Orden,
        success: "Muestras actualizadas con éxito.",
        error: null,
      });
    }


    return res.render("ver-muestras", {
      pageTitle,
      muestras: await Muestra.findAll({
        where: { id_Orden },
        include: [
          {
            model: TiposMuestra,
            as: "TipoMuestra",
            attributes: ["tipoDeMuestra"],
          },
        ],
      }),
      id_Orden,
      success: null,
      error: "No se pudieron actualizar las muestras.",
    });
  } catch (error) {
    console.error("Error al actualizar el estado de las muestras:", error);
    res
      .status(500)
      .send("Ocurrió un error al actualizar el estado de las muestras.");
  }
});
router.post("/muestras/cambiar-estado/:idMuestra", async (req, res) => {
  const { idMuestra } = req.params;
  const { nuevoEstado } = req.body;

  try {
    const muestra = await Muestra.findByPk(idMuestra);
    if (!muestra) {
      return res.status(404).json({ error: "Muestra no encontrada." });
    }

    muestra.estado = nuevoEstado;
    await muestra.save();


    await actualizarEstadoOrden(muestra.id_Orden);

    res.json({
      success: true,
      message: `Estado de la muestra ${idMuestra} actualizado a "${nuevoEstado}".`,
    });
  } catch (error) {
    console.error("Error al cambiar el estado de la muestra:", error);
    res
      .status(500)
      .json({ error: "Error al cambiar el estado de la muestra." });
  }
});


router.get("/registrarResultados/:id_Orden", async (req, res) => {
  const idOrden = req.params.id_Orden;
  const { origen, modificar } = req.query;

  try {
    const resultados = await sequelize.query(
      `
      SELECT 
          ot.id_Orden AS OrdenID,
          ot.Fecha_Creacion AS FechaCreacion,
          ot.Fecha_Entrega AS FechaEntrega,
          p.id_Paciente AS PacienteID,
          p.Nombre AS NombrePaciente,
          p.Apellido AS ApellidoPaciente,
          p.Fecha_Nacimiento AS FechaNacimiento,
          p.genero AS SexoPaciente,
          TIMESTAMPDIFF(YEAR, p.Fecha_Nacimiento, CURDATE()) AS EdadPaciente,
          e.id_examen AS ExamenID,
          e.nombre_examen AS NombreExamen,
          e.descripcion AS DescripcionExamen,
          d.id_Determinacion AS DeterminacionID,
          d.Nombre_Determinacion AS NombreDeterminacion,
          um.nombreUnidadMedida AS UnidadMedidaDeterminacion,
          vr.id_ValorReferencia AS ValorReferenciaID,
          vr.Valor_Referencia_Minimo AS ValorReferenciaMinimo,
          vr.Valor_Referencia_Maximo AS ValorReferenciaMaximo,
          vr.Sexo AS SexoValorReferencia,
          vr.Edad_Minima AS EdadMinimaValorReferencia,
          vr.Edad_Maxima AS EdadMaximaValorReferencia,
          vr.Valor_Esperado AS ValorEsperado,
          r.Valor AS ResultadoValor
      FROM 
          ordenes_trabajo ot
      JOIN 
          ordenes_examenes oe ON ot.id_Orden = oe.id_Orden
      JOIN 
          examen e ON oe.id_examen = e.id_examen
      JOIN 
          determinaciones d ON e.id_examen = d.id_Examen
      JOIN 
          pacientes p ON ot.id_Paciente = p.id_Paciente
      JOIN
          valoresreferencia vr ON d.id_Determinacion = vr.id_Determinacion 
          AND (vr.Sexo = CASE 
                          WHEN p.genero = 'masculino' THEN 'M'
                          WHEN p.genero = 'femenino' THEN 'F'
                      END
                OR vr.Sexo = 'A')
          AND TIMESTAMPDIFF(YEAR, p.Fecha_Nacimiento, CURDATE()) BETWEEN vr.Edad_Minima AND vr.Edad_Maxima
          AND vr.estado = 1
      LEFT JOIN 
          unidadmedida um ON d.Unidad_Medida = um.id_UnidadMedida
      LEFT JOIN 
          resultados r ON r.id_Orden = ot.id_Orden AND r.id_Determinacion = d.id_Determinacion
      WHERE 
          ot.id_Orden = :idOrden;
      `,
      {
        replacements: { idOrden },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.render("registrarResultados", {pageTitle: `Registrar Resultados - Orden N° ${idOrden}`, orden: resultados, origen: origen, modificar: modificar === 'true' });
  } catch (error) {
    console.error("Error ejecutando la consulta:", error);
    res.status(500).send("Hubo un problema al cargar los resultados.");
  }
});

const MARGEN_VALIDACION = 0.50;

router.post("/registrarResultados", async (req, res) => {
    const { idOrden, origen, ...campos } = req.body;
    const usuarioId = req.session.usuario.id;
    const rolEmpleado = req.session.usuario.rolEmpleado;
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const unidadesCualitativas = ['Positivo / Negativo', 'Reactivo / No Reactivo', 'Ausencia / Presencia'];

        for (const key in campos) {
            if (key.startsWith("resultado_")) {
                const valorStr = campos[key];
                if (valorStr === null || valorStr.trim() === '') {
                    continue;
                }

                const idDeterminacion = key.split("_")[1];
                const unidad = campos[`unidad_${idDeterminacion}`];
                let valor;
                let errorValidacion = null;


                if (unidadesCualitativas.includes(unidad)) {

                    const opcionesValidas = unidad.split(' / ');
                    if (opcionesValidas.includes(valorStr)) {
                        valor = valorStr;
                    } else {
                        errorValidacion = `El valor "${valorStr}" no es válido para la unidad "${unidad}".`;
                    }
                } else {

                    valor = parseFloat(valorStr);
                    if (isNaN(valor)) {
                        errorValidacion = `El valor "${valorStr}" no es un número válido.`;
                    } else {
                      const refMaxStr = campos[`ref_max_${idDeterminacion}`];
                      if (refMaxStr !== undefined && refMaxStr !== null) {
                        const refMax = parseFloat(refMaxStr);
                        const limiteSuperior = refMax * (1 + MARGEN_VALIDACION);
                        if (valor < 0 || valor > limiteSuperior) {
                          errorValidacion = `El valor ingresado "${valorStr}" no es válido. Debe ser un número entre 0 y ${limiteSuperior.toFixed(2)}.`;
                        }
                      } else if (valor < 0) {
                        errorValidacion = `El valor ingresado "${valorStr}" no es válido. Debe ser un número positivo.`;
                      }
                    }
                }

                if (errorValidacion) {
                    await transaction.rollback();
                    req.flash('error', errorValidacion);
                    return res.redirect(`/orden/registrarResultados/${idOrden}${origen ? `?origen=${origen}` : ''}`);
                }

                
                const [resultadoExistente] = await sequelize.query(
                    `SELECT id_Resultado FROM resultados WHERE id_Orden = :idOrden AND id_Determinacion = :idDeterminacion`,
                    { replacements: { idOrden, idDeterminacion }, type: sequelize.QueryTypes.SELECT, transaction }
                );

                if (resultadoExistente) {
                    await sequelize.query(
                        `UPDATE resultados SET Valor = :valor, Unidad = :unidad, Estado = 'Para Validar' WHERE id_Resultado = :idResultado`,
                        { replacements: { valor, unidad, idResultado: resultadoExistente.id_Resultado }, type: sequelize.QueryTypes.UPDATE, transaction }
                    );
                    await auditoriaController.registrar(usuarioId, "Actualizar Resultado", `Resultado actualizado para la determinación ${idDeterminacion} de la orden ${idOrden}`);
                } else {
                    const determinacion = await Determinacion.findByPk(idDeterminacion, {
                        include: [{ model: Examen, as: 'examen', include: [{ model: TiposMuestra, as: 'tipoMuestra' }] }],
                        transaction
                    });

                    if (!determinacion || !determinacion.examen || !determinacion.examen.tipoMuestra) {
                        await transaction.rollback();
                        return res.status(500).send(`Error: No se pudo encontrar el tipo de muestra para la determinación ID ${idDeterminacion}.`);
                    }

                    const muestra = await Muestra.findOne({
                        where: {
                            id_Orden: idOrden,
                            idTipoMuestra: determinacion.examen.tipoMuestra.idTipoMuestra
                        },
                        transaction
                    });

                    if (!muestra) {
                        await transaction.rollback();
                        return res.status(500).send(`Error: No se encontró una muestra del tipo "${determinacion.examen.tipoMuestra.tipoDeMuestra}" para la orden ID ${idOrden}.`);
                    }
                    
                    const idMuestra = muestra.id_Muestra;

                    await sequelize.query(
                        `INSERT INTO resultados (id_Orden, id_Determinacion, id_Muestra, Valor, Unidad, Estado) VALUES (:idOrden, :idDeterminacion, :idMuestra, :valor, :unidad, 'Para Validar')`,
                        { replacements: { idOrden, idDeterminacion, idMuestra, valor, unidad }, type: sequelize.QueryTypes.INSERT, transaction }
                    );
                    await auditoriaController.registrar(usuarioId, "Crear Resultado", `Nuevo resultado creado para la determinación ${idDeterminacion} de la orden ${idOrden}`);
                }
            }
        }

        await sequelize.query(
            `UPDATE ordenes_trabajo SET estado = 'Para Validar' WHERE id_Orden = :idOrden`,
            { replacements: { idOrden }, type: sequelize.QueryTypes.UPDATE, transaction }
        );
        await auditoriaController.registrar(usuarioId, "Actualizar Estado de Orden", `Estado de la orden ${idOrden} actualizado a 'Para Validar'`);
        
        await transaction.commit();
        req.flash('success', "Resultados guardados correctamente");

        if (origen === 'validar') {
            res.redirect(`/orden/validarResultados/${idOrden}`);
        } else {
            res.redirect(`/${rolEmpleado}`);
        }

    } catch (error) {
        console.error("Error al guardar los resultados:", error);
        if (transaction) await transaction.rollback();
        req.flash('error', `Ocurrió un error al guardar los resultados: ${error.message}`);
        res.redirect(`/orden/registrarResultados/${idOrden}${origen ? `?origen=${origen}` : ''}`);
    }
});


router.get("/muestras/imprimir/:id_Muestra", async (req, res) => {
  const { id_Muestra } = req.params;

  try {
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const muestra = await Muestra.findOne({
      where: { id_Muestra },
      include: [
        {
          model: TiposMuestra,
          as: "tipoMuestra",
          attributes: ["tipoDeMuestra"],
        },
        {
          model: Paciente,
          as: "paciente",
          attributes: ["nombre", "apellido", "dni"],
        },
      ],
    });

    if (!muestra) {
      return res.status(404).send("Muestra no encontrada.");
    }
    if (muestra.estado === 'pendiente') {
      return res.status(403).send("Error: No se puede imprimir la etiqueta de una muestra que no ha sido recibida.");
    }


    const filePath = path.join(
      tempDir,
      `etiqueta-orden-${muestra.id_Orden}-paciente-${muestra.paciente.nombre.replace(/\s+/g, "_")}-${muestra.paciente.apellido.replace(/\s+/g, "_")}.pdf`
    );

    const doc = new PDFDocument({
      size: [113.4, 56.7],
      margins: { top: 5, left: 5, bottom: 5, right: 5 },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const fontSize = 4.5;
    const lineHeight = fontSize + 2;
    let y = 5;

    doc.fontSize(fontSize);
    doc.text(`Nº de Orden: ${muestra.id_Orden}`, 5, y);
    y += lineHeight;
    doc.text(`Código Persona: ${muestra.id_Paciente}`, 5, y);
    y += lineHeight;
    doc.text(`Paciente: ${muestra.paciente.nombre} ${muestra.paciente.apellido}`, 5, y);
    y += lineHeight;
    doc.text(`Documento: ${muestra.paciente.dni}`, 5, y);
    y += lineHeight;
    doc.text(`Tipo de Muestra: ${muestra.tipoMuestra.tipoDeMuestra}`, 5, y);
    y += lineHeight;
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 5, y);
    y += lineHeight;
    doc.text(`Hora: ${new Date().toLocaleTimeString('es-AR')}`, 5, y);
    
    doc.end();

    stream.on("finish", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=etiqueta-${id_Muestra}.pdf`);
      fs.createReadStream(filePath).pipe(res);
    });

    stream.on("error", (err) => {
      console.error("Error al escribir el archivo:", err);
      res.status(500).send("Ocurrió un error al generar la etiqueta.");
    });

  } catch (error) {
    console.error("Error al generar la etiqueta:", error);
    res.status(500).send("Ocurrió un error al generar la etiqueta.");
  }
});

router.post("/muestras/marcar-recibida/:idMuestra", async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { idMuestra } = req.params;
        const muestra = await Muestra.findByPk(idMuestra, { transaction });

        if (!muestra) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Muestra no encontrada." });
        }

        muestra.estado = 'ingresada';
        await muestra.save({ transaction });
        

        await actualizarEstadoOrden(muestra.id_Orden, transaction);

        await transaction.commit();
        res.json({ success: true, message: "Muestra marcada como recibida." });
        
    } catch (error) {
        if(transaction) await transaction.rollback();
        console.error("Error al marcar muestra como recibida:", error);
        res.status(500).json({ success: false, message: "Error en el servidor." });
    }
});

router.get("/pendientesAValidar", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;

    const { rows: ordenes, count: totalOrdenes } =
      await OrdenTrabajo.findAndCountAll({
        limit,
        offset,
        where: { estado: "Para Validar" },
        include: {
          model: Paciente,
          as: 'paciente',
          where: { estado: 'activo' },
          attributes: ["nombre", "apellido"],
          required: true,
        },
        order: [["Fecha_Creacion", "DESC"]],
      });


    const ordenesConFormato = ordenes.map((orden) => {

      const ordenData = orden.toJSON(); 
      return {
        ...ordenData,

        Fecha_Creacion: formatDate(ordenData.Fecha_Creacion),
        Fecha_Entrega: formatDate(ordenData.Fecha_Entrega),
      };
    });


    const totalPages = Math.ceil(totalOrdenes / limit);

    res.render("pendientesAValidar", {
      pageTitle: 'Órdenes Pendientes de Validación',

      ordenes: ordenesConFormato, 
      currentPage: parseInt(page, 10),
      totalPages,
    });
  } catch (error) {
    console.error("Error al obtener órdenes pendientes a validar:", error);
    res.status(500).send("Error al cargar las órdenes pendientes a validar.");
  }
});

router.get("/validarResultados/:id_Orden", async (req, res) => {
  const idOrden = req.params.id_Orden;

  try {
    const resultados = await sequelize.query(
      `
      SELECT 
          ot.id_Orden AS OrdenID,
          ot.Fecha_Creacion AS FechaCreacion,
          ot.Fecha_Entrega AS FechaEntrega,
          p.id_Paciente AS PacienteID,
          p.Nombre AS NombrePaciente,
          p.Apellido AS ApellidoPaciente,
          p.Fecha_Nacimiento AS FechaNacimiento,
          p.genero AS SexoPaciente,
          TIMESTAMPDIFF(YEAR, p.Fecha_Nacimiento, CURDATE()) AS EdadPaciente,
          e.id_examen AS ExamenID,
          e.nombre_examen AS NombreExamen,
          e.descripcion AS DescripcionExamen,
          d.id_Determinacion AS DeterminacionID,
          d.Nombre_Determinacion AS NombreDeterminacion,
          um.nombreUnidadMedida AS UnidadMedidaDeterminacion,
          vr.id_ValorReferencia AS ValorReferenciaID,
          vr.Valor_Referencia_Minimo AS ValorReferenciaMinimo,
          vr.Valor_Referencia_Maximo AS ValorReferenciaMaximo,
          vr.Sexo AS SexoValorReferencia,
          vr.Edad_Minima AS EdadMinimaValorReferencia,
          vr.Edad_Maxima AS EdadMaximaValorReferencia,
          vr.Valor_Esperado AS ValorEsperado,
          r.Valor AS ResultadoValor
      FROM 
          ordenes_trabajo ot
      JOIN 
          ordenes_examenes oe ON ot.id_Orden = oe.id_Orden
      JOIN 
          examen e ON oe.id_examen = e.id_examen
      JOIN 
          determinaciones d ON e.id_examen = d.id_Examen
      JOIN 
          pacientes p ON ot.id_Paciente = p.id_Paciente
      JOIN 
          valoresreferencia vr ON d.id_Determinacion = vr.id_Determinacion 
          AND (vr.Sexo = CASE 
                          WHEN p.genero = 'masculino' THEN 'M'
                          WHEN p.genero = 'femenino' THEN 'F'
                      END
                OR vr.Sexo = 'A')
          AND TIMESTAMPDIFF(YEAR, p.Fecha_Nacimiento, CURDATE()) BETWEEN vr.Edad_Minima AND vr.Edad_Maxima
          AND vr.estado = 1
      JOIN 
          unidadmedida um ON d.Unidad_Medida = um.id_UnidadMedida
      LEFT JOIN 
          resultados r ON r.id_Orden = ot.id_Orden AND r.id_Determinacion = d.id_Determinacion
      WHERE 
          ot.id_Orden = :idOrden;
      `,
      {
        replacements: { idOrden },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.render("validarResultados", {pageTitle: `Validar Resultados - Orden N° ${idOrden}`, orden: resultados });
  } catch (error) {
    console.error("Error ejecutando la consulta:", error);
    res.status(500).send("Hubo un problema al cargar los resultados.");
  }
});

router.post("/confirmarValidacion", async (req, res) => {
  const { idOrden } = req.body;
  const rol = res.locals.rol;
  let transaction;

  try {

    transaction = await sequelize.transaction();


    await sequelize.query(
      `
      UPDATE resultados
      SET Estado = 'Informada'
      WHERE id_Orden = :idOrden
      `,
      {
        replacements: { idOrden },
        type: sequelize.QueryTypes.UPDATE,
        transaction,
      }
    );


    await sequelize.query(
      `
      UPDATE ordenes_trabajo
      SET estado = 'Informada'
      WHERE id_Orden = :idOrden
      `,
      {
        replacements: { idOrden },
        type: sequelize.QueryTypes.UPDATE,
        transaction,
      }
    );



    await transaction.commit();


    res.render(`${rol}`, {pageTitle: `Panel de ${rol.charAt(0).toUpperCase() + rol.slice(1)}`, success: "Validacion confirmada" });
  } catch (error) {
    console.error("Error al confirmar validación:", error);


    if (transaction) await transaction.rollback();

    res
      .status(500)
      .send("Error al confirmar la validación. Por favor, intenta nuevamente.");
  }
});

router.get("/ordenesInformadas", async (req, res) => {
  try {

    const ordenesInformadas = await sequelize.query(
      `
      SELECT 
          ot.id_Orden AS OrdenID,
          ot.Fecha_Creacion AS FechaCreacion,
          ot.Fecha_Entrega AS FechaEntrega,
          p.Nombre AS NombrePaciente,
          p.Apellido AS ApellidoPaciente,
          p.dni AS DNIPaciente
      FROM 
          ordenes_trabajo ot
      JOIN 
          pacientes p ON ot.id_Paciente = p.id_Paciente
      WHERE 
          ot.estado = 'Informada'
          AND p.estado = 'activo'
      ORDER BY 
          ot.Fecha_Creacion DESC;
      `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );


    const ordenesConFormato = ordenesInformadas.map((orden) => ({
      ...orden,
      FechaCreacion: formatDate(orden.FechaCreacion),
      FechaEntrega: formatDate(orden.FechaEntrega),
    }));


    res.render("ordenesInformadas", {pageTitle: 'Historial de Órdenes Informadas', ordenes: ordenesConFormato });
  } catch (error) {
    console.error("Error al obtener órdenes informadas:", error);
    res.status(500).send("Hubo un problema al cargar las órdenes informadas.");
  }
});
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
};


router.post("/actualizar-orden/:idOrden", async (req, res) => {
  const { idOrden } = req.params;
  const usuarioId = req.session.usuario.id;
  const transaction = await sequelize.transaction();

  try {

    const { diagnostico, examenesSelectedIds, ...estadosMuestras } = req.body;

    const orden = await OrdenTrabajo.findByPk(idOrden, { transaction });
    if (!orden) {
      await transaction.rollback();
      return res.status(404).send("Orden no encontrada.");
    }
    

    await orden.update({ diagnostico }, { transaction });



    await OrdenesExamen.destroy({ where: { id_Orden: idOrden }, transaction });
    await Muestra.destroy({ where: { id_Orden: idOrden }, transaction });
    
    if (examenesSelectedIds && examenesSelectedIds.trim() !== '') {
      const examenesIds = examenesSelectedIds.split(',').map(Number).filter(Boolean);

      for (const examenId of examenesIds) {
        await OrdenesExamen.create({
          id_Orden: idOrden,
          id_examen: examenId,
        }, { transaction });
      }

      const examenesRequeridos = await Examen.findAll({
        where: { id_examen: { [Op.in]: examenesIds } },
        include: [{ model: TiposMuestra, as: 'tipoMuestra' }],
        transaction
      });

      const tiposMuestraUnicos = new Map();
      examenesRequeridos.forEach(examen => {
        if (examen.tipoMuestra) {
          tiposMuestraUnicos.set(examen.tipoMuestra.idTipoMuestra, examen.tipoMuestra.tipoDeMuestra);
        }
      });
      
      for (const [idTipoMuestra, nombreTipoMuestra] of tiposMuestraUnicos.entries()) {
        const estadoKey = `estado_muestra_${nombreTipoMuestra}`;
        const estado = estadosMuestras[estadoKey] === 'ingresada' ? 'ingresada' : 'pendiente';

        await Muestra.create({
            id_Orden: idOrden,
            id_Paciente: orden.id_Paciente,
            idTipoMuestra: idTipoMuestra,
            Fecha_Recepcion: new Date(),
            estado: estado,
        }, { transaction });
      }
    }
    
    await actualizarEstadoOrden(idOrden, transaction);

    await auditoriaController.registrar(
      usuarioId,
      "Modificación de Orden de Trabajo",
      `Se modificó la orden con ID: ${idOrden}`,
      { transaction }
    );
    
    await transaction.commit();
    req.flash('success', `Orden #${idOrden} actualizada con éxito.`);
    res.redirect(`/buscarOrdenes/crear-modificar-orden/${idOrden}?success=Orden+${idOrden}+actualizada`);

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al actualizar la orden:", error);
    res.status(500).send("Error al procesar la actualización de la orden.");
  }
});



module.exports = router;