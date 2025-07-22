const express = require("express");
const router = express.Router();

const Paciente = require("../models/paciente");
const Usuarios = require("../models/User");
const { OrdenesTrabajo } = require("../models");
const { Op } = require("sequelize");

const bcrypt = require("bcrypt");
const auditoriaController = require("../routes/AuditoriaRuta");
const fs = require('fs');
const path = require('path');
const { checkRole } = require('../config/middlewares');
const transporter = require("../config/mailConfig");



// Muestra el formulario para ingresar un nuevo paciente
router.get("/ingresar-paciente", (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) return res.status(401).send("Usuario no autenticado.");
  res.render("ingresarPaciente", { paciente: null, mensaje: null });
});

// Muestra la página de búsqueda
router.get("/buscar-paciente", (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) return res.status(401).send("Usuario no autenticado.");
  res.render("busquedaPaciente");
});

// Proporciona datos para la búsqueda dinámica en vivo
router.get("/buscar-paciente-dinamico", async (req, res) => {
  const { query } = req.query;
  try {
    const pacientes = await Paciente.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: `%${query}%` } },
          { apellido: { [Op.like]: `%${query}%` } },
          { dni: { [Op.like]: `%${query}%` } },
          { email: { [Op.like]: `%${query}%` } },
          { telefono: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id_paciente", "nombre", "apellido", "dni", "email", "telefono"],
    });
    res.json(pacientes);
  } catch (error) {
    console.error("Error al buscar pacientes:", error);
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

// Procesa el formulario de búsqueda y redirige a la página de edición
router.post("/buscar-paciente", async (req, res) => {
  const { searchType, searchTerm } = req.body;
  try {
    let whereCondition = {};
    if (searchType === "dni") whereCondition.dni = searchTerm;
    else if (searchType === "email") whereCondition.email = searchTerm;
    else if (searchType === "apellido") {
        const pacientes = await Paciente.findAll({ where: { apellido: searchTerm } });
        if (pacientes.length > 1) return res.render("seleccionarPaciente", { pacientes, searchTerm, searchType });
        if (pacientes.length === 1) return res.redirect(`/editar-paciente/${pacientes[0].id_paciente}`);
    }
    const paciente = await Paciente.findOne({ where: whereCondition });
    if (paciente) {
      res.redirect(`/editar-paciente/${paciente.id_paciente}`);
    } else {
      res.render("busquedaPaciente", { paciente: null, mensaje: "Paciente no encontrado." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al buscar paciente.");
  }
});

// Muestra el formulario para editar un paciente con sus datos cargados

router.get("/editar-paciente/:id", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) return res.status(401).send("Usuario no autenticado.");
  
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (paciente) {
      // Pasamos solo el objeto 'paciente'. La plantilla se encargará del resto.
      res.render("ingresarPaciente", { paciente: paciente });
    } else {
      res.status(404).send("Paciente no encontrado para editar.");
    }
  } catch (error) {
    console.error("Error al cargar paciente para edición:", error);
    res.status(500).send("Error al cargar paciente para edición.");
  }
});

// Recibe los datos del formulario de edición y los guarda
router.post("/editar-paciente/:id", async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (paciente) {
      await paciente.update(req.body); // Actualiza el paciente con los datos del form
      req.flash('success', `Paciente ${paciente.nombre} ${paciente.apellido} actualizado exitosamente.`);
      res.redirect('/buscar-paciente'); // Redirige a la página de búsqueda
    } else {
      res.status(404).send("Paciente no encontrado para actualizar.");
    }
  } catch (error) {
    console.error("Error al actualizar el paciente:", error);
    res.status(500).send("Error al actualizar el paciente.");
  }
});

