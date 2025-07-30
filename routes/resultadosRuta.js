const express = require("express");
const router = express.Router();

const { Muestra, Paciente, Examen, Determinacion, Resultado, TiposMuestra } = require("../models");
const auditoriaController = require("./AuditoriaRuta");


router.get("/mostrar/:id_orden", async (req, res) => {
  const id_orden = req.params.id_orden;
  try {
    const muestras = await Muestra.findAll({
      where: { id_Orden: id_orden },
      include: [{ model: Paciente, as: "paciente" }],
    });
    const title = `Muestras de la Orden N° ${id_orden}`;
    if (muestras.length > 0) {
      res.render("muestrasOrden", {pageTitle: title, id_orden, muestras });
    } else {
      res.render("muestrasOrden", {pageTitle: title, mensaje: "No se encontraron muestras para esta orden." });
    }
  } catch (error) {
    console.error("Error al buscar muestras:", error);
    res.status(500).json({ error: "Error al buscar muestras" });
  }
});


router.get("/:id_orden/generarPDFMuestra/:idMuestra", async (req, res) => {

     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  const idMuestra = req.params.idMuestra;

  try {
    const muestra = await Muestra.findByPk(idMuestra, {
      include: [{ model: Paciente, as: "Paciente" }],
    });

    if (!muestra) {
      return res.status(404).json({ mensaje: "Muestra no encontrada." });
    }

    const pdfDoc = new PDFDocument();


    pdfDoc.fontSize(12).text("Información de la Muestra\n\n");

    pdfDoc.font("Helvetica-Bold");
    pdfDoc.text(
      `Nombre del Paciente: ${muestra.Paciente.nombre} ${muestra.Paciente.apellido}\n`
    );
    pdfDoc.text(`Nro Muestra: ${muestra.id_Muestra}\n`);
    pdfDoc.text(`Nro Orden: ${muestra.id_Orden}\n`);
    pdfDoc.text(`Nro Paciente: ${muestra.id_Paciente}\n`);
    pdfDoc.text(`Tipo de Muestra: ${muestra.Tipo_Muestra}\n`);
    pdfDoc.text(
      `Fecha de Recepción: ${
        muestra.Fecha_Recepcion
          ? new Date(muestra.Fecha_Recepcion).toLocaleString()
          : ""
      }\n`
    );
    pdfDoc.text(`Estado: ${muestra.estado}\n`);


    pdfDoc.end();

    const pdfBytes = await new Promise((resolve, reject) => {
      const chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (error) => reject(error));
    });

    const pdfBase64 = pdfBytes.toString("base64");


    res.json({ pdfBase64 });
  } catch (error) {
    error("Error al obtener muestra para PDF:", error);
    res.status(500).json({ error: "Error al obtener muestra para PDF" });
  }
});

router.get("/mostrar/aniadirResultados/:id_muestra", async (req, res) => {
  const id_muestra = req.params.id_muestra;
  try {
    const muestra = await Muestra.findByPk(id_muestra);
    if (!muestra) return res.status(404).json({ mensaje: "Muestra no encontrada." });

    const tipoMuestra = await TiposMuestra.findByPk(muestra.idTipoMuestra);
    if (!tipoMuestra) return res.status(404).json({ mensaje: "Tipo de muestra no encontrado." });

    const examenes = await Examen.findAll({ where: { idTipoMuestra: tipoMuestra.idTipoMuestra } });
    const id_examenes = examenes.map((examen) => examen.id_examen);
    const determinaciones = await Determinacion.findAll({ where: { id_examen: id_examenes } });

    res.render("aniadirResultados", {pageTitle: `Añadir Resultados a Muestra N° ${id_muestra}`, muestra, determinaciones });
  } catch (error) {
    console.error("Error al buscar determinaciones:", error);
    res.status(500).json({ error: "Error al buscar determinaciones" });
  }
});



router.get(
  "/mostrar/aniadirResultados/:id_muestra/valoresReferencia/:id_determinacion",
  async (req, res) => {

       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
       const usuarioId = user.dataValues.id_Usuario;
    const id_determinacion = req.params.id_determinacion;

    try {
      const valoresReferencia = await ValoresReferencia.findAll({
        where: { id_Determinacion: id_determinacion },
        attributes: {
          exclude: ["estado"],
        },
      });

      res.json(valoresReferencia);
    } catch (error) {
      error("Error al obtener valores de referencia:", error);
      res.status(500).json({ error: "Error al obtener valores de referencia" });
    }
  }
);


router.post("/mostrar/aniadirResultados/:id_muestra", async (req, res) => {
  const id_muestra = req.params.id_muestra;
  const { id_determinacion, valor_final, unidad_medida, custom_unidad_medida } = req.body;
  const usuarioId = req.session.usuario.id;

  try {
    const unidadMedida = unidad_medida === "custom" ? custom_unidad_medida : unidad_medida;
    const valorFinalConUnidad = unidadMedida ? `${valor_final} ${unidadMedida}` : valor_final;

    const muestra = await Muestra.findByPk(id_muestra);
    if (!muestra) return res.status(404).send("Muestra no encontrada.");
    
    const id_Orden = muestra.id_Orden;

    await Resultado.create({
      id_Muestra: id_muestra,
      id_determinacion,
      valor_final: valorFinalConUnidad,
      id_Orden,
      fecha_resultado: new Date(),
    });

    await auditoriaController.registrar(usuarioId, "Añadir Resultado", `Nuevo resultado para muestra ID: ${id_muestra}`);
    res.redirect(`/muestras/mostrar/${id_Orden}`);
  } catch (error) {
    console.error("Error al añadir resultado:", error);
    res.status(500).json({ error: "Error al añadir resultado" });
  }
});



router.post("/actualizarEstado/:id_muestra", async (req, res) => {

     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  const id_muestra = req.params.id_muestra;
  const { estado } = req.body;


  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {

    const muestra = await Muestra.findByPk(id_muestra);
    if (!muestra) {
      req.flash("error_msg", "Muestra no encontrada.");
      return res.redirect(`/muestras/mostrar/${id_muestra}`);
    }


    muestra.estado = estado;
    await muestra.save();


    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Muestra",
      `Estado de la muestra con ID: ${id_muestra} actualizado a: ${estado}`
    );


    req.flash("success_msg", "Estado actualizado con éxito.");
    res.redirect(`/muestras/mostrar/${muestra.id_Orden}`);
  } catch (error) {
    error("Error al actualizar estado:", error);
    req.flash("error_msg", "Error al actualizar estado.");
    res.redirect(`/muestras/mostrar/${id_muestra}`);
  }
});


router.post("/actualizarEstadoOrden/:id_orden", async (req, res) => {

     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  const id_orden = req.params.id_orden;


  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {

    await Orden.update(
      { estado: "Para validar" },
      {
        where: { id_Orden: id_orden },
      }
    );


    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Orden",
      `Orden con ID: ${id_orden} actualizada a "Para validar"`
    );


    req.flash("success_msg", 'Orden actualizada a "Para validar"');
    res.redirect(`/muestras/detalleOrden/${id_orden}`);
  } catch (error) {
    error("Error al actualizar el estado de la orden:", error);
    req.flash("error_msg", "Error al actualizar el estado de la orden.");
    res.redirect(`/muestras/mostrar/${id_orden}`);
  }
});


router.get("/detalleOrden/:id_orden", async (req, res) => {

       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  const idOrden = req.params.id_orden;
  const idUsuario = req.user ? req.user.id_Usuario : null;

  const query = `
WITH GeneroPaciente AS (
    SELECT
        ot.id_Orden,
        p.genero,
        p.fecha_nacimiento,
        p.nombre,
        p.apellido,
        p.dni,
        p.email,
        p.telefono,
        p.direccion,
        p.embarazo,
        p.diagnostico,
        p.fecha_registro
    FROM
        ordenes_trabajo ot
    JOIN
        pacientes p ON ot.id_Paciente = p.id_Paciente
    WHERE
        ot.id_Orden = :idOrden
),
EdadPaciente AS (
    SELECT
        id_Orden,
        genero,
        fecha_nacimiento,
        TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        direccion,
        embarazo,
        diagnostico,
        fecha_registro
    FROM
        GeneroPaciente
)
SELECT
    ot.id_Orden,
    ot.id_Paciente,
    ot.dni,
    ot.Fecha_Creacion,
    ot.Fecha_Entrega,
    ot.estado AS estado_orden,
    r.id_Resultado,
    r.id_Muestra,
    r.id_Determinacion,
    r.valor_final,
    r.fecha_resultado,
    d.Nombre_Determinacion,
    vr.id_ValorReferencia,
    vr.Valor_Referencia_Minimo,
    vr.Valor_Referencia_Maximo,
    vr.Sexo,
    vr.Edad_Minima,
    vr.Edad_Maxima,
    ep.edad,
    ep.nombre,
    ep.apellido,
    ep.dni,
    ep.email,
    ep.telefono,
    ep.direccion,
    ep.embarazo,
    ep.diagnostico,
    ep.fecha_registro,
    ep.fecha_nacimiento
FROM
    ordenes_trabajo ot
JOIN
    resultados r ON ot.id_Orden = r.id_Orden
JOIN
    determinaciones d ON r.id_determinacion = d.id_determinacion
JOIN
    valoresReferencia vr ON d.id_determinacion = vr.id_Determinacion
JOIN
    EdadPaciente ep ON ot.id_Orden = ep.id_Orden
WHERE
    (ep.genero IN ('M', 'F', 'masculino', 'femenino')) AND
    (vr.Sexo IN ('M', 'F', 'masculino', 'femenino')) AND
    (ep.edad BETWEEN vr.Edad_Minima AND vr.Edad_Maxima);

  `;


  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  try {
    const resultados = await sequelize.query(query, {
      replacements: { idOrden: idOrden },
      type: sequelize.QueryTypes.SELECT,
    });

    const ordenes = resultados.reduce((acc, row) => {
      let orden = acc.find((o) => o.id_Orden === row.id_Orden);
      if (!orden) {
        orden = {
          id_Orden: row.id_Orden,
          id_Paciente: row.id_Paciente,
          dni: row.dni,
          Fecha_Creacion: formatDate(row.Fecha_Creacion),
          Fecha_Entrega: formatDate(row.Fecha_Entrega),
          estado: row.estado_orden,
          nombre: row.nombre,
          apellido: row.apellido,
          email: row.email,
          telefono: row.telefono,
          direccion: row.direccion,
          embarazo: row.embarazo,
          diagnostico: row.diagnostico,
          fecha_registro: formatDate(row.fecha_registro),
          fecha_nacimiento: formatDate(row.fecha_nacimiento),
          edad: row.edad,
          muestras: [],
        };
        acc.push(orden);
      }
      orden.muestras.push({
        id_Resultado: row.id_Resultado,
        id_Muestra: row.id_Muestra,
        id_Determinacion: row.id_Determinacion,
        Nombre_Determinacion: row.Nombre_Determinacion,
        valor_final: row.valor_final,
        fecha_resultado: `${formatDate(row.fecha_resultado)} ${formatTime(
          row.fecha_resultado
        )}`,
        id_ValorReferencia: row.id_ValorReferencia,
        Valor_Referencia_Minimo: row.Valor_Referencia_Minimo,
        Valor_Referencia_Maximo: row.Valor_Referencia_Maximo,
        Sexo: row.Sexo,
        Edad_Minima: row.Edad_Minima,
        Edad_Maxima: row.Edad_Maxima,
        edad: row.edad,
      });
      return acc;
    }, []);

    let usuarioLogueado = {};
    if (idUsuario) {
      const userQuery = `SELECT nombre_usuario FROM Usuarios WHERE id_Usuario = :idUsuario`;
      const userResult = await sequelize.query(userQuery, {
        replacements: { idUsuario: idUsuario },
        type: sequelize.QueryTypes.SELECT,
      });
      usuarioLogueado = userResult[0] || {};
    }

    res.render("detalleOrden", {
      pageTitle: `Detalles de la Orden N° ${idOrden}`,
      ordenes: ordenes,
      usuarioLogueado: usuarioLogueado.nombre_usuario || "Desconocido",
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (error) {
    error("Error al obtener detalles de la orden:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/actualizarEstadoOrden/:id_orden/informada", async (req, res) => {
  const id_orden = req.params.id_orden;
  log("ID de Orden Capturado:", id_orden);


  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {

    await Orden.update(
      { estado: "Informada" },
      {
        where: { id_Orden: id_orden },
      }
    );


    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Orden",
      `Orden con ID: ${id_orden} actualizada a "Informada"`
    );

    req.flash("success_msg", 'Orden actualizada a "Informada"');
    log("Orden actualizada a 'Informada'");
    res.redirect(`/muestras/detalleOrden/${id_orden}`);
  } catch (error) {
    error("Error al actualizar el estado de la orden:", error);
    req.flash("error_msg", "Error al actualizar el estado de la orden.");
    res.redirect(`/muestras/detalleOrden/${id_orden}`);
  }
});


module.exports = router;
