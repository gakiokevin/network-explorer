// types.ts
export type DroneRadar = {
  id: string // Unique identifier for the radar
  name?: string // Optional name for the radar
  status: "active" | "inactive" // Radar status
  concentration: number // Concentration level (0 to 1)
  location: {
    hex: string // H3 hexagon ID
    lat: number // Latitude
    lng: number // Longitude
  }
}
