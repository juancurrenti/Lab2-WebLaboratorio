const { Sequelize } = require("sequelize");
const sequelize = require("../config/database");

// Importar modelos
const Examen = require("./examen");
const Determinacion = require("./determinacion");
const Muestra = require("./muestra");
const OrdenesExamenes = require("./ordenes_examen");
const OrdenesTrabajo = require("./ordenes_trabajo");
const Paciente = require("./paciente");
const Resultado = require("./resultados");
const ValoresReferencia = require("./valoresReferencia");
const TiposMuestra = require("./tipos_muestra");
const UnidadMedida = require("./unidadMedida"); // <<< 1. MODELO IMPORTADO

// Definir asociaciones

// Muestra, Paciente y OrdenesTrabajo
Muestra.belongsTo(Paciente, { foreignKey: "id_paciente" });
Muestra.belongsTo(OrdenesTrabajo, { foreignKey: "id_orden" });
OrdenesTrabajo.hasMany(Muestra, { foreignKey: "id_orden" });
OrdenesTrabajo.hasMany(Resultado, { foreignKey: "id_Orden" });

// TiposMuestra y Examen
TiposMuestra.hasMany(Examen, {
  foreignKey: "idTipoMuestra", // Clave foránea en Examen
  as: "examenes", // Alias para obtener exámenes relacionados
});

Examen.belongsTo(TiposMuestra, {
  foreignKey: "idTipoMuestra", // Clave foránea en Examen
  as: "tipoMuestra", // Alias para acceder al tipo de muestra
});

// Examen y Determinacion
Examen.hasMany(Determinacion, {
  foreignKey: "id_examen", // Clave foránea en Determinacion
  as: "determinaciones", // Alias para acceder a determinaciones
});

Determinacion.belongsTo(Examen, {
  foreignKey: "id_examen", // Clave foránea en Determinacion
  as: "examen", // Alias para acceder al examen
});

// <<< 2. ASOCIACIÓN AÑADIDA
// Determinacion y UnidadMedida
Determinacion.belongsTo(UnidadMedida, {
  foreignKey: "Unidad_Medida",
  as: "unidadMedida",
});

UnidadMedida.hasMany(Determinacion, {
  foreignKey: "Unidad_Medida",
});
// >>> FIN DE LA ASOCIACIÓN AÑADIDA

// Determinacion y ValoresReferencia
Determinacion.hasMany(ValoresReferencia, {
  foreignKey: "id_Determinacion", // Clave foránea en ValoresReferencia
  as: "valoresReferencia", // Alias para acceder a valores de referencia
});

ValoresReferencia.belongsTo(Determinacion, {
  foreignKey: "id_Determinacion", // Clave foránea en ValoresReferencia
  as: "determinacion", // Alias para acceder a la determinación
});

// Resultado
Resultado.belongsTo(Determinacion, { foreignKey: "id_determinacion" });
Resultado.belongsTo(Muestra, { foreignKey: "id_Muestra" });
Resultado.belongsTo(OrdenesTrabajo, { foreignKey: "id_Orden" });

// OrdenesExamenes
OrdenesExamenes.belongsTo(Examen, { foreignKey: "id_examen", as: "examen" });
Examen.hasMany(OrdenesExamenes, {
  foreignKey: "id_examen",
  as: "ordenesExamenes",
});

// Exportar modelos
module.exports = {
  sequelize,
  Examen,
  Determinacion,
  Muestra,
  OrdenesExamenes,
  OrdenesTrabajo,
  Paciente,
  Resultado,
  ValoresReferencia,
  TiposMuestra,
  UnidadMedida, // <<< 3. MODELO EXPORTADO
};