import type { TransportMode } from '../types.js';

export interface SeedLine {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  mode: TransportMode;
  operator: string | null;
  color: string;
  textColor: string;
  origin: string | null;
  destination: string | null;
  city: string;
  province: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
}

const AMBA_SOURCE = 'https://www.datos.gob.ar/dataset/transporte-lineas-transporte-rmba';
const TRAIN_SOURCE = 'https://www.argentina.gob.ar/transporte/cnrt/lineas-de-trenes-pasajeros';
const CORDOBA_SOURCE = 'https://cordoba.gob.ar/tu-bondi/';
const ROSARIO_SOURCE = 'https://www.rosario.gob.ar/inicio/transporte-urbano-de-pasajeros';
const MENDOZA_SOURCE = 'https://mendotran.mendoza.gov.ar/site/actualizaciones';

export const INITIAL_LINES: SeedLine[] = [
  { id: 'amba-colectivo-12', slug: 'linea-12-amba', name: 'Línea 12', shortName: '12', mode: 'colectivo', operator: 'Transportes Automotores Callao', color: '#3c6e91', textColor: '#ffffff', origin: 'Palermo', destination: 'Plaza de Mayo', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-colectivo-29', slug: 'linea-29-amba', name: 'Línea 29', shortName: '29', mode: 'colectivo', operator: 'Pedro de Mendoza', color: '#e9bc3f', textColor: '#171816', origin: 'La Boca', destination: 'Olivos', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-colectivo-39', slug: 'linea-39-amba', name: 'Línea 39', shortName: '39', mode: 'colectivo', operator: 'Transportes Santa Fe', color: '#d77a2f', textColor: '#171816', origin: 'Barracas', destination: 'Chacarita', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-colectivo-60', slug: 'linea-60-amba', name: 'Línea 60', shortName: '60', mode: 'colectivo', operator: 'MONSA', color: '#c83431', textColor: '#ffffff', origin: 'Constitución', destination: 'Tigre / Escobar', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-colectivo-68', slug: 'linea-68-amba', name: 'Línea 68', shortName: '68', mode: 'colectivo', operator: 'Transportes Sesenta y Ocho', color: '#2f6d55', textColor: '#ffffff', origin: 'Plaza Miserere', destination: 'Puente Saavedra', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-colectivo-152', slug: 'linea-152-amba', name: 'Línea 152', shortName: '152', mode: 'colectivo', operator: 'Tandilense', color: '#287f72', textColor: '#ffffff', origin: 'La Boca', destination: 'Olivos', city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina — líneas RMBA', sourceUrl: AMBA_SOURCE, sourceUpdatedAt: '2023-04-12' },
  { id: 'amba-tren-mitre', slug: 'tren-mitre', name: 'Línea Mitre', shortName: 'Mitre', mode: 'tren', operator: 'Trenes Argentinos', color: '#8c4f73', textColor: '#ffffff', origin: 'Retiro', destination: 'Tigre / Mitre / J. L. Suárez', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'amba-tren-sarmiento', slug: 'tren-sarmiento', name: 'Línea Sarmiento', shortName: 'Sarmiento', mode: 'tren', operator: 'Trenes Argentinos', color: '#b84b45', textColor: '#ffffff', origin: 'Once', destination: 'Moreno', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'amba-tren-roca', slug: 'tren-roca', name: 'Línea Roca', shortName: 'Roca', mode: 'tren', operator: 'Trenes Argentinos', color: '#4a78a8', textColor: '#ffffff', origin: 'Constitución', destination: 'Zona sur', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'amba-tren-san-martin', slug: 'tren-san-martin', name: 'Línea San Martín', shortName: 'San Martín', mode: 'tren', operator: 'Trenes Argentinos', color: '#81753f', textColor: '#ffffff', origin: 'Retiro', destination: 'Pilar / Cabred', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'amba-tren-belgrano-sur', slug: 'tren-belgrano-sur', name: 'Belgrano Sur', shortName: 'Belgrano Sur', mode: 'tren', operator: 'Trenes Argentinos', color: '#7a6ca3', textColor: '#ffffff', origin: 'Sáenz', destination: 'González Catán / Marinos', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'amba-tren-urquiza', slug: 'tren-urquiza', name: 'Línea Urquiza', shortName: 'Urquiza', mode: 'tren', operator: 'Metrovías', color: '#6a7e44', textColor: '#ffffff', origin: 'Federico Lacroze', destination: 'General Lemos', city: 'AMBA', province: 'Buenos Aires', sourceName: 'CNRT — trenes de pasajeros', sourceUrl: TRAIN_SOURCE, sourceUpdatedAt: null },
  { id: 'cordoba-36a', slug: 'linea-36a-cordoba', name: 'Línea 36A', shortName: '36A', mode: 'colectivo', operator: 'SiBus', color: '#b44839', textColor: '#ffffff', origin: 'Barrio Congreso', destination: 'Barrio Mariano Fragueiro', city: 'Córdoba', province: 'Córdoba', sourceName: 'Municipalidad de Córdoba — Tu Bondi', sourceUrl: CORDOBA_SOURCE, sourceUpdatedAt: '2026-03-01' },
  { id: 'cordoba-70', slug: 'linea-70-cordoba', name: 'Línea 70', shortName: '70', mode: 'colectivo', operator: 'Sol Bus', color: '#5c7356', textColor: '#ffffff', origin: 'Jardín Inglés', destination: 'Colonia Lola', city: 'Córdoba', province: 'Córdoba', sourceName: 'Municipalidad de Córdoba — Tu Bondi', sourceUrl: CORDOBA_SOURCE, sourceUpdatedAt: '2026-08-01' },
  { id: 'cordoba-73', slug: 'linea-73-cordoba', name: 'Línea 73', shortName: '73', mode: 'colectivo', operator: 'Sol Bus', color: '#5c7356', textColor: '#ffffff', origin: 'Polo 52', destination: 'Red urbana', city: 'Córdoba', province: 'Córdoba', sourceName: 'Municipalidad de Córdoba — Tu Bondi', sourceUrl: CORDOBA_SOURCE, sourceUpdatedAt: '2026-08-01' },
  { id: 'rosario-102-roja', slug: 'linea-102-roja-rosario', name: '102 Roja', shortName: '102R', mode: 'colectivo', operator: 'MOVI Rosario', color: '#ae3738', textColor: '#ffffff', origin: null, destination: null, city: 'Rosario', province: 'Santa Fe', sourceName: 'Municipalidad de Rosario — TUP', sourceUrl: ROSARIO_SOURCE, sourceUpdatedAt: '2026-02-23' },
  { id: 'rosario-115', slug: 'linea-115-rosario', name: 'Línea 115', shortName: '115', mode: 'colectivo', operator: 'MOVI Rosario', color: '#3d718b', textColor: '#ffffff', origin: null, destination: null, city: 'Rosario', province: 'Santa Fe', sourceName: 'Municipalidad de Rosario — TUP', sourceUrl: ROSARIO_SOURCE, sourceUpdatedAt: '2026-02-23' },
  { id: 'rosario-k', slug: 'linea-k-rosario', name: 'Línea K', shortName: 'K', mode: 'trolebus', operator: 'MOVI Rosario', color: '#526f4b', textColor: '#ffffff', origin: null, destination: null, city: 'Rosario', province: 'Santa Fe', sourceName: 'Municipalidad de Rosario — TUP', sourceUrl: ROSARIO_SOURCE, sourceUpdatedAt: '2026-02-23' },
  { id: 'rosario-q', slug: 'linea-q-rosario', name: 'Línea Q', shortName: 'Q', mode: 'trolebus', operator: 'MOVI Rosario', color: '#986b35', textColor: '#ffffff', origin: null, destination: null, city: 'Rosario', province: 'Santa Fe', sourceName: 'Municipalidad de Rosario — TUP', sourceUrl: ROSARIO_SOURCE, sourceUpdatedAt: '2026-02-23' },
  { id: 'mendoza-grupo-100', slug: 'grupo-100-mendoza', name: 'Grupo 100', shortName: '100', mode: 'colectivo', operator: 'MendoTran', color: '#ad4238', textColor: '#ffffff', origin: 'Ciudad de Mendoza', destination: 'Área metropolitana', city: 'Gran Mendoza', province: 'Mendoza', sourceName: 'Gobierno de Mendoza — MendoTran', sourceUrl: MENDOZA_SOURCE, sourceUpdatedAt: null },
  { id: 'mendoza-grupo-200', slug: 'grupo-200-mendoza', name: 'Grupo 200', shortName: '200', mode: 'colectivo', operator: 'MendoTran', color: '#ad4238', textColor: '#ffffff', origin: 'Guaymallén', destination: 'Zona sur y este', city: 'Gran Mendoza', province: 'Mendoza', sourceName: 'Gobierno de Mendoza — MendoTran', sourceUrl: MENDOZA_SOURCE, sourceUpdatedAt: null },
  { id: 'mendoza-linea-270', slug: 'linea-270-mendoza', name: 'Línea 270', shortName: '270', mode: 'colectivo', operator: 'MendoTran', color: '#ad4238', textColor: '#ffffff', origin: 'Fray Luis Beltrán', destination: 'Rodeo del Medio / Rodeo de la Cruz', city: 'Gran Mendoza', province: 'Mendoza', sourceName: 'Gobierno de Mendoza — MendoTran', sourceUrl: MENDOZA_SOURCE, sourceUpdatedAt: null },
];
