const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const OrdenTrabajo = sequelize.define('OrdenTrabajo', {
    id_Orden: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Paciente: { type: DataTypes.INTEGER, allowNull: false },
    dni: { type: DataTypes.STRING, allowNull: false },
    Fecha_Creacion: { type: DataTypes.DATE },
    Fecha_Entrega: { type: DataTypes.DATE },
    estado: { type: DataTypes.STRING },
    descripcionCancelacion: { type: DataTypes.STRING, allowNull: true },
    diagnostico: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'ordenes_trabajo',
    timestamps: false
  });

  OrdenTrabajo.associate = function(models) {
    OrdenTrabajo.belongsTo(models.Paciente, { foreignKey: 'id_Paciente', as: 'paciente' });
    OrdenTrabajo.hasMany(models.Muestra, { foreignKey: 'id_Orden', as: 'Muestras' });
    OrdenTrabajo.hasMany(models.Resultado, { foreignKey: 'id_Orden', as: 'Resultados' });
    OrdenTrabajo.hasMany(models.OrdenesExamen, { foreignKey: 'id_Orden', as: 'OrdenesExamenes' });
  };

  return OrdenTrabajo;
};