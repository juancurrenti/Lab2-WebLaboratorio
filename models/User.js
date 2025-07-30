const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    id_Usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_usuario: { type: DataTypes.STRING, allowNull: false },
    correo_electronico: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },

  }, {
    tableName: 'usuarios',
    timestamps: false,
  });

  Usuario.associate = function(models) {
    Usuario.hasOne(models.Empleado, { foreignKey: 'id_usuario_fk', as: 'empleado' });
    Usuario.hasOne(models.Paciente, { foreignKey: 'id_usuario_fk', as: 'paciente' });
    Usuario.hasMany(models.Auditoria, { foreignKey: 'id_Usuario', as: 'auditorias' });
  };

  return Usuario;
};