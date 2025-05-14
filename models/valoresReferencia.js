const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Determinacion = require("./determinacion");

const ValoresReferencia = sequelize.define(
  "ValoresReferencia",
  {
    id_ValorReferencia: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Determinacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Edad_Minima: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Edad_Maxima: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Sexo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Valor_Referencia_Minimo: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    Valor_Referencia_Maximo: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    estado: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    timestamps: false,
    tableName: "valoresreferencia",
  }
);

ValoresReferencia.belongsTo(Determinacion, { foreignKey: "id_Determinacion" });

module.exports = ValoresReferencia;