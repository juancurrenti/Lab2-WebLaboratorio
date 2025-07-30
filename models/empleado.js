const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Empleado = sequelize.define('Empleado', {
    id_empleado: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    rol: {
      type: DataTypes.ENUM('admin', 'bioquimico', 'recepcionista', 'tecnico'),
      allowNull: false
    },
    id_usuario_fk: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'empleados',
    timestamps: false
  });

  Empleado.associate = function(models) {
    Empleado.belongsTo(models.Usuario, { foreignKey: 'id_usuario_fk', as: 'usuario' });
  };

  return Empleado;
};