const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Examen = require("./examen"); 
const UnidadMedida = require("./unidadMedida"); 

const Determinacion = sequelize.define(
  "determinaciones",
  {
    id_Determinacion: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Nombre_Determinacion: {
      type: DataTypes.STRING,
    },
    Valor: {
      type: DataTypes.DECIMAL(10, 2),
    },
    Unidad_Medida: {
      type: DataTypes.INTEGER,
    },
    Sexo: {
      type: DataTypes.STRING,
    },
    id_examen: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    timestamps: false, // Deshabilita las columnas createdAt y updatedAt
    tableName: "determinaciones"
  }
);


module.exports = Determinacion;