const express = require("express");
const router = express.Router();
const Paciente = require("../models/paciente");
const Usuarios = require("../models/User");
const bcrypt = require("bcrypt");
const auditoriaController = require("../routes/AuditoriaRuta");
const fs = require('fs');
const path = require('path');
const flash = require('connect-flash');
const { checkRole } = require('../config/middlewares');
const { Op } = require("sequelize");
const transporter = require("../config/mailConfig"); // 👈 Importar configuración

router.get("/ingresar-paciente", (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  res.render("ingresarPaciente", { paciente: null, mensaje: null }); // Renderiza el formulario de ingreso de pacientes
});
router.get("/buscar-paciente", (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  res.render("busquedaPaciente");
});
router.get("/buscar-paciente-dinamico", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  const { query } = req.query;

  try {
    // Busca pacientes por nombre, apellido, DNI, o email
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
      attributes: [
        "id_paciente",
        "nombre",
        "apellido",
        "dni",
        "email",
        "telefono",
      ], // Sólo selecciona los campos necesarios
    });

    res.json(pacientes);
  } catch (error) {
    console.error("Error al buscar pacientes:", error);
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

router.post("/buscar-paciente", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  const searchType = req.body.searchType;
  const searchTerm = req.body.searchTerm;

  try {
    const whereCondition = {};

    if (searchType === "dni") {
      whereCondition.dni = searchTerm;
    } else if (searchType === "apellido") {
      //  Buscar todos los pacientes con el mismo apellido
      const pacientes = await Paciente.findAll({
        where: { apellido: searchTerm },
      });

      if (pacientes.length > 1) {
        // Si hay múltiples pacientes con el mismo apellido, mostrar una lista para seleccionar
        res.render("seleccionarPaciente", {
          pacientes,
          searchTerm,
          searchType,
        });
        return;
      } else if (pacientes.length === 1) {
        // Si se encuentra un paciente, redirigir a la página de edición
        res.redirect(`/editar-paciente/${pacientes[0].id_paciente}`);
        return;
      }
    } else if (searchType === "email") {
      whereCondition.email = searchTerm;
    }

    const paciente = await Paciente.findOne({ where: whereCondition });

    if (paciente) {
      // Si se encuentra un paciente, redirigir a la página de edición
      res.redirect(`/editar-paciente/${paciente.id_paciente}`);
    } else {
      // Si no se encuentra un paciente, redirigir a la misma página con el mensaje
      res.render("busquedaPaciente", {
        paciente: null,
        mensaje: "Paciente no encontrado.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al buscar paciente por DNI, apellido o email.");
  }
});

// Controlador para seleccionar un paciente de la lista
router.get("/editar-paciente/:id", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  const { id } = req.params;
  const { searchTerm, searchType } = req.query;

  try {
    const paciente = await Paciente.findByPk(id);

    if (paciente) {
      // Configura la variable fechaNacimiento
      const fechaNacimiento = paciente.fecha_nacimiento;

      // Renderiza el formulario con los campos llenos, pasando el valor de "fechaNacimiento"
      res.render("ingresarPaciente", {
        paciente,
        fechaNacimiento,
        mensaje: "Paciente seleccionado:",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al seleccionar paciente para edición.");
  }
});
// Ruta para procesar la creación o actualización de pacientes

router.post("/guardar-paciente", async (req, res) => {
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;

  try {
    const {
      dni,
      nombre,
      apellido,
      direccion,
      email,
      telefono,
      fecha_nacimiento,
      genero,
      embarazo,
      diagnostico,
    } = req.body;

    // Verificar paciente existente
    const pacienteExistente = await Paciente.findOne({
      where: { [Op.or]: [{ dni }, { email }] }
    });

    if (pacienteExistente) {
      return res.render("ingresarPaciente", {
        paciente: req.body,
        mensaje: `Error: Ya existe un paciente con DNI ${dni} o email ${email}`
      });
    }

    // Crear nuevo paciente
    const nuevoPaciente = await Paciente.create({
      nombre,
      apellido,
      dni,
      email,
      telefono,
      direccion,
      fecha_nacimiento,
      genero,
      embarazo,
      diagnostico,
      fecha_registro: new Date()
    });

    // Crear usuario asociado
    const hashedPassword = await bcrypt.hash(dni, 10);
    await Usuarios.create({
      nombre_usuario: `${nombre} ${apellido}`,
      rol: "paciente",
      correo_electronico: email,
      password: hashedPassword
    });

    // Auditoría
    await auditoriaController.registrar(
      usuarioId,
      "Creación de Paciente",
      `Nuevo paciente: ${nombre} ${apellido} (DNI: ${dni})`
    );

    // Cargar y personalizar plantilla HTML
    const templatePath = path.join(__dirname, '../templates/emailTemplate.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8')
      .replace(/\${email}/g, email)
      .replace(/\${dni}/g, dni)
      .replace(/\${nombre}/g, nombre)
      .replace(/\${apellido}/g, apellido)
      .replace(/http:\/\/tulaboratorio.com\/login/g, 'http://localhost:3000/login');

    // Enviar email
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "🔑 Tus credenciales de acceso - Laboratorio La Punta",
      text: `Bienvenido ${nombre} ${apellido}!\n\nUsuario: ${email}\nContraseña: ${dni}\n\nAccede en: http://localhost:3000/login`,
      html: htmlTemplate
    });

    res.redirect(`/tecnico?success=Paciente registrado y correo enviado`);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error al guardar el paciente");
  }
});

router.get("/portal-paciente/editar", checkRole(["paciente"]), async (req, res) => {
  try {
    const paciente = await Paciente.findOne({
      where: { email: req.user.correo_electronico }
    });

    if (!paciente) {
      req.flash("error", "Paciente no encontrado");
      return res.redirect("/portalPaciente");
    }

    res.render("editarPaciente", {
      paciente: paciente.get({ plain: true })
    });

  } catch (error) {
    console.error("Error al cargar datos del paciente:", error);
    req.flash("error", "Error al cargar datos");
    res.redirect("/portalPaciente");
  }
});



router.post("/portal-paciente/actualizar", checkRole(["paciente"]), async (req, res) => {
  try {
    console.log("Datos recibidos en actualización:", req.body);
    const { nombre, apellido, fecha_nacimiento, direccion, password_actual, nueva_password } = req.body;

    // Obtener usuario y paciente
    const usuario = await Usuarios.findByPk(req.user.id_Usuario);
    const paciente = await Paciente.findOne({
      where: { email: usuario.correo_electronico }
    });

    // Validar password actual si se cambia contraseña
    if (nueva_password && nueva_password.trim() !== "") {
      const passwordValido = await bcrypt.compare(password_actual, usuario.password);
      if (!passwordValido) {
        req.flash("error", "Contraseña actual incorrecta");
        return res.redirect("/portal-paciente/editar");
      }
      usuario.password = await bcrypt.hash(nueva_password, 10);
      await usuario.save();
    }

    // Actualizar datos del paciente, incluyendo el domicilio
    await paciente.update({
      nombre,
      apellido,
      fecha_nacimiento: new Date(fecha_nacimiento),
      direccion
    });

    // Actualizar nombre de usuario si cambió
    const nuevoNombre = `${nombre} ${apellido}`;
    if (usuario.nombre_usuario !== nuevoNombre) {
      usuario.nombre_usuario = nuevoNombre;
      await usuario.save();
    }

    req.flash("success", "¡Datos actualizados correctamente!");
    return res.redirect("/portal-paciente/editar");

  } catch (error) {
    console.error("Error al actualizar los datos:", error);
    req.flash("error", "Error al actualizar los datos");
    return res.redirect("/portal-paciente/editar");
  }
});



// Eliminar paciente y usuario por DNI
router.post("/eliminar-paciente/:dni", async (req, res) => {
  // Verifica la autenticación del usuario
  const user = req.user;
  if (!user || !user.dataValues) {
    return res.status(401).send("Usuario no autenticado.");
  }
  const usuarioId = user.dataValues.id_Usuario;
  const { dni } = req.params;

  try {
    // Buscar al paciente por DNI
    const paciente = await Paciente.findOne({ where: { dni } });

    if (!paciente) {
      return res.status(404).send("Paciente no encontrado.");
    }

    // Buscar al usuario por email o cualquier otro campo asociado
    const usuario = await Usuarios.findOne({
      where: { Correo_Electronico: paciente.email },
    });

    // Eliminar el paciente
    await paciente.destroy();
    console.log(`Paciente con DNI ${dni} eliminado.`);
    await auditoriaController.registrar(
      usuarioId,
      "Eliminar Paciente",
      `El usuario eliminó al paciente con DNI ${dni} (${paciente.nombre} ${paciente.apellido}).`
    );

    // Eliminar el usuario asociado si existe
    if (usuario) {
      await usuario.destroy();
      console.log(`Usuario con email ${paciente.email} eliminado.`);
    }

    // Redirigir o enviar respuesta de éxito
    res.redirect("/layout"); // Redirigir a la lista de pacientes u otra página adecuada
  } catch (error) {
    console.error("Error al eliminar el paciente o usuario:", error);
    res.status(500).send("Error al eliminar el paciente o usuario.");
  }
});

module.exports = router;
