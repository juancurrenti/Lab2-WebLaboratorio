const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const fs = require('fs');
const path = require('path');
const PDFDocument = require("pdfkit");

const { checkRole } = require('../config/middlewares');


const { sequelize, Paciente, Usuario, OrdenTrabajo } = require("../models");
const auditoriaController = require("./AuditoriaRuta");
const transporter = require("../config/mailConfig");


router.get("/ingresar-paciente", (req, res) => {
  res.render("ingresarPaciente", { pageTitle: 'Ingresar Paciente', paciente: null, mensaje: null });
});


router.get("/buscar-paciente", (req, res) => {
  res.render("busquedaPaciente", { pageTitle: 'Buscar Paciente' });
});


router.get("/buscar-paciente-dinamico", async (req, res) => {
    const { query, incluirInactivos } = req.query;
    try {
        let whereCondition = {
            [Op.or]: [
                { nombre: { [Op.like]: `%${query}%` } },
                { apellido: { [Op.like]: `%${query}%` } },
                { dni: { [Op.like]: `%${query}%` } },
            ],
        };

        if (incluirInactivos !== 'true') {
            whereCondition.estado = 'activo';
        }

        const pacientes = await Paciente.findAll({
            where: whereCondition,
            attributes: ["id_paciente", "nombre", "apellido", "dni", "estado"],
        });
        res.json(pacientes);
    } catch (error) {
        console.error("Error al buscar pacientes:", error);
        res.status(500).json({ error: "Error al buscar pacientes" });
    }
});

router.post("/buscar-paciente", async (req, res) => {
    const { searchType, searchTerm, incluirInactivos } = req.body;
    try {
        let whereCondition = {};
        if (!incluirInactivos) {
            whereCondition.estado = 'activo';
        }

        if (searchType === "dni") {
            whereCondition.dni = searchTerm;
        } else if (searchType === "apellido") {
            whereCondition.apellido = { [Op.like]: `%${searchTerm}%` };
            const pacientes = await Paciente.findAll({ where: whereCondition });
            if (pacientes.length > 1) return res.render("seleccionarPaciente", {pageTitle: 'Seleccionar Paciente', pacientes, searchTerm, searchType });
            if (pacientes.length === 1) return res.redirect(`/editar-paciente/${pacientes[0].id_paciente}`);
        }
        const paciente = await Paciente.findOne({ where: whereCondition });
        if (paciente) {
            res.redirect(`/editar-paciente/${paciente.id_paciente}`);
        } else {
            res.render("busquedaPaciente", {pageTitle: 'Buscar Paciente', paciente: null, mensaje: "Paciente no encontrado." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al buscar paciente.");
    }
});


router.get("/editar-paciente/:id", async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id);
        if (paciente) {
            res.render("ingresarPaciente", {pageTitle: 'Editar Paciente', paciente: paciente });
        } else {
            req.flash('error', 'El paciente no fue encontrado.');
            res.redirect('/buscar-paciente');
        }
    } catch (error) {
        console.error("Error al cargar paciente para edición:", error);
        res.status(500).send("Error al cargar paciente para edición.");
    }
});


router.post("/editar-paciente/:id", async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id);
        if (paciente) {
            await paciente.update(req.body);
            req.flash('success', `Paciente ${paciente.nombre} ${paciente.apellido} actualizado exitosamente.`);
            res.redirect('/buscar-paciente');
        } else {
            res.status(404).send("Paciente no encontrado para actualizar.");
        }
    } catch (error) {
        console.error("Error al actualizar el paciente:", error);
        res.status(500).send("Error al actualizar el paciente.");
    }
});

router.post("/desactivar-paciente/:id", checkRole(['admin', 'recepcionista', 'bioquimico', 'tecnico']), async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const paciente = await Paciente.findByPk(req.params.id, { transaction });
        
        if (paciente && paciente.estado === 'activo') {
            paciente.estado = 'inactivo';
            await paciente.save({ transaction });

            await auditoriaController.registrar(
                req.session.usuario.id,
                "Desactivación de Paciente",
                `Se desactivó al paciente: ${paciente.nombre} ${paciente.apellido} (DNI: ${paciente.dni})`,
                { transaction }
            );
            
            await transaction.commit();
            req.flash('success', `Paciente ${paciente.nombre} ${paciente.apellido} ha sido desactivado correctamente.`);
        } else {
            await transaction.rollback();
            req.flash('error', 'No se pudo desactivar al paciente o ya estaba inactivo.');
        }
        res.redirect('/buscar-paciente');
    } catch (error) {
        if(transaction) await transaction.rollback();
        console.error("Error al desactivar el paciente:", error);
        req.flash('error', 'Ocurrió un error al intentar desactivar al paciente.');
        res.redirect('/buscar-paciente');
    }
});

