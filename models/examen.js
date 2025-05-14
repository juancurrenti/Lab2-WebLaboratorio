// models/Examen.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const TiposMuestra = require("./tipos_muestra"); // Importar TiposMuestra
const Examen = sequelize.define(
  "Examen",
  {
    id_examen: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_examen: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
    },
    codigo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true, // Activo por defecto
    },
    idTipoMuestra: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tipos_muestra", // Nombre de la tabla relacionada
        key: "idTipoMuestra",
      },
    },
    tiempoDemora: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, 
      
    },
  },
  {
    timestamps: false,
    tableName: "examen",
  }
);

Examen.belongsTo(TiposMuestra, {
  foreignKey: "idTipoMuestra",
  as: "tipoMuestra", // Alias para la relación
});

module.exports = Examen;