// Ruta para CREAR un nuevo paciente
router.post("/guardar-paciente", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) return res.status(401).send("Usuario no autenticado.");
  const usuarioId = user.dataValues.id_Usuario;
  try {
    const { dni, nombre, apellido, direccion, email, telefono, fecha_nacimiento, genero, embarazo, diagnostico } = req.body;
    const pacienteExistente = await Paciente.findOne({ where: { [Op.or]: [{ dni }, { email }] } });
    if (pacienteExistente) {
      return res.render("ingresarPaciente", { paciente: req.body, mensaje: `Error: Ya existe un paciente con DNI ${dni} o email ${email}` });
    }
    await Paciente.create({ nombre, apellido, dni, email, telefono, direccion, fecha_nacimiento, genero, embarazo, diagnostico, fecha_registro: new Date() });
    const hashedPassword = await bcrypt.hash(dni, 10);
    await Usuarios.create({ nombre_usuario: `${nombre} ${apellido}`, rol: "usuario", correo_electronico: email, password: hashedPassword });
    await auditoriaController.registrar(usuarioId, "Creación de Usuario", `Nuevo Usuario: ${nombre} ${apellido} (DNI: ${dni})`);
    const templatePath = path.join(__dirname, '../templates/emailTemplate.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8')
      .replace(/\${email}/g, email).replace(/\${dni}/g, dni).replace(/\${nombre}/g, nombre)
      .replace(/\${apellido}/g, apellido).replace(/http:\/\/tulaboratorio.com\/login/g, 'http://localhost:3000/login');
    await transporter.sendMail({
      from: process.env.FROM_EMAIL, to: email, subject: "🔑 Tus credenciales de acceso - Laboratorio La Punta",
      text: `Bienvenido ${nombre} ${apellido}!\n\nUsuario: ${email}\nContraseña: ${dni}\n\nAccede en: http://localhost:3000/login`,
      html: htmlTemplate
    });
    res.redirect(`/recepcionista?success=Paciente registrado y correo enviado`);
  } catch (error) {
    console.error("Error al guardar el paciente:", error);
    res.status(500).send("Error al guardar el paciente");
  }
});



router.get("/portal-paciente", checkRole(["paciente"]), async (req, res) => {
  try {
    const userEmail = req.user.correo_electronico;
    const paciente = await Paciente.findOne({ where: { email: userEmail } });
    if (!paciente) {
      req.flash("error", "No se encontró un perfil de paciente asociado a su usuario.");
      return res.redirect("/login");
    }
    const ordenes = await OrdenesTrabajo.findAll({
      where: { estado: "informada", id_Paciente: paciente.id_paciente },
      order: [['Fecha_Creacion', 'DESC']]
    });
    res.render("portalPaciente", { ordenes: ordenes, user: req.user });
  } catch (error) {
    console.error("ERROR en /portal-paciente:", error);
    req.flash("error", "Hubo un error al cargar sus datos.");
    res.redirect("/login");
  }
});

// RUTA GET para mostrar el formulario de edición (esta no cambia)
router.get("/portal-paciente/editar", checkRole(["paciente"]), async (req, res) => {
  try {
    const paciente = await Paciente.findOne({ where: { email: req.user.correo_electronico } });
    if (!paciente) {
      req.flash("error", "Paciente no encontrado");
      return res.redirect("/portal-paciente");
    }
    res.render("editarPaciente", { 
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

// RUTA POST QUE SOLO ACTUALIZA LA CONTRASEÑA (CON LÓGICA DE MODAL)
router.post("/portal-paciente/actualizar", checkRole(["paciente"]), async (req, res) => {
  try {
    const { password_actual, nueva_password } = req.body;
    const usuario = await Usuarios.findByPk(req.user.id_Usuario);

    // Si no se envía una nueva contraseña, no se hace nada.
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

    // --- NUEVO: Verificar si la nueva contraseña es idéntica a la anterior ---
    const esMismaPassword = await bcrypt.compare(nueva_password, usuario.password);
    if (esMismaPassword) {
        req.flash("error", "Error al modificar la contraseña, motivo: Contraseña idéntica a la anterior.");
        return res.redirect("/portal-paciente/editar");
    }

    // Si todo es correcto, hasheamos y guardamos la nueva contraseña.
    usuario.password = await bcrypt.hash(nueva_password, 10);
    await usuario.save();

    // --- CAMBIO: Redirigimos con un parámetro para activar el modal ---
    return res.redirect("/portal-paciente/editar?password_success=true");

  } catch (error) {
    console.error("Error al actualizar la contraseña:", error);
    req.flash("error", "Error al actualizar la contraseña.");
    return res.redirect("/portal-paciente/editar");
  }
});

router.post("/eliminar-paciente/:dni", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) return res.status(401).send("Usuario no autenticado.");
  const usuarioId = user.dataValues.id_Usuario;
  const { dni } = req.params;
  try {
    const paciente = await Paciente.findOne({ where: { dni } });
    if (!paciente) return res.status(404).send("Paciente no encontrado.");
    const usuario = await Usuarios.findOne({ where: { Correo_Electronico: paciente.email } });
    await paciente.destroy();
    await auditoriaController.registrar(usuarioId, "Eliminar Paciente", `El usuario eliminó al paciente con DNI ${dni} (${paciente.nombre} ${paciente.apellido}).`);
    if (usuario) await usuario.destroy();
    res.redirect("/layout");
  } catch (error) {
    console.error("Error al eliminar el paciente o usuario:", error);
    res.status(500).send("Error al eliminar el paciente o usuario.");
  }
});


module.exports = router;