router.post("/reactivar-paciente/:id", checkRole(['admin', 'recepcionista', 'bioquimico', 'tecnico']), async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const paciente = await Paciente.findByPk(req.params.id, { transaction });
        
        if (paciente && paciente.estado === 'inactivo') {
            paciente.estado = 'activo';
            await paciente.save({ transaction });

            await auditoriaController.registrar(
                req.session.usuario.id,
                "Reactivación de Paciente",
                `Se reactivó al paciente: ${paciente.nombre} ${paciente.apellido} (DNI: ${paciente.dni})`,
                { transaction }
            );
            
            await transaction.commit();
            req.flash('success', `Paciente ${paciente.nombre} ${paciente.apellido} ha sido reactivado correctamente.`);
        } else {
            await transaction.rollback();
            req.flash('error', 'No se pudo reactivar al paciente o ya estaba activo.');
        }
        res.redirect(`/editar-paciente/${req.params.id}`);
    } catch (error) {
        if(transaction) await transaction.rollback();
        console.error("Error al reactivar el paciente:", error);
        req.flash('error', 'Ocurrió un error al intentar reactivar al paciente.');
        res.redirect('/buscar-paciente');
    }
});


router.post("/guardar-paciente", checkRole(['bioquimico', 'recepcionista', 'admin', 'tecnico']), async (req, res) => {
    const { dni, nombre, apellido, email, ...pacienteData } = req.body;
    const transaction = await sequelize.transaction();
    
    try {

        const usuarioIdAuditoria = req.session.usuario.id;


        const pacienteExistente = await Paciente.findOne({ where: { dni }, transaction });
        if (pacienteExistente) {
            await transaction.rollback();
            req.flash('error', `Error: Ya existe un paciente registrado con el DNI ${dni}`);
            return res.render("ingresarPaciente", { pageTitle: 'Ingresar Paciente', paciente: req.body });
        }


        let usuario = await Usuario.findOne({ where: { correo_electronico: email }, transaction });
        let usuarioEraNuevo = false;

        if (usuario) {
            const esPaciente = await Paciente.findOne({ where: { id_usuario_fk: usuario.id_Usuario }, transaction });
            if (esPaciente) {
                await transaction.rollback();
                req.flash('error', 'Este usuario ya tiene un perfil de paciente asociado.');
                return res.redirect('/ingresar-paciente');
            }
        } else {
            usuarioEraNuevo = true;
            const hashedPassword = await bcrypt.hash(dni, 10);
            usuario = await Usuario.create({
                nombre_usuario: `${nombre} ${apellido}`,
                correo_electronico: email,
                password: hashedPassword,
            }, { transaction });
        }


        await Paciente.create({
            ...pacienteData,
            nombre,
            apellido,
            dni,
            email,
            id_usuario_fk: usuario.id_Usuario,
            fecha_registro: new Date()
        }, { transaction });


        await auditoriaController.registrar(
            usuarioIdAuditoria,
            "Creación de Paciente",
            `Nuevo perfil de paciente para usuario: ${nombre} ${apellido} (DNI: ${dni})`,
            { transaction }
        );


        if (usuarioEraNuevo) {
            const templatePath = path.join(__dirname, '../templates/emailTemplate.html');
            let htmlTemplate = fs.readFileSync(templatePath, 'utf8')
                .replace(/\${email}/g, email).replace(/\${dni}/g, dni).replace(/\${nombre}/g, nombre)
                .replace(/\${apellido}/g, apellido).replace(/http:\/\/tulaboratorio.com\/login/g, 'http://localhost:3000/login');
            
            await transporter.sendMail({
                from: process.env.FROM_EMAIL, to: email, subject: "🔑 Tus credenciales de acceso - Laboratorio",
                text: `Bienvenido ${nombre} ${apellido}!\n\nUsuario: ${email}\nContraseña: ${dni}\n\nAccede en: http://localhost:3000/login`,
                html: htmlTemplate
            });
        }

        await transaction.commit();
        req.flash('success', 'Paciente registrado con éxito.');
        res.redirect(`/${req.session.usuario.rolEmpleado}`);

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error al guardar el paciente:", error);
        res.status(500).send("Error al guardar el paciente");
    }
});


router.get("/portal-paciente", checkRole(["paciente"]), async (req, res) => {
  try {
    const idPaciente = req.session.usuario.idPaciente;
    if (!idPaciente) {
      req.flash("error", "No se encontró un perfil de paciente asociado a su usuario.");
      return res.redirect("/login");
    }
    const ordenes = await OrdenTrabajo.findAll({
      where: { estado: "Informada", id_Paciente: idPaciente },
      order: [['Fecha_Creacion', 'DESC']]
    });
    res.render("portalPaciente", {pageTitle: 'Portal del Paciente', ordenes: ordenes, user: req.session.usuario });
  } catch (error) {
    console.error("ERROR en /portal-paciente:", error);
    req.flash("error", "Hubo un error al cargar sus datos.");
    res.redirect("/login");
  }
});

router.get("/portal-paciente/editar", checkRole(["paciente"]), async (req, res) => {
  try {
    const paciente = await Paciente.findOne({ where: { id_usuario_fk: req.session.usuario.id } });
    if (!paciente) {
      req.flash("error", "Paciente no encontrado");
      return res.redirect("/portal-paciente");
    }
    res.render("editarPaciente", {
        pageTitle: 'Editar Mis Datos',
        paciente: paciente.get({ plain: true }),
        successMessages: req.flash('success'),
        errorMessages: req.flash('error')
    });
  } catch (error) {
    console.error("Error al cargar datos del paciente:", error);
    req.flash("error", "Error al cargar datos");
    res.redirect("/portal-paciente");
  }
});


router.post("/portal-paciente/actualizar", checkRole(["paciente"]), async (req, res) => {
  try {
    const { password_actual, nueva_password } = req.body;
    const usuario = await Usuario.findByPk(req.session.usuario.id);

    if (!nueva_password || nueva_password.trim() === "") {
        req.flash("error", "No se ingresó una nueva contraseña.");
        return res.redirect("/portal-paciente/editar");
    }
    if (!password_actual || password_actual.trim() === "") {
        req.flash("error", "Para cambiar la contraseña, debes ingresar tu contraseña actual.");
        return res.redirect("/portal-paciente/editar");
    }

    const passwordValido = await bcrypt.compare(password_actual, usuario.password);
    if (!passwordValido) {
        req.flash("error", "La contraseña actual es incorrecta.");
        return res.redirect("/portal-paciente/editar");
    }

    const esMismaPassword = await bcrypt.compare(nueva_password, usuario.password);
    if (esMismaPassword) {
        req.flash("error", "Error al modificar la contraseña, motivo: Contraseña idéntica a la anterior.");
        return res.redirect("/portal-paciente/editar");
    }

    usuario.password = await bcrypt.hash(nueva_password, 10);
    await usuario.save();

    return res.redirect("/portal-paciente/editar?password_success=true");

  } catch (error) {
    console.error("Error al actualizar la contraseña:", error);
    req.flash("error", "Error al actualizar la contraseña.");
    return res.redirect("/portal-paciente/editar");
  }
});

router.post("/eliminar-paciente/:dni", async (req, res) => {

  const usuarioIdAuditoria = req.session.usuario.id;
  const { dni } = req.params;
  try {
    const paciente = await Paciente.findOne({ where: { dni } });
    if (!paciente) return res.status(404).send("Paciente no encontrado.");
    

    const usuario = await Usuario.findByPk(paciente.id_usuario_fk);
    
    await paciente.destroy();
    await auditoriaController.registrar(usuarioIdAuditoria, "Eliminar Paciente", `El usuario eliminó al paciente con DNI ${dni} (${paciente.nombre} ${paciente.apellido}).`);
    if (usuario) await usuario.destroy();
    
    res.redirect(`/${req.session.usuario.rolEmpleado}`);
  } catch (error) {
    console.error("Error al eliminar el paciente o usuario:", error);
    res.status(500).send("Error al eliminar el paciente o usuario.");
  }
});
router.get("/generarPDF/:idOrden", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  const { idOrden } = req.params;
  const usuarioSesion = req.session.usuario;

  try {
    const orden = await OrdenTrabajo.findByPk(idOrden);
    if (!orden) return res.status(404).send("Orden no encontrada.");
    if (!usuarioSesion.esEmpleado && orden.id_Paciente !== usuarioSesion.idPaciente) {
      req.flash('error', 'No tienes permiso para ver esta orden.');
      return res.redirect('/portal-paciente');
    }

    const resultados = await sequelize.query(
      `SELECT 
          e.nombre_examen,
          d.Nombre_Determinacion,
          r.Valor AS valor_resultado,
          um.nombreUnidadMedida AS unidad_medida,
          vr.Valor_Referencia_Minimo,
          vr.Valor_Referencia_Maximo,
          vr.Valor_Esperado,
          p.nombre AS nombre_paciente,
          p.apellido AS apellido_paciente,
          p.dni AS dni_paciente,
          p.genero AS sexo_paciente,
          o.Fecha_Creacion AS fecha_orden,
          o.Fecha_Creacion AS fecha_ingreso
        FROM resultados r
        INNER JOIN determinaciones d ON r.id_Determinacion = d.id_Determinacion
        INNER JOIN unidadmedida um ON d.Unidad_Medida = um.id_UnidadMedida
        INNER JOIN examen e ON d.id_examen = e.id_examen
        INNER JOIN ordenes_trabajo o ON r.id_Orden = o.id_Orden
        INNER JOIN pacientes p ON o.id_Paciente = p.id_paciente
        LEFT JOIN valoresreferencia vr 
          ON d.id_Determinacion = vr.id_Determinacion 
          AND (vr.Sexo = UPPER(LEFT(p.genero,1)) OR vr.Sexo = 'A')
          AND TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) BETWEEN vr.Edad_Minima AND vr.Edad_Maxima
        WHERE o.id_Orden = :idOrden
        ORDER BY e.nombre_examen, d.Nombre_Determinacion;`,
      { replacements: { idOrden }, type: sequelize.QueryTypes.SELECT }
    );

    if (resultados.length === 0) {
      return res.status(404).send("No se encontraron resultados para esta orden.");
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Orden_${idOrden}.pdf`);
    doc.pipe(res);

    const watermarkPath = path.join(__dirname, '../public/img/iconopdf.png');
    const drawWatermark = () => {
      if (!fs.existsSync(watermarkPath)) return;
      const tile = 50, xs = 100, ys = 100;
      doc.save().opacity(0.07);
      const cols = Math.ceil(doc.page.width / xs);
      const rows = Math.ceil(doc.page.height / ys);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          doc.image(watermarkPath, i * xs, j * ys, { width: tile });
        }
      }
      doc.restore();
    };
    drawWatermark();
    doc.on('pageAdded', drawWatermark);

    if (fs.existsSync(watermarkPath)) {
      doc.image(watermarkPath, (doc.page.width - 60) / 2, 30, { width: 60 });
    }

    const titleX = 50, titleY = 120;
    doc
      .fontSize(16)
      .fillColor('#000')
      .text('Informe de Resultados de Laboratorio', titleX, titleY, { align: 'center' });
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

    const p = resultados[0];
    const sexo = p.sexo_paciente.toLowerCase() === 'masculino' ? 'Masculino' : 'Femenino';
    doc.fontSize(12).moveDown(2);
    const info = [
      `Orden: ${idOrden}`,
      `Paciente: ${p.nombre_paciente} ${p.apellido_paciente}`,
      `Fecha Orden:   ${new Date(p.fecha_orden).toLocaleDateString('es-AR')}`,
      `DNI: ${p.dni_paciente}`,
      `Fecha Ingreso: ${new Date(p.fecha_ingreso).toLocaleDateString('es-AR')}`,
      `Sexo: ${sexo}`
    ];
    info.forEach((txt, i) => {
      const x = 50 + (i % 2) * 250;
      const y = 150 + Math.floor(i / 2) * 15;
      doc.text(txt, x, y);
    });
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.5).stroke('#333');
    doc.moveDown();


    const colsX = { examen: 50, det: 180, res: 330, ref: 410 };
    const headerY = doc.y;

    doc.fontSize(9).fillColor('#333');
    doc.text('Examen',        colsX.examen, headerY, { width: 130, align: 'left' })
       .text('Determinación', colsX.det,    headerY, { width: 140, align: 'left' })
       .text('Resultado',     colsX.res,    headerY, { width: 100, align: 'center' })

       .text('Valores Ref.',  colsX.ref,    headerY, { width: 120, align: 'right' });

    doc.moveDown(1);
    doc.lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor('#000');
    resultados.forEach(r => {
      const rowY = doc.y;
      const unidadesCualitativas = ['Positivo / Negativo', 'Reactivo / No Reactivo', 'Ausencia / Presencia'];
      let resultadoTxt = '';
      let refTxt = '';

      if (unidadesCualitativas.includes(r.unidad_medida)) {
        resultadoTxt = r.valor_resultado;
        refTxt = r.Valor_Esperado || 'N/A';
      } else {
        resultadoTxt = r.valor_resultado ? parseFloat(r.valor_resultado).toFixed(2) : 'N/A';

        refTxt = (r.Valor_Referencia_Minimo != null && r.Valor_Referencia_Maximo != null)
          ? `${parseFloat(r.Valor_Referencia_Minimo).toFixed(2)} - ${parseFloat(r.Valor_Referencia_Maximo).toFixed(2)} ${r.unidad_medida}`
          : 'N/A';
      }

      doc.text(r.nombre_examen,       colsX.examen, rowY, { width: 130, align: 'left' })
         .text(r.Nombre_Determinacion,  colsX.det,    rowY, { width: 140, align: 'left' })
         .text(resultadoTxt,            colsX.res,    rowY, { width: 100, align: 'center' })

         .text(refTxt,                  colsX.ref,    rowY, { width: 120, align: 'right' });
      doc.moveDown(1);
    });

    doc.end();

  } catch (err) {
    console.error('Error al generar el PDF:', err);
    res.status(500).send('Ocurrió un error al generar el PDF.');
  }
});
module.exports = router;