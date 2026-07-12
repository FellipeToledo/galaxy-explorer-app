/** Modelos da API Mars Rover Photos. */

export interface MarsCamera {
  id: number;
  name: string;
  rover_id: number;
  full_name: string;
}

export interface MarsRoverInfo {
  id: number;
  name: string;
  landing_date: string;
  launch_date: string;
  status: string;
  max_sol?: number;
  max_date?: string;
  total_photos?: number;
}

export interface MarsPhoto {
  id: number;
  sol: number;
  camera: MarsCamera;
  img_src: string;
  earth_date: string;
  rover: MarsRoverInfo;
}

export interface MarsPhotosResponse {
  photos: MarsPhoto[];
}

/** Rovers suportados no MVP. */
export type RoverName = 'curiosity' | 'perseverance' | 'opportunity' | 'spirit';

export const ROVERS: { name: RoverName; label: string }[] = [
  { name: 'perseverance', label: 'Perseverance' },
  { name: 'curiosity', label: 'Curiosity' },
  { name: 'opportunity', label: 'Opportunity' },
  { name: 'spirit', label: 'Spirit' },
];
