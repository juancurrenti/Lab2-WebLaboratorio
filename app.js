const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const flash = require("connect-flash");
const passport = require("passport");
const session = require("express-session");
require('dotenv').config();

require('./config/auth'); 

const app = express();

const { sequelize } = require("./models");
const { checkRole } = require('./config/middlewares');

const pacienteRuta = require("./routes/pacienteRuta");
const determinacionesRuta = require("./routes/determinacionesRuta");
const examenRuta = require("./routes/examenRuta");
const ordenes_trabajoRuta = require("./routes/ordenes_trabajoRuta");
const valoresRefRuta = require("./routes/valoresRefRuta");
const modificarExamenRuta = require("./routes/modificarExamenRuta");
const buscarOrdenesRuta = require("./routes/buscarOrdenesRuta");
const resultadosRuta = require("./routes/resultadosRuta");
const adminRuta = require('./routes/adminRuta');
const usuarioRuta = require('./routes/usuarioRuta');
const unidadesRuta = require("./routes/unidadesRuta");


app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "tu_secreto_super_seguro",
  resave: false,
  saveUninitialized: false,
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.pageTitle = 'Laboratorio La Punta'; 
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  if (req.isAuthenticated() && req.session.usuario) {
    res.locals.nombreUsuario = req.session.usuario.nombre;
    res.locals.rol = req.session.usuario.rolEmpleado;
  }
  next();
});

const todosLosRoles = ['recepcionista', 'tecnico', 'bioquimico', 'admin'];
const rolesTecnicos = ['tecnico', 'bioquimico', 'admin'];

app.use('/admin', checkRole(['admin']), adminRuta);
app.use("/", pacienteRuta);
app.use("/buscarOrdenes", checkRole(todosLosRoles), buscarOrdenesRuta);
app.use("/orden", checkRole(todosLosRoles), ordenes_trabajoRuta);
app.use("/muestras", checkRole(todosLosRoles), resultadosRuta);
app.use("/examen", checkRole(rolesTecnicos), examenRuta);
app.use("/determinacion", checkRole(rolesTecnicos), determinacionesRuta);
app.use("/unidades", checkRole(rolesTecnicos), unidadesRuta);
app.use("/valoresreferencia", checkRole(rolesTecnicos), valoresRefRuta);
app.use("/modificar-examen", checkRole(rolesTecnicos), modificarExamenRuta);
app.use("/", pacienteRuta);
app.use("/", usuarioRuta);


app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/post-login-setup',
    failureRedirect: '/login',
    failureFlash: 'Email o contraseña incorrecto/s.'
  })
);

app.get('/post-login-setup', (req, res) => {
  const usuarioConRoles = req.user;
  
  req.session.usuario = {
    id: usuarioConRoles.id_Usuario,
    nombre: usuarioConRoles.nombre_usuario,
    esEmpleado: !!usuarioConRoles.empleado,
    esPaciente: !!usuarioConRoles.paciente,
    rolEmpleado: usuarioConRoles.empleado ? usuarioConRoles.empleado.rol : null,
    idPaciente: usuarioConRoles.paciente ? usuarioConRoles.paciente.id_paciente : null
  };

  req.session.save(() => {
    res.redirect('/redirigirUsuario');
  });
});

app.get('/redirigirUsuario', (req, res) => {
  if (!req.isAuthenticated() || !req.session.usuario) return res.redirect('/login');

  const { esEmpleado, esPaciente, rolEmpleado } = req.session.usuario;

  if (esEmpleado && esPaciente) {
    return res.render('seleccionarRol', { pageTitle: 'Seleccionar Rol', usuario: req.session.usuario });
  } else if (esEmpleado) {
    return res.redirect(`/${rolEmpleado}`);
  } else if (esPaciente) {
    return res.redirect('/portal-paciente');
  } else {
    req.flash('error', 'No tienes un rol asignado en el sistema.');
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.render('login', { pageTitle: 'Iniciar Sesión' });
});

app.get('/', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.redirect('/redirigirUsuario');
});

app.get("/bioquimico", checkRole(['bioquimico', 'admin']), (req, res) => { res.render("bioquimico", { pageTitle: 'Panel del Bioquímico' }); });
app.get("/tecnico", checkRole(['tecnico', 'bioquimico', 'admin']), (req, res) => { res.render("tecnico", { pageTitle: 'Panel del Técnico' }); });
app.get("/recepcionista", checkRole(['recepcionista', 'admin']), (req, res) => { res.render("recepcionista", { pageTitle: 'Panel de Recepción' }); });

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });
});

sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log("Servidor iniciado en http://localhost:3000");
  });
}).catch((error) => {
  console.error("Error al sincronizar la base de datos:", error);
});