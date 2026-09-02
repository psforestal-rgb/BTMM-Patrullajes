window.PATRULLAJE_CATALOGS = {
  // Operativo: lugares de salida/regreso, combustible (ya existentes en el repo).
  lugares: [
    'La Esperanza',
    'Los Quetzales',
    'Tapantí',
    'Villa Mills',
    'Otro'
  ],
  combustibles: ['E', '1/4', '1/2', '3/4', 'F'],

  // Áreas Silvestres Protegidas del BTMM (also selectable free-text).
  asp: [
    'Parque Nacional Los Quetzales',
    'Parque Nacional Tapantí Macizo de la Muerte',
    'Reserva Biológica Cerro Vueltas',
    'Zona Protectora Río Navarro Río Sombrero'
  ],

  // Condición de la persona en el registro de contactos.
  roles: ['Contacto', 'Informante / denunciante', 'Imputado', 'Sospechoso', 'Propietario / poseedor', 'Testigo', 'Otro'],

  // Tipo de acción realizada durante la gira (informe institucional).
  acciones: ['Atención a queja', 'Control Tenencia V. Silvestre', 'Patrullajes reconocimiento exploración', 'Presencia institucional', 'Supervisión de torneos de caza', 'Operativos en carretera', 'Seguimientos Procesos conciliatorios', 'Valoración Daño Ambiental', 'Prevención, control incendio', 'Asistencia a Juicio o declaraciones', 'Asistencia inspecciones oculares judiciales', 'Control actividades de Contaminación', 'Puestos fijos', 'Inspección a ferias del agricultor', 'Inspección a establecimientos comerciales'],

  // Resultados generales de la gira.
  resultados: ['Hubo imputados', 'Decomisos', 'Infracciones', 'Contactos', 'Sospechosos', 'Vehículos revisados'],

  // Evidencia general observada durante la gira (no ligada a un hallazgo puntual).
  evidenciaGeneral: ['Caza diurna', 'Caza nocturna', 'Tapescos', 'Pesca', 'Picadas', 'Rancho', 'Caza de aves', 'Ingresos extraños', 'Huella de perros', 'Huella de vacas', 'Restos animales', 'Aserrío', 'Tala', 'Rastro palmiteros', 'Extracción bejuco', 'Extracción musgo o plantas', 'Incendio / quema', 'Residuos / contaminación'],

  // Clasificación de hallazgos georreferenciados (categorías SITADA oficiales).
  vigilancia: ['Punto caliente', 'Finca del Estado', 'Al azar'],
  monitoreo: ['Amenaza', 'Especie', 'Ecosistema'],
  sitadaTipos: [
    'Explotación Minera',
    'Forestal',
    'Contaminación Sónica',
    'Viabilidad Ambiental',
    'Explotacion Geotermica',
    'Pesca Marítma',
    'Agua',
    'Contaminación del aire',
    'Contaminación por residuos',
    'Biodiversidad/Vida Silvestre',
    'Arqueológico',
    'Combustibles derivados de petroleo',
    'Pago Servicio Ambiental',
    'Pesca Continental',
    'Suelos',
    'Actividad Acuícola',
    'Parque Nacional/Area Silvestre Protegida'
  ],
  // Lista auxiliar de infracciones observables públicamente en SITADA y reportes institucionales.
  // El campo sigue siendo editable porque el catálogo de infracciones del SITADA es dependiente
  // del tipo de denuncia y puede ser actualizado por la institución.
  sitadaInfraccionesComunes: [
    'Tala y/o aprovechamiento',
    'Invasión de área Protección de río/cuerpo de agua',
    'Tenencia ilegal de animal silvestre',
    'Cacería',
    'Obras no autorizadas en cauce',
    'Animal Silvestre que requiere rescate',
    'Aprovechamiento ilegal del agua',
    'Movimiento de tierra no autorizado',
    'Invasión de área Protección de naciente',
    'Columna de humo',
    'Contaminación por residuos',
    'Extraccion de materiales en tajos sin permiso',
    'Transporte de madera',
    'Animal silvestre que afecta actividad humana',
    'Contaminación por aguas residuales',
    'Uso de materiales explosivo sin autorización',
    'Explotación de minerales en áreas protegidas',
    'Sedimentación en cuerpo de agua',
    'Partículas suspendidas',
    'Sonido/vibraciones',
    'Extracción de arena en playas',
    'Contaminación por el transporte de materiales',
    'Extracción de materiales en cauce de dominio público'
  ]
};
