const express = require("express");
const router = express.Router();
const Muestra = require("../models/muestra");
const Paciente = require("../models/paciente");
const PDFDocument = require("pdfkit");
const Examen = require("../models/examen");
const Orden = require("../models/ordenes_trabajo");
const Determinacion = require("../models/determinacion");
const Resultado = require("../models/resultados");
const ValoresReferencia = require("../models/valoresReferencia");
const sequelize = require("../config/database");
const auditoriaController = require("../routes/AuditoriaRuta");

const fs = require("fs");

// Ruta para buscar y mostrar muestras asociadas a una orden
router.get("/mostrar/:id_orden", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  const id_orden = req.params.id_orden;

  try {
    const muestras = await Muestra.findAll({
      where: { id_Orden: id_orden },
      include: [{ model: Paciente, as: "Paciente" }],
    });

    if (muestras.length > 0) {
      res.render("muestrasOrden", { id_orden, muestras });
    } else {
      res.render("muestrasOrden", {
        mensaje: "No se encontraron muestras para esta orden de trabajo.",
      });
    }
  } catch (error) {
    error("Error al buscar muestras:", error);
    res.status(500).json({ error: "Error al buscar muestras" });
  }
});

// Ruta para generar el PDF de una muestra específica utilizando pdfkit
router.get("/:id_orden/generarPDFMuestra/:idMuestra", async (req, res) => {
     // Verifica la autenticación del usuario
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

    // Construir el contenido del PDF
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

    // Finalizar el documento PDF
    pdfDoc.end();

    // Obtener el contenido del PDF en formato base64
    const pdfBytes = await new Promise((resolve, reject) => {
      const chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (error) => reject(error));
    });

    const pdfBase64 = pdfBytes.toString("base64");

    // Enviar el contenido del PDF como respuesta JSON al cliente
    res.json({ pdfBase64 });
  } catch (error) {
    error("Error al obtener muestra para PDF:", error);
    res.status(500).json({ error: "Error al obtener muestra para PDF" });
  }
});
// Ruta para mostrar la vista de añadir resultados
router.get("/mostrar/aniadirResultados/:id_muestra", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
     const usuarioId = user.dataValues.id_Usuario;
  const id_muestra = req.params.id_muestra;

  try {
    // Buscar la muestra por ID
    const muestra = await Muestra.findByPk(id_muestra);

    if (!muestra) {
      return res.status(404).json({ mensaje: "Muestra no encontrada." });
    }

    // Obtener el tipo de muestra
    const tipo_muestra = muestra.Tipo_Muestra;

    // Consultar los exámenes que coinciden con el tipo de muestra
    const examenes = await Examen.findAll({ where: { tipo_muestra } });

    // Obtener todos los id_examen
    const id_examenes = examenes.map((examen) => examen.id_examen);

    // Consultar las determinaciones que coinciden con los id_examen
    const determinaciones = await Determinacion.findAll({
      where: { id_examen: id_examenes },
    });

    res.render("aniadirResultados", { muestra, determinaciones });
  } catch (error) {
    error("Error al buscar determinaciones:", error);
    res.status(500).json({ error: "Error al buscar determinaciones" });
  }
});

// Ruta para obtener valores de referencia según la determinación seleccionada
router.get(
  "/mostrar/aniadirResultados/:id_muestra/valoresReferencia/:id_determinacion",
  async (req, res) => {
       // Verifica la autenticación del usuario
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
          exclude: ["estado"], // Excluir el campo "estado"
        },
      });

      res.json(valoresReferencia);
    } catch (error) {
      error("Error al obtener valores de referencia:", error);
      res.status(500).json({ error: "Error al obtener valores de referencia" });
    }
  }
);

// Ruta para añadir un resultado
router.post("/mostrar/aniadirResultados/:id_muestra", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  const id_muestra = req.params.id_muestra;
  const { id_determinacion, valor_final, unidad_medida, custom_unidad_medida } =
    req.body;

  // Verifica que req.user esté definido y tiene dataValues
  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {
    // Determinar la unidad de medida a usar
    const unidadMedida =
      unidad_medida === "custom" ? custom_unidad_medida : unidad_medida;

    // Concatenar valor_final con unidad de medida
    const valorFinalConUnidad = unidadMedida
      ? `${valor_final} ${unidadMedida}`
      : valor_final;

    // Obtener id_Orden desde la muestra
    const muestra = await Muestra.findByPk(id_muestra);
    if (!muestra) {
      return res.status(404).send("Muestra no encontrada.");
    }

    const id_Orden = muestra.id_Orden; // Captura id_Orden
    log("ID de la orden: " + id_Orden);

    // Crear un nuevo resultado
    await Resultado.create({
      id_Muestra: id_muestra,
      id_determinacion,
      valor_final: valorFinalConUnidad,
      id_Orden,
      fecha_resultado: new Date(),
    });

    // Registro de auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Añadir Resultado",
      `Añadido un nuevo resultado para la muestra con ID: ${id_muestra}`
    );

    res.redirect(`/muestras/mostrar/${id_Orden}`); // Redirige a la vista de muestras
  } catch (error) {
    error("Error al añadir resultado:", error);
    res.status(500).json({ error: "Error al añadir resultado" });
  }
});

// Ruta para actualizar el estado de una muestra
router.post("/actualizarEstado/:id_muestra", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  const id_muestra = req.params.id_muestra;
  const { estado } = req.body;

  // Verifica que req.user esté definido y tiene dataValues
  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {
    // Buscar la muestra por ID
    const muestra = await Muestra.findByPk(id_muestra);
    if (!muestra) {
      req.flash("error_msg", "Muestra no encontrada.");
      return res.redirect(`/muestras/mostrar/${id_muestra}`);
    }

    // Actualizar el estado de la muestra
    muestra.estado = estado;
    await muestra.save();

    // Registro de auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Muestra",
      `Estado de la muestra con ID: ${id_muestra} actualizado a: ${estado}`
    );

    // Agregar mensaje de éxito y redirigir
    req.flash("success_msg", "Estado actualizado con éxito.");
    res.redirect(`/muestras/mostrar/${muestra.id_Orden}`);
  } catch (error) {
    error("Error al actualizar estado:", error);
    req.flash("error_msg", "Error al actualizar estado.");
    res.redirect(`/muestras/mostrar/${id_muestra}`);
  }
});

// Ruta para actualizar el estado de una orden
router.post("/actualizarEstadoOrden/:id_orden", async (req, res) => {
     // Verifica la autenticación del usuario
     const user = req.user;
     if (!user || !user.dataValues) {
       return res.status(401).send("Usuario no autenticado.");
     }
  const id_orden = req.params.id_orden;

  // Verifica que req.user esté definido y tiene dataValues
  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {
    // Actualiza el estado de la orden
    await Orden.update(
      { estado: "Para validar" },
      {
        where: { id_Orden: id_orden },
      }
    );

    // Registro de auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Orden",
      `Orden con ID: ${id_orden} actualizada a "Para validar"`
    );

    // Agrega un mensaje de éxito y redirige
    req.flash("success_msg", 'Orden actualizada a "Para validar"');
    res.redirect(`/muestras/detalleOrden/${id_orden}`); // Redirige a la nueva ruta que muestra los detalles de la orden
  } catch (error) {
    error("Error al actualizar el estado de la orden:", error);
    req.flash("error_msg", "Error al actualizar el estado de la orden.");
    res.redirect(`/muestras/mostrar/${id_orden}`); // Redirige a la vista de las muestras de la orden en caso de error
  }
});

// Ruta para mostrar los detalles de una orden
router.get("/detalleOrden/:id_orden", async (req, res) => {
       // Verifica la autenticación del usuario
       const user = req.user;
       if (!user || !user.dataValues) {
         return res.status(401).send("Usuario no autenticado.");
       }
  const idOrden = req.params.id_orden;
  const idUsuario = req.user ? req.user.id_Usuario : null; // Asumiendo que la ID del usuario está en req.user

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

  // Funciones de formato
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
          fecha_nacimiento: formatDate(row.fecha_nacimiento), // Añadido aquí
          edad: row.edad, // Añadido aquí
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

    // Obtener información del usuario logueado
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
// Ruta para actualizar el estado de una orden a "Informada"
router.post("/actualizarEstadoOrden/:id_orden/informada", async (req, res) => {
  const id_orden = req.params.id_orden;
  log("ID de Orden Capturado:", id_orden);

  // Verificar que el usuario está autenticado
  if (!req.user || !req.user.dataValues) {
    return res
      .status(401)
      .send("Usuario no autenticado o datos de usuario no disponibles.");
  }

  const usuarioId = req.user.dataValues.id_Usuario;

  try {
    // Actualizar el estado de la orden a "Informada"
    await Orden.update(
      { estado: "Informada" },
      {
        where: { id_Orden: id_orden },
      }
    );

    // Registrar auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Actualizar Estado de Orden",
      `Orden con ID: ${id_orden} actualizada a "Informada"`
    );

    req.flash("success_msg", 'Orden actualizada a "Informada"');
    log("Orden actualizada a 'Informada'");
    res.redirect(`/muestras/detalleOrden/${id_orden}`); // Redirigir a la vista de detalles de la orden
  } catch (error) {
    error("Error al actualizar el estado de la orden:", error);
    req.flash("error_msg", "Error al actualizar el estado de la orden.");
    res.redirect(`/muestras/detalleOrden/${id_orden}`); // Redirigir en caso de error
  }
});


module.exports = router;
