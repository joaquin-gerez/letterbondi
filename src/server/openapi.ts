export const openApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Letterbondi API', version: '0.1.0', description: 'API del archivo social de viajes en transporte público argentino.' },
  servers: [{ url: '/api' }],
  paths: {
    '/health': { get: { summary: 'Estado del servicio', responses: { '200': { description: 'OK' } } } },
    '/lines': { get: { summary: 'Buscar servicios', parameters: ['q', 'mode', 'province'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })), responses: { '200': { description: 'Listado de servicios' } } } },
    '/lines/{idOrSlug}': { get: { summary: 'Detalle de un servicio', parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Servicio encontrado' }, '404': { description: 'No encontrado' } } } },
    '/trips': {
      get: { summary: 'Actividad reciente', responses: { '200': { description: 'Viajes recientes' } } },
      post: {
        summary: 'Registrar un viaje con cuenta o identidad anónima',
        description: 'Sin sesión se asigna una identidad persistente Anon en una cookie HttpOnly.',
        security: [{ cookieAuth: [] }, {}],
        responses: { '201': { description: 'Viaje registrado' }, '429': { description: 'Límite de publicaciones anónimas alcanzado' } },
      },
    },
    '/auth/register': { post: { summary: 'Crear una cuenta', responses: { '201': { description: 'Cuenta creada' } } } },
    '/auth/login': { post: { summary: 'Iniciar sesión', responses: { '200': { description: 'Sesión iniciada' } } } },
    '/auth/logout': { post: { summary: 'Cerrar sesión', responses: { '204': { description: 'Sesión cerrada' } } } },
    '/auth/me': { get: { summary: 'Sesión actual', responses: { '200': { description: 'Usuario o null' } } } },
    '/members': { get: { summary: 'Listado público de miembros', responses: { '200': { description: 'Miembros ordenados por actividad' } } } },
    '/users/{username}': { get: { summary: 'Perfil y diario públicos', responses: { '200': { description: 'Perfil' }, '404': { description: 'No encontrado' } } } },
    '/users/{username}/follow': {
      post: { summary: 'Seguir a un miembro', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Siguiendo' }, '401': { description: 'Sin sesión' } } },
      delete: { summary: 'Dejar de seguir a un miembro', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Ya no se sigue' }, '401': { description: 'Sin sesión' } } },
    },
    '/stats': { get: { summary: 'Totales de la plataforma', responses: { '200': { description: 'Totales' } } } },
  },
  components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'letterbondi_session' } } },
} as const;
