const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Muestra = sequelize.define('Muestra', {
    id_Muestra: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Orden: { type: DataTypes.INTEGER, allowNull: false },
    id_Paciente: { type: DataTypes.INTEGER, allowNull: false },
    idTipoMuestra: { type: DataTypes.INTEGER, allowNull: false },
    Fecha_Recepcion: { type: DataTypes.DATE },
    estado: { type: DataTypes.STRING }
  }, {
    tableName: 'muestras',
    timestamps: false
  });

  Muestra.associate = function(models) {
    Muestra.belongsTo(models.Paciente, { foreignKey: "id_Paciente", as: "paciente" });
    Muestra.belongsTo(models.OrdenTrabajo, { foreignKey: "id_Orden", as: "ordenTrabajo" });
    Muestra.belongsTo(models.TiposMuestra, { foreignKey: "idTipoMuestra", as: "tipoMuestra" });
    Muestra.hasMany(models.Resultado, { foreignKey: 'id_Muestra', as: 'resultados' });
  };

  return Muestra;
};