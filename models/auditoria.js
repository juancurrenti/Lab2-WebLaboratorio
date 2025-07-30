const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Auditoria = sequelize.define('Auditoria', {
    id_Auditoria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Usuario: { type: DataTypes.INTEGER, allowNull: false },
    Fecha_Hora_Operacion: { type: DataTypes.DATE, allowNull: false },
    Operacion_Realizada: { type: DataTypes.STRING, allowNull: false },
    Detalles_Adicionales: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'auditoria',
    timestamps: false
  });

  Auditoria.associate = function(models) {
    Auditoria.belongsTo(models.Usuario, { foreignKey: 'id_Usuario', as: 'Usuario' });
  };

  return Auditoria;
};