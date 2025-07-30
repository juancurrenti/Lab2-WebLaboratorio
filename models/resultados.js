const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Resultado = sequelize.define('Resultado', {
    id_Resultado: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Orden: { type: DataTypes.INTEGER, allowNull: false },
    id_Determinacion: { type: DataTypes.INTEGER, allowNull: false },
    id_Muestra: { type: DataTypes.INTEGER, allowNull: false },
    Valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    Unidad: { type: DataTypes.STRING, allowNull: false },
    Estado: { type: DataTypes.STRING, defaultValue: "Pendiente" },
  }, {
    timestamps: false,
    tableName: "resultados",
  });

  Resultado.associate = function(models) {
    Resultado.belongsTo(models.OrdenTrabajo, { foreignKey: 'id_Orden', as: 'ordenTrabajo' });
    Resultado.belongsTo(models.Determinacion, { foreignKey: 'id_Determinacion', as: 'determinacion' });
    Resultado.belongsTo(models.Muestra, { foreignKey: 'id_Muestra', as: 'muestra' });
  };

  return Resultado;
};