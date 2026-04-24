// Équipage du voyage. `lienLinkedIn` est optionnel et configurable manuellement —
// aucun scraping automatique.

export interface CrewMember {
  id: string;
  nom: string;
  role: string;
  bio: string;
  lienLinkedIn?: string;
}

export const CREW: CrewMember[] = [
  {
    id: 'didier',
    nom: 'Didier Grimaldi',
    role: 'Responsable Animation',
    bio: 'Didier Grimaldi est professeur et chercheur à Barcelone, spécialisé en stratégie, innovation et transformation des villes intelligentes. Son parcours mêle expertise académique, conseil et développement urbain durable.'
  },
  {
    id: 'martin',
    nom: 'Martin Gallezot',
    role: 'Navigateur',
    bio: 'Martin Gallezot est dirigeant chez CEA-Leti, acteur majeur européen des semi-conducteurs et technologies avancées. Il possède une forte expérience en innovation industrielle, partenariats stratégiques et transfert technologique.'
  },
  {
    id: 'guillaume',
    nom: 'Guillaume Aubert',
    role: 'Ingénieur de bord',
    bio: 'Guillaume Aubert est professionnel basé à Paris, affilié à Opensee et diplômé de CentraleSupélec. Son parcours combine ingénierie, stratégie d’entreprise et environnements technologiques exigeants.'
  },
  {
    id: 'tristan',
    nom: 'Tristan Bruslé',
    role: 'Géographe de l’expédition',
    bio: 'Tristan Bruslé est chercheur CNRS en géographie, spécialiste des migrations internationales et des mobilités népalaises. Ses recherches portent aussi sur l’urbanisation, les diasporas et les transformations territoriales en Asie du Sud.'
  }
];
