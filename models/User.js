const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Usuarios = sequelize.define(
  "Usuario",
  {
    id_Usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_usuario: {
      type: DataTypes.STRING,
    },
    rol: {
      type: DataTypes.STRING,
      allowNull: false
    },
    correo_electronico: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    urlFoto:{
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    tableName: "usuarios",
    timestamps: false,
  }
);

module.exports = Usuarios;
