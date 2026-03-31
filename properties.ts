// Mapeo de propiedades a propietarios
export interface Property {
  name: string;
  owner: string;
}

export const properties: Property[] = [
  { name: 'Atl. G7 Casa Prestige', owner: 'Sharpe' },
  { name: 'Est. 24 Casa Paraiso', owner: 'Neesen' },
  { name: '3325 Villa Clara', owner: 'Goldberg' },
  { name: '7256 Villa Palacio', owner: 'Beatty' },
  { name: '10180 Villa Flora', owner: 'Arana' },
  { name: '5138 Villa Paloma', owner: 'Yoon' },
  { name: '10389 Villa Tiffany', owner: 'Hays' },
  { name: '2-103 Ocean Sound Villa', owner: 'Sudman' },
  { name: '2-208 Ocean Haven Villa', owner: 'Sudman' },
  { name: '2-105 Ocean Grace Villa', owner: 'Ehle' },
  { name: '2-101 Ocean Serenity Villa', owner: 'Ehle' },
  { name: '2-315 Ocean View Villa', owner: 'Hendel' },
  { name: '2-102 Ocean Bliss Villa', owner: 'Fonseca' },
  { name: 'Temporal', owner: 'Temp' },
];

// Normaliza un nombre de propiedad para comparación: minúsculas, sin guiones, espacios colapsados
const normalize = (s: string) => s.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()

// Función para obtener el propietario de una propiedad
export const getOwnerByProperty = (propertyName: string): string => {
  const normalizedInput = normalize(propertyName)
  const property = properties.find(p => normalize(p.name) === normalizedInput)
  return property ? property.owner : '';
};