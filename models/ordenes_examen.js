const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const OrdenesExamen = sequelize.define('OrdenesExamen', {
    id_OrdenExamen: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Orden: { type: DataTypes.INTEGER, allowNull: false },
    id_examen: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'ordenes_examenes',
    timestamps: false
  });

  OrdenesExamen.associate = function(models) {
    OrdenesExamen.belongsTo(models.Examen, { foreignKey: 'id_examen', as: 'examen' });
    OrdenesExamen.belongsTo(models.OrdenTrabajo, { foreignKey: 'id_Orden', as: 'ordenTrabajo' });
  };

  return OrdenesExamen;
};