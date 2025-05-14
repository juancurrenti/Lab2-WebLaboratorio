const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Paciente = require("./paciente");
const TiposMuestra = require("./tipos_muestra");

const Muestra = sequelize.define(
  "Muestra",
  {
    id_Muestra: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ordenes_trabajo",
        key: "id_Orden",
      },
    },
    id_Paciente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Paciente,
        key: "id_paciente",
      },
    },
    idTipoMuestra: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TiposMuestra,
        key: "idTipoMuestra",
      },
    },
    Fecha_Recepcion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pendiente",
    },
  },
  {
    timestamps: false,
    tableName: "muestra",
  }
);

// Relaciones
Muestra.belongsTo(Paciente, { foreignKey: "id_Paciente", as: "Paciente" });
Muestra.belongsTo(TiposMuestra, { foreignKey: "idTipoMuestra", as: "TipoMuestra" });

module.exports = Muestra